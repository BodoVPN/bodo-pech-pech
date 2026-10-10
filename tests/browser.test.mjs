import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test, { after } from 'node:test';
import { chromium } from 'playwright';
import { createPair, encryptBytes, encryptBytesV2, importPair, textToBytes } from '../src/crypto.ts';
import { encodeCover } from '../src/codec.ts';
import { decodeMessageCover, encodeDialogue } from '../src/dialogue.ts';

const fileUrl = pathToFileURL(resolve('bodo-pech-pech.html')).href;
const channels = (process.env.BROWSER_CHANNELS || 'chrome,msedge').split(',');
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
  if (code) {
    await page.locator('#legacy-setup').evaluate((node) => { node.open = true; });
    await page.locator('#import-code').fill(code);
  }
  return saveDownload(page, () => page.locator(code ? '#import' : '#generate').click());
}
async function openFile(page, file) {
  await page.goto(file.url);
  await page.locator('#conversation').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#setup-panel').isHidden(), true);
  assert.equal(await page.locator('html').getAttribute('lang'), 'fa');
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
  const code = /<meta name="bpp-conversation" content="(BPP1[A-F0-9]{72})">/.exec(file.html)?.[1];
  assert.ok(code, 'A private download contains one valid restricted-format key slot');
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
    await alice.locator('#conversation').waitFor({ state: 'visible' });
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
    const pair = await importPair(codeOf(file));
    const { decryptBytes, bytesToText } = await import('../src/crypto.ts');
    assert.equal(bytesToText(await decryptBytes(pair.key, decodeMessageCover(next))), 'still paired');
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
    await page.locator('#generate').click(); await page.locator('#error').waitFor({ state: 'visible' });
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
