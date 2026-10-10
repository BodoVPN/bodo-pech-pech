import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test, { after } from 'node:test';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { createPair, encryptBytes, encryptBytesV2, textToBytes } from '../src/crypto.ts';
import { unlockConversation, validateNewPassphrase } from '../src/key-storage.ts';
import { encodeCover } from '../src/codec.ts';
import { decodeMessageCover, encodeDialogue } from '../src/dialogue.ts';

const fileUrl = pathToFileURL(resolve('bodo-pech-pech.html')).href;
const channels = (process.env.BROWSER_CHANNELS || 'chrome,msedge').split(',');
const passphrase = 'Disposable test words river garden moon 7!';
const testRoot = resolve('../../work/pech-pech-tests');
await mkdir(testRoot, { recursive: true });
await mkdir('test-results', { recursive: true });
const directory = await mkdtemp(resolve(testRoot, 'run-'));
let fileNumber = 0;
after(async () => {
  if (dirname(directory) !== testRoot) throw new Error('Refusing cleanup outside the owned test directory');
  await rm(directory, { recursive: true, force: true });
});
function observe(page) {
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('request', (request) => { if (/^https?:/.test(request.url())) problems.push('Unexpected HTTP request'); });
  return () => assert.deepEqual(problems, []);
}
async function saveDownload(page, trigger) {
  const pending = page.waitForEvent('download');
  await trigger();
  const download = await pending;
  const path = resolve(directory, `private-test-${++fileNumber}.html`);
  await download.saveAs(path);
  assert.equal(await download.failure(), null);
  assert.match(download.suggestedFilename(), /^pech-pech-private-[a-f0-9]{8}\.html$/);
  return { path, url: pathToFileURL(path).href, html: await readFile(path, 'utf8') };
}
async function createFile(page, code) {
  await page.goto(fileUrl);
  await page.locator('#setup-panel').waitFor({ state: 'visible' });
  await page.locator('#setup-passphrase').fill(passphrase);
  if (code) {
    await page.locator('#legacy-setup').evaluate((node) => { node.open = true; });
    await page.locator('#import-code').fill(code);
  }
  return saveDownload(page, () => page.locator(code ? '#import' : '#generate').click());
}
async function openFile(page, file) {
  await page.goto(file.url);
  await unlockFile(page);
  assert.equal(await page.locator('#setup-panel').isHidden(), true);
  assert.equal(await page.locator('html').getAttribute('lang'), 'fa');
}
async function unlockFile(page, password = passphrase) {
  await page.locator('#unlock-panel').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#conversation').isHidden(), true);
  await page.locator('#unlock-passphrase').fill(password);
  await page.locator('#unlock-passphrase').press('Enter');
  await page.locator('#conversation').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#unlock-passphrase').inputValue(), '');
}
async function assertEmbeddedTypeface(page, selector) {
  // CSS family declarations alone can silently fall back. Inspect the font
  // actually used for the rendered glyphs in each language, while offline.
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('DOM.enable'); await session.send('CSS.enable');
    for (const language of ['fa', 'en']) {
      if (await page.locator('html').getAttribute('lang') !== language) await page.locator('#language').click();
      const loaded = await page.evaluate(async () => {
        const fonts = await document.fonts.load('600 20px "Vazirmatn"', 'پچ‌پچ Sample');
        await document.fonts.ready;
        return fonts.length > 0 && fonts.every((font) => font.status === 'loaded');
      });
      assert.equal(loaded, true, 'Bundled WOFF2 must load without a network');
      const { root } = await session.send('DOM.getDocument', { depth: 0 });
      const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
      assert.ok(fonts.length > 0 && fonts.every((font) => font.isCustomFont && font.glyphCount > 0 && font.familyName.startsWith('Vazirmatn')), 'Persian and Latin UI glyphs must use the embedded font, not an installed fallback');
    }
    await page.locator('#language').click();
  } finally { await session.detach(); }
}
async function write(page, message, fromHome = true) {
  if (fromHome) await page.locator('#send-mode').click();
  await page.locator('#message').fill(message);
  await page.locator('#encrypt').click();
  await page.locator('#cover-result').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#send-form').isHidden(), true);
  return page.locator('#cover').inputValue();
}
async function read(page, cover, fromHome = true) {
  if (fromHome) await page.locator('#receive-mode').click();
  await page.locator('#received').fill(cover);
  await page.locator('#decrypt').click();
  await page.locator('#plain-result').waitFor({ state: 'visible' });
  return page.locator('#plaintext').textContent();
}
function codeOf(file) {
  const code = /<meta name="bpp-conversation" content="(BPK1-[A-F0-9]{174})">/.exec(file.html)?.[1];
  assert.ok(code, 'A private download contains one valid encrypted envelope');
  assert.equal(/BPP1[A-F0-9]{72}/.test(file.html), false);
  assert.ok(!file.html.includes(passphrase), 'Passphrase must never enter the exported file');
  return code;
}

for (const channel of channels) test(`${channel}: real download, offline reopen, exact exchange, reply, Done and reload`, { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ channel, headless: true });
  try {
    console.log(`${channel} ${browser.version()}: offline downloaded-file flow`);
    const aliceContext = await browser.newContext({ offline: true });
    const bobContext = await browser.newContext({ offline: true });
    const alice = await aliceContext.newPage(); const bob = await bobContext.newPage();
    const cleanAlice = observe(alice); const cleanBob = observe(bob);
    const file = await createFile(alice);
    await assertEmbeddedTypeface(alice, '#download-heading');
    assert.ok(file.html.includes('SIL OPEN FONT LICENSE Version 1.1') && file.html.includes('Copyright 2015 The Vazirmatn Project Authors'), 'The redistributable private file must carry its font license');
    const repeat = await saveDownload(alice, () => alice.locator('#download').click());
    assert.ok(file.html === repeat.html, 'Download again must retain the same conversation');
    await openFile(alice, file); await openFile(bob, repeat);
    await assertEmbeddedTypeface(alice, '#home-heading');
    const message = '\uFEFF  سلام 👋\ne\u0301 ي ك ‌ <img src=x onerror=alert(1)>  ';
    const cover = await write(alice, message);
    assert.equal(await read(bob, cover.replace(/ی/g, 'ي').replace(/ک/g, 'ك').replace(/ /g, '\n')), message);
    assert.equal(await bob.locator('#plaintext img').count(), 0);
    assert.equal(await bob.evaluate(() => document.activeElement.id), 'plain-heading');
    await bob.locator('#reply').click();
    const reply = await write(bob, 'باشه، منتظرم.', false);
    assert.equal(decodeMessageCover(reply)[4], Math.floor(decodeMessageCover(cover)[4] / 5) * 5);
    await alice.locator('#clear').click();
    assert.equal(await read(alice, reply), 'باشه، منتظرم.');
    await alice.locator('#clear').click();
    assert.equal(await alice.locator('#message').inputValue(), '');
    assert.equal(await alice.locator('#received').inputValue(), '');
    assert.equal(await alice.locator('#cover').inputValue(), '');
    assert.equal(await alice.locator('#plaintext').textContent(), '');
    assert.equal(await alice.evaluate(() => document.activeElement.id), 'home-heading');
    await alice.reload();
    await unlockFile(alice);
    assert.equal(await read(alice, reply), 'باشه، منتظرم.');
    await alice.close();
    const reopened = await aliceContext.newPage();
    const cleanReopened = observe(reopened);
    await openFile(reopened, file);
    assert.equal(await read(reopened, cover), message);
    for (const page of [reopened, bob]) {
      assert.equal(await page.evaluate(() => navigator.onLine), false);
      assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie]), [0, 0, '']);
    }
    cleanAlice(); cleanBob(); cleanReopened();
  } finally { await browser.close(); }
});

test('exports use the immutable shell; generic artifact has no key; conversations are independent', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ channel: channels[0], headless: true });
  try {
    const context = await browser.newContext({ offline: true }); const page = await context.newPage(); const clean = observe(page);
    const generic = await readFile('bodo-pech-pech.html', 'utf8');
    assert.equal(/BPP1[A-F0-9]{72}/.test(generic), false);
    await page.goto(fileUrl); await page.locator('#setup-panel').waitFor({ state: 'visible' });
    await page.evaluate(() => {
      for (const id of ['message', 'received', 'cover', 'plaintext']) document.getElementById(id).textContent = 'TRANSIENT-DO-NOT-EXPORT-73519';
      document.getElementById('message').value = 'TRANSIENT-DRAFT-73519';
      const node = document.createElement('div'); node.textContent = 'OTHER-CONTACT-73519'; document.body.append(node);
    });
    await page.locator('#setup-passphrase').fill(passphrase);
    const first = await saveDownload(page, () => page.locator('#generate').click());
    assert.equal(first.html.includes('73519'), false);
    // Apart from the single inert key slot the export must be byte-for-byte the known build.
    assert.ok(first.html.replace(codeOf(first), '') === generic);
    const second = await createFile(page);
    assert.ok(codeOf(first) !== codeOf(second), 'A new setup must create a fresh random conversation');
    await openFile(page, first);
    const cover = await write(page, 'conversation A');
    await openFile(page, second);
    await page.locator('#receive-mode').click(); await page.locator('#received').fill(cover); await page.locator('#decrypt').click();
    await page.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#plain-result').isHidden(), true);
    assert.equal(await page.locator('#plaintext').textContent(), '');
    clean();
  } finally { await browser.close(); }
});

test('legacy code import keeps v1/v2 recovery; tampering and invalid setup fail closed', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ channel: channels[0], headless: true });
  try {
    const page = await (await browser.newContext({ offline: true })).newPage(); const clean = observe(page);
    const pair = await createPair(); const file = await createFile(page, pair.code);
    await openFile(page, file);
    const legacy = encodeCover(await encryptBytes(pair.key, textToBytes('پیام قدیمی\r\n👋'), 1));
    assert.equal(await read(page, legacy), 'پیام قدیمی\r\n👋');
    await page.locator('#reply').click();
    const reply = await write(page, 'پاسخ', false);
    assert.equal(Math.floor(decodeMessageCover(reply)[4] / 5), 1);
    const packet = await encryptBytesV2(pair.key, textToBytes('existing v2'), 8);
    await page.locator('#clear').click();
    assert.equal(await read(page, encodeDialogue(packet)), 'existing v2');
    for (const malformed of [encodeDialogue(packet).slice(0, -35), 'not a cover', encodeDialogue(Uint8Array.from(packet, (byte, index) => index === 20 ? byte ^ 1 : byte))]) {
      await page.locator('#read-another').click();
      await page.locator('#received').fill(malformed); await page.locator('#decrypt').click();
      await page.locator('#error').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#plaintext').textContent(), '');
      // Return to a successful result to exercise clearing stale plaintext again.
      assert.equal(await read(page, encodeDialogue(packet), false), 'existing v2');
    }
    await page.goto(fileUrl); await page.locator('#setup-panel').waitFor({ state: 'visible' });
    await page.locator('#setup-passphrase').fill(passphrase);
    await page.locator('#legacy-setup').evaluate((node) => { node.open = true; });
    await page.locator('#import-code').fill('BPP1-"><script>alert(1)</script>'); await page.locator('#import').click();
    await page.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#download-panel').isHidden(), true);
    const bad = resolve(directory, 'damaged.html');
    await writeFile(bad, file.html.replace(codeOf(file), 'BPP1BROKEN'));
    await page.goto(pathToFileURL(bad).href); await page.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#conversation').isHidden(), true);
    assert.equal(await page.locator('#setup-panel').isHidden(), true);
    clean();
  } finally { await browser.close(); }
});

test('Done cancels in-flight encryption and retains the private pairing', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ channel: channels[0], headless: true });
  try {
    const page = await (await browser.newContext({ offline: true })).newPage();
    const file = await createFile(page); await openFile(page, file); await page.locator('#send-mode').click();
    await page.evaluate(() => {
      const original = crypto.subtle.encrypt.bind(crypto.subtle);
      crypto.subtle.encrypt = async (...args) => {
        const result = await original(...args);
        await new Promise((release) => { globalThis.releaseEncryption = release; });
        crypto.subtle.encrypt = original;
        return result;
      };
    });
    await page.locator('#message').fill('must disappear'); await page.locator('#encrypt').click();
    await page.waitForFunction(() => !!globalThis.releaseEncryption);
    await page.locator('#clear').click();
    await page.evaluate(async () => { globalThis.releaseEncryption(); await new Promise((done) => setTimeout(done, 0)); });
    assert.equal(await page.locator('#cover').inputValue(), ''); assert.equal(await page.locator('#message').inputValue(), '');
    assert.equal(await page.locator('#cover-result').isHidden(), true);
    const next = await write(page, 'still paired');
    const key = await unlockConversation(codeOf(file), passphrase);
    const { decryptBytes, bytesToText } = await import('../src/crypto.ts');
    assert.equal(bytesToText(await decryptBytes(key, decodeMessageCover(next))), 'still paired');
  } finally { await browser.close(); }
});

test('denied copy/paste has manual fallback; successful clipboard actions and stale paste are safe', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ channel: channels[0], headless: true });
  try {
    const page = await (await browser.newContext({ offline: true })).newPage();
    const file = await createFile(page); await openFile(page, file); await page.locator('#language').click();
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); }, readText: async () => { throw new Error('Denied'); } } }));
    const cover = await write(page, 'clipboard test'); await page.locator('#copy-cover').click();
    await page.waitForFunction(() => document.querySelector('#feedback').textContent.includes('selected'));
    assert.equal(await page.locator('#cover').evaluate((field) => field.selectionEnd - field.selectionStart === field.value.length), true);
    await page.locator('#clear').click(); await page.locator('#receive-mode').click(); await page.locator('#paste-cover').click();
    await page.waitForFunction(() => document.querySelector('#feedback').textContent.includes('Ctrl+V'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'received');
    assert.equal(await read(page, cover, false), 'clipboard test');
    await page.locator('#copy-plain').click();
    await page.waitForFunction(() => document.querySelector('#feedback').textContent.includes('selected'));
    assert.equal(await page.evaluate(() => window.getSelection().toString()), 'clipboard test');
    await page.locator('#clear').click(); await page.locator('#receive-mode').click();
    await page.evaluate((value) => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => value, writeText: async (text) => { globalThis.copiedText = text; } } }), cover);
    await page.locator('#paste-cover').click(); await page.waitForFunction(() => document.querySelector('#received').value.length > 0);
    assert.equal(await read(page, cover, false), 'clipboard test');
    await page.locator('#copy-plain').click();
    await page.waitForFunction(() => globalThis.copiedText === 'clipboard test');
    await page.locator('#clear').click(); await page.locator('#receive-mode').click();
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: () => new Promise((done) => { globalThis.releasePaste = done; }) } }));
    await page.locator('#paste-cover').click(); await page.waitForFunction(() => !!globalThis.releasePaste);
    await page.locator('#clear').click(); await page.evaluate(() => globalThis.releasePaste('stale text'));
    assert.equal(await page.locator('#received').inputValue(), '');
  } finally { await browser.close(); }
});

test('blocked automatic download can be retried without changing the conversation', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ channel: channels[0], headless: true });
  try {
    const page = await (await browser.newContext({ offline: true })).newPage();
    await page.goto(fileUrl); await page.locator('#setup-panel').waitFor({ state: 'visible' });
    await page.evaluate(() => { document.getElementById('download').click = () => {}; });
    await page.locator('#setup-passphrase').fill(passphrase);
    await page.locator('#generate').click(); await page.locator('#download-panel').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#setup-controls').isHidden(), true);
    const file = await saveDownload(page, () => page.locator('#download').click());
    await openFile(page, file);
    assert.equal(await page.locator('#home').isVisible(), true);
  } finally { await browser.close(); }
});

test('a failed file preparation can be retried', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ channel: channels[0], headless: true });
  try {
    const page = await (await browser.newContext({ offline: true })).newPage();
    await page.goto(fileUrl); await page.locator('#setup-panel').waitFor({ state: 'visible' });
    await page.evaluate(() => {
      const original = URL.createObjectURL;
      URL.createObjectURL = (...args) => { URL.createObjectURL = original; if (args.length) throw new Error('Simulated allocation failure'); };
    });
    await page.locator('#setup-passphrase').fill(passphrase);
    await page.locator('#generate').click(); await page.locator('#error').waitFor({ state: 'visible' });
    await page.locator('#setup-passphrase').fill(passphrase);
    const file = await saveDownload(page, () => page.locator('#generate').click());
    await openFile(page, file);
    assert.equal(await page.locator('#home').isVisible(), true);
  } finally { await browser.close(); }
});

test('unsupported browser and CRLF copies fail safely or preserve hashed CSP', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ channel: channels[0], headless: true });
  try {
    const context = await browser.newContext({ offline: true }); const page = await context.newPage(); const clean = observe(page);
    const file = await createFile(page);
    const crlf = resolve(directory, 'crlf-private.html'); await writeFile(crlf, file.html.replace(/\r?\n/g, '\r\n'));
    await openFile(page, { url: pathToFileURL(crlf).href });
    assert.equal(await page.locator('.choices').evaluate((node) => getComputedStyle(node).display), 'grid'); clean();
    const unsupported = await context.newPage();
    await unsupported.addInitScript(() => Object.defineProperty(globalThis, 'isSecureContext', { value: false }));
    await unsupported.goto(fileUrl); await unsupported.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await unsupported.locator('#generate').isDisabled(), true);
    assert.equal(await unsupported.locator('#conversation').isHidden(), true);
  } finally { await browser.close(); }
});

test('mobile width, enlarged text, English, large targets and short errors', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ channel: channels[0], headless: true });
  try {
    const page = await (await browser.newContext({ offline: true, viewport: { width: 390, height: 844 } })).newPage();
    await page.goto(fileUrl); await page.locator('#setup-panel').waitFor({ state: 'visible' });
    await page.screenshot({ path: 'test-results/simple-setup-mobile.png', fullPage: true });
    const file = await createFile(page); await openFile(page, file);
    const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await noOverflow();
    for (const id of ['send-mode', 'receive-mode', 'language']) assert.ok((await page.locator(`#${id}`).boundingBox()).height >= 48);
    await page.screenshot({ path: 'test-results/simple-home-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 320, height: 640 }); await noOverflow();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#send-mode').click(); await page.locator('#encrypt').click(); await page.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'error');
    await page.locator('#message').fill('س'.repeat(1025)); await page.locator('#encrypt').click();
    assert.equal(await page.locator('#cover-result').isHidden(), true);
    await page.locator('#language').click(); assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
    assert.equal(await page.locator('#encrypt').textContent(), 'Prepare message');
    assert.match(await page.locator('#error').textContent(), /too long/);
    // At 200% text size on an already narrow viewport, content must reflow.
    await page.locator('html').evaluate((node) => { node.style.fontSize = '40px'; });
    await noOverflow(); await page.screenshot({ path: 'test-results/simple-write-200-percent.png', fullPage: true });
    await page.locator('#clear').click(); await noOverflow();
  } finally { await browser.close(); }
});

if (channels.includes('chrome') && channels.includes('msedge')) test('downloaded private file exchanges messages and replies Chrome ↔ Edge', { timeout: 60_000 }, async () => {
  const chrome = await chromium.launch({ channel: 'chrome', headless: true });
  const edge = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const alice = await (await chrome.newContext({ offline: true })).newPage(); const bob = await (await edge.newContext({ offline: true })).newPage();
    const cleanAlice = observe(alice); const cleanBob = observe(bob);
    const file = await createFile(alice); await openFile(alice, file); await openFile(bob, file);
    const cover = await write(alice, 'از کروم 👋'); assert.equal(await read(bob, cover), 'از کروم 👋');
    await bob.locator('#reply').click(); const reply = await write(bob, 'از اج ✓', false);
    await alice.locator('#clear').click(); assert.equal(await read(alice, reply), 'از اج ✓');
    cleanAlice(); cleanBob();
  } finally { await chrome.close(); await edge.close(); }
});

for (const channel of channels) test(`${channel}: unlock recovery, Unicode, visibility, navigation, font and desktop timing`, { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ channel, headless: true });
  try {
    const context = await browser.newContext({ offline: true }); const page = await context.newPage(); const clean = observe(page);
    const password = 'باغ ماه رودخانه 👋 café آسمان ۷';
    await page.goto(fileUrl); await page.locator('#setup-panel').waitFor({ state: 'visible' });
    await page.locator('#setup-passphrase').fill('1234'); await page.locator('#generate').click();
    await page.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#download-panel').isHidden(), true);
    await page.locator('#setup-passphrase').fill(password);
    await page.locator('#setup-show').click();
    assert.equal(await page.locator('#setup-passphrase').getAttribute('type'), 'text');
    assert.equal(await page.locator('#setup-show').getAttribute('aria-pressed'), 'true');
    const file = await saveDownload(page, () => page.locator('#setup-passphrase').press('Enter'));
    assert.ok(!file.html.includes(password));
    assert.equal(await page.locator('#setup-passphrase').inputValue(), '');
    await page.goto(file.url); await page.locator('#unlock-panel').waitFor({ state: 'visible' });
    await assertEmbeddedTypeface(page, '#unlock-heading');
    await page.locator('#unlock-passphrase').fill('incorrect'); await page.locator('#unlock').click();
    await page.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#conversation').isHidden(), true);
    assert.equal(await page.locator('#unlock-passphrase').inputValue(), '');
    await unlockFile(page, password.normalize('NFD'));
    // Actual second tab + focus/visibility events must preserve the live key.
    const other = await context.newPage(); await other.bringToFront();
    await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('blur')); });
    await page.bringToFront();
    const cover = await write(page, 'unlocked after switching'); await page.locator('#clear').click();
    assert.equal(await read(page, cover), 'unlocked after switching');
    await page.goto(fileUrl); await page.goBack();
    await page.locator('#unlock-panel').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#conversation').isHidden(), true);
    assert.equal(await page.locator('#plaintext').textContent(), '');
    // Timed inside the browser: submit dispatch to visible conversation, five runs.
    const timings = [];
    for (let i = 0; i < 5; i++) {
      await page.reload(); await page.locator('#unlock-panel').waitFor({ state: 'visible' });
      await page.locator('#unlock-passphrase').fill(password);
      timings.push(await page.evaluate(() => new Promise((done) => {
        const start = performance.now();
        const observer = new MutationObserver(() => {
          if (!document.getElementById('conversation').hidden) { observer.disconnect(); done(Math.round(performance.now() - start)); }
        });
        observer.observe(document.getElementById('conversation'), { attributes: true });
        document.getElementById('unlock-form').requestSubmit();
      })));
    }
    const record = { channel, version: browser.version(), iterations: 600000, runsMs: timings, medianMs: [...timings].sort((a, b) => a - b)[2], device: 'Windows desktop; headless; not Android' };
    await writeFile(`test-results/unlock-timing-${channel}.json`, JSON.stringify(record, null, 2));
    console.log(JSON.stringify(record));
    clean();
  } finally { await browser.close(); }
});

test('legacy HTML is imported only as data; original messages survive and no raw key enters export', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ channel: channels[0], headless: true });
  try {
    const page = await (await browser.newContext({ offline: true })).newPage(); const clean = observe(page);
    const pair = await createPair(); const code = pair.code.replace(/[\s-]/g, '');
    const released = execFileSync('git', ['show', 'v0.3.0:bodo-pech-pech.html'], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
    const old = released.replace('<meta name="bpp-conversation" content="">', `<meta name="bpp-conversation" content="${code}">`)
      .replace('<body>', '<body><script>globalThis.legacyExecuted=true</script><img src="https://invalid.example/should-not-load">');
    await page.goto(fileUrl); await page.locator('#setup-panel').waitFor({ state: 'visible' });
    await page.locator('#setup-passphrase').fill(passphrase);
    await page.locator('#legacy-setup').evaluate((node) => { node.open = true; });
    await page.locator('#import-file').setInputFiles({ name: 'old-private.html', mimeType: 'text/html', buffer: Buffer.from(old) });
    const file = await saveDownload(page, () => page.locator('#import').click());
    assert.ok(!file.html.includes(code) && !file.html.includes(code.slice(4, 68)) && !file.html.includes(passphrase));
    assert.equal(await page.evaluate(() => globalThis.legacyExecuted), undefined);
    await openFile(page, file);
    const cover = encodeCover(await encryptBytes(pair.key, textToBytes('preserved legacy key 👋'), 0));
    assert.equal(await read(page, cover), 'preserved legacy key 👋');
    clean();
  } finally { await browser.close(); }
});

test('edited input and page abandonment invalidate delayed KDF results without concurrent derivations', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ channel: channels[0], headless: true });
  try {
    const page = await (await browser.newContext({ offline: true })).newPage();
    const file = await createFile(page);
    const holdKdf = () => page.evaluate(() => {
      const original = crypto.subtle.deriveKey.bind(crypto.subtle); globalThis.kdfCalls = 0;
      crypto.subtle.deriveKey = async (...args) => {
        globalThis.kdfCalls++;
        const result = await original(...args);
        await new Promise((release) => { globalThis.releaseKdf = release; });
        crypto.subtle.deriveKey = original; return result;
      };
    });
    for (const abandon of [false, true]) {
      await page.goto(file.url); await page.locator('#unlock-panel').waitFor({ state: 'visible' }); await holdKdf();
      await page.locator('#unlock-passphrase').fill(passphrase); await page.locator('#unlock').click();
      await page.waitForFunction(() => !!globalThis.releaseKdf);
      if (abandon) await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
      else await page.locator('#unlock-passphrase').fill('changed while pending');
      await page.locator('#unlock-form').evaluate((form) => form.requestSubmit());
      assert.equal(await page.evaluate(() => globalThis.kdfCalls), 1);
      await page.evaluate(() => globalThis.releaseKdf());
      await page.waitForFunction(() => !document.getElementById('unlock').disabled);
      assert.equal(await page.locator('#conversation').isHidden(), true);
      if (abandon) await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      await unlockFile(page);
    }
    await page.goto(fileUrl); await page.locator('#setup-panel').waitFor({ state: 'visible' }); await holdKdf();
    await page.locator('#setup-passphrase').fill(passphrase); await page.locator('#generate').click();
    await page.waitForFunction(() => !!globalThis.releaseKdf);
    await page.locator('#generate-passphrase').click();
    await page.evaluate(() => globalThis.releaseKdf());
    await page.waitForFunction(() => !document.getElementById('generate').disabled);
    assert.equal(await page.locator('#download-panel').isHidden(), true);
  } finally { await browser.close(); }
});

test('setup and unlock reflow at 320px and 200% text with accessible Show/Hide', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ channel: channels[0], headless: true });
  try {
    const page = await (await browser.newContext({ offline: true, viewport: { width: 320, height: 640 } })).newPage();
    const file = await createFile(page);
    for (const [url, panel, prefix] of [[fileUrl, 'setup-panel', 'setup'], [file.url, 'unlock-panel', 'unlock']]) {
      await page.goto(url); await page.locator(`#${panel}`).waitFor({ state: 'visible' });
      await page.locator('#language').click();
      for (const size of ['20px', '40px']) {
        await page.locator('html').evaluate((node, fontSize) => { node.style.fontSize = fontSize; }, size);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        for (const id of [`${prefix}-show`, prefix === 'setup' ? 'generate' : 'unlock']) assert.ok((await page.locator(`#${id}`).boundingBox()).height >= 48);
        if (prefix === 'setup') assert.ok((await page.locator('#generate-passphrase').boundingBox()).height >= 48);
      }
      await page.locator(`#${prefix}-show`).click();
      assert.equal(await page.locator(`#${prefix}-show`).textContent(), 'Hide');
      assert.equal(await page.locator(`#${prefix}-show`).getAttribute('aria-controls'), `${prefix}-passphrase`);
      await page.locator('#language').click();
      assert.equal(await page.locator(`#${prefix}-show`).textContent(), 'پنهان');
      await page.locator(`#${prefix}-show`).click();
      assert.equal(await page.locator(`#${prefix}-passphrase`).getAttribute('type'), 'password');
    }
  } finally { await browser.close(); }
});

test('Generate only fills the editable setup field, preserves legacy selection and works end-to-end', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ channel: channels[0], headless: true });
  try {
    const page = await (await browser.newContext({ offline: true })).newPage(); const clean = observe(page);
    const pair = await createPair(); const code = pair.code.replace(/[\s-]/g, '');
    const old = `<html><head><meta name="bpp-conversation" content="${code}"><style></style></head></html>`;
    let downloads = 0; page.on('download', () => { downloads++; });
    await page.goto(fileUrl); await page.locator('#setup-panel').waitFor({ state: 'visible' });
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { globalThis.unwantedCopy = true; } } }));
    await page.locator('#legacy-setup').evaluate((node) => { node.open = true; });
    await page.locator('#import-code').fill(pair.code);
    await page.locator('#import-file').setInputFiles({ name: 'old-private.html', mimeType: 'text/html', buffer: Buffer.from(old) });
    await page.locator('#generate-passphrase').click();
    const generated = await page.locator('#setup-passphrase').inputValue();
    assert.equal(generated.length, 16); validateNewPassphrase(generated);
    assert.equal(await page.locator('#setup-passphrase').getAttribute('type'), 'text');
    assert.equal(await page.locator('#setup-show').getAttribute('aria-pressed'), 'true');
    assert.ok(await page.locator('#import-code').inputValue() === pair.code);
    assert.equal(await page.locator('#import-file').evaluate((input) => input.files.length), 1);
    assert.equal(await page.evaluate(() => globalThis.unwantedCopy), undefined);
    assert.equal(downloads, 0); assert.equal(await page.locator('#download-panel').isHidden(), true);
    // Ordinary editing stays possible; use the generated value for this migration.
    await page.locator('#setup-passphrase').fill(generated + 'x'); await page.locator('#setup-passphrase').fill(generated);
    await page.locator('#import-code').fill('');
    const file = await saveDownload(page, () => page.locator('#import').click());
    assert.equal(downloads, 1); assert.ok(!file.html.includes(generated));
    await page.goto(file.url); await unlockFile(page, generated);
    assert.equal(await read(page, encodeCover(await encryptBytes(pair.key, textToBytes('generator preserved the old conversation'), 0))), 'generator preserved the old conversation');
    assert.equal(await page.locator('#unlock-form #generate-passphrase').count(), 0);
    clean();
  } finally { await browser.close(); }
});

for (const channel of channels) test(`${channel}: monochrome brand and live system themes survive export, unlock and narrow layouts`, { timeout: 45_000 }, async () => {
  const browser = await chromium.launch({ channel, headless: true });
  const rgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
  const luminance = (value) => rgb(value).map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  const checkTheme = async (page, theme) => {
    const colors = await page.evaluate(() => {
      const styles = (selector) => getComputedStyle(document.querySelector(selector));
      return {
        page: styles('html').backgroundColor, surface: styles('main').backgroundColor,
        ink: styles('h1').color, muted: styles('.hint').color,
        primary: styles('#generate').backgroundColor, primaryInk: styles('#generate').color,
        fieldLine: styles('#setup-passphrase').borderColor, field: styles('#setup-passphrase').backgroundColor,
        error: styles('#error').color, errorSurface: styles('#error').backgroundColor,
        focus: styles('html').getPropertyValue('--focus').trim(),
      };
    });
    for (const [name, value] of Object.entries(colors)) {
      if (name === 'focus') continue;
      const components = rgb(value); assert.ok(components.every((v) => v === components[0]), `${name} must be monochrome`);
    }
    assert.equal(colors.page, theme === 'dark' ? 'rgb(16, 16, 16)' : 'rgb(244, 244, 244)');
    for (const [foreground, background] of [[colors.ink, colors.surface], [colors.muted, colors.surface], [colors.primaryInk, colors.primary], [colors.error, colors.errorSurface]]) assert.ok(contrast(foreground, background) >= 4.5);
    assert.ok(contrast(colors.fieldLine, colors.field) >= 3);
    return colors;
  };
  try {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ offline: true, colorScheme: theme, viewport: { width: 390, height: 844 } });
      const page = await context.newPage(); const clean = observe(page);
      await page.goto(fileUrl); await page.locator('#setup-panel').waitFor({ state: 'visible' });
      assert.equal(await page.locator('h1').textContent(), 'بدو پچ پچ');
      assert.equal(await page.title(), 'BodoPechPech · بدو پچ پچ');
      await checkTheme(page, theme);
      await page.locator('#setup-passphrase').focus();
      assert.equal(await page.locator('#setup-passphrase').evaluate((node) => getComputedStyle(node).outlineStyle), 'solid');
      await page.locator('#generate').click(); await page.locator('#error').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#error').getAttribute('role'), 'alert');
      assert.equal(await page.locator('#error').evaluate((node) => getComputedStyle(node).borderInlineStartWidth), '4px');
      const file = await createFile(page);
      assert.ok(file.html.includes('prefers-color-scheme:dark'));
      await page.goto(file.url); await page.locator('#unlock-panel').waitFor({ state: 'visible' });
      await checkTheme(page, theme); await unlockFile(page);
      await assertEmbeddedTypeface(page, 'h1');
      await page.locator('#language').click(); assert.equal(await page.locator('h1').textContent(), 'BodoPechPech');
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        for (const fontSize of ['20px', '40px']) {
          await page.locator('html').evaluate((node, value) => { node.style.fontSize = value; }, fontSize);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        }
      }
      await page.locator('html').evaluate((node) => { node.style.fontSize = ''; });
      const cover = await write(page, 'ظاهر تازه، همان پیام 👋'); await page.locator('#clear').click();
      const opposite = theme === 'dark' ? 'light' : 'dark'; await page.emulateMedia({ colorScheme: opposite });
      await checkTheme(page, opposite);
      assert.equal(await page.locator('#conversation').isVisible(), true);
      assert.equal(await read(page, cover), 'ظاهر تازه، همان پیام 👋');
      clean(); await context.close();
    }
  } finally { await browser.close(); }
});
