import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { chromium } from 'playwright';
import { encryptBytes, importPair, textToBytes } from '../src/crypto.ts';
import { encodeCover } from '../src/codec.ts';
import { PROFILE_OPENERS } from '../src/dialogue-data.ts';

const fileUrl = pathToFileURL(resolve('bodo-pech-pech.html')).href;
const channels = (process.env.BROWSER_CHANNELS || 'chrome,msedge').split(',');

test('clearing during encryption cannot restore a key or message when it finishes', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ channel: channels[0], headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(fileUrl);
    await newPair(page);
    // Delay the real browser crypto result to exercise session cancellation.
    await page.evaluate(() => {
      const nativeEncrypt = crypto.subtle.encrypt.bind(crypto.subtle);
      crypto.subtle.encrypt = async (...args) => {
        const encrypted = await nativeEncrypt(...args);
        await new Promise((release) => { globalThis.releaseEncryption = release; });
        return encrypted;
      };
    });
    await page.locator('#message').fill('must disappear');
    await page.locator('#encrypt').click();
    await page.waitForFunction(() => !!globalThis.releaseEncryption);
    await page.locator('#clear').click();
    await page.evaluate(async () => {
      globalThis.releaseEncryption();
      await new Promise((done) => setTimeout(done, 0));
    });
    assert.equal(await page.locator('#cover-result').isHidden(), true);
    assert.equal(await page.locator('#cover').inputValue(), '');
    assert.equal(await page.locator('#message').inputValue(), '');
    assert.equal(await page.locator('#pair-state').textContent(), 'Not connected');
    assert.equal(await page.locator('#encrypt').isDisabled(), true);
  } finally { await browser.close(); }
});

async function newPair(page, code) {
  await page.waitForFunction(() => !document.querySelector('#generate').disabled);
  if (code) {
    await page.locator('#import-code').fill(code);
    await page.locator('#import').click();
  } else await page.locator('#generate').click();
  await page.locator('#verify-panel').waitFor({ state: 'visible' });
  const createdCode = await page.locator('#setup-code').inputValue();
  const fingerprint = await page.locator('#fingerprint').textContent();
  assert.equal(await page.locator('#encrypt').isDisabled(), true);
  await page.locator('#verified').check();
  await page.locator('#confirm').click();
  assert.equal(await page.locator('#setup-code').inputValue(), '');
  assert.equal(await page.locator('#import-code').inputValue(), '');
  return { code: createdCode || code, fingerprint };
}

for (const channel of channels) {
  test(`${channel}: two isolated peers work from file:// while offline`, { timeout: 60_000 }, async () => {
    const browser = await chromium.launch({ channel, headless: true });
    try {
      console.log(`${channel} ${browser.version()}: ${fileUrl}`);
      const aliceContext = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
      const bobContext = await browser.newContext();
      await aliceContext.setOffline(true);
      await bobContext.setOffline(true);
      const alice = await aliceContext.newPage();
      const bob = await bobContext.newPage();
      const errors = [];
      const network = [];
      for (const page of [alice, bob]) {
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('request', (request) => { if (/^https?:/.test(request.url())) network.push(request.url()); });
        await page.goto(fileUrl);
        assert.equal(await page.evaluate(() => location.protocol), 'file:');
        assert.equal(await page.evaluate(() => isSecureContext && !!crypto.subtle), true);
        assert.equal(await page.evaluate(() => navigator.onLine), false);
      }
      const first = await newPair(alice);
      const second = await newPair(bob, first.code);
      assert.equal(first.fingerprint, second.fingerprint);
      const legacyPair = await importPair(first.code);
      const legacyCover = encodeCover(await encryptBytes(legacyPair.key, textToBytes('پیام قدیمی 👋\r\n'), 1));
      await bob.locator('#receive-mode').click();
      await bob.locator('#received').fill(legacyCover);
      await bob.locator('#decrypt').click();
      await bob.locator('#plain-result').waitFor({ state: 'visible' });
      assert.equal(await bob.locator('#plaintext').textContent(), 'پیام قدیمی 👋\r\n');
      const message = '\uFEFF  سلام 👋\nمی‌خواهم دقیق بماند. e\u0301\n<img src=x onerror=alert(1)>  ';
      await alice.locator('#message').fill(message);
      await alice.locator('#context-details').evaluate((details) => { details.open = true; });
      await alice.locator('#context').fill('چای و کیک چطوره؟');
      await alice.locator('#encrypt').click();
      await alice.locator('#cover-result').waitFor({ state: 'visible' });
      const cover = await alice.locator('#cover').inputValue();
      assert.ok(PROFILE_OPENERS[8].some((opener) => cover.startsWith(opener)));
      assert.match(await alice.locator('#cover-stats').textContent(), /Tea and a snack.*Respond to a question/);
      assert.ok(!cover.includes('onerror'));
      await alice.locator('#copy-cover').click();
      await alice.waitForFunction(() => /Copied|selected/.test(document.querySelector('#feedback').textContent));
      await bob.locator('#receive-mode').click();
      const pastedCover = cover.replace(/ی/g, 'ي').replace(/ک/g, 'ك').replace(/ /g, '\n');
      await bob.locator('#received').fill(pastedCover);
      await bob.locator('#decrypt').click();
      await bob.locator('#plain-result').waitFor({ state: 'visible' });
      assert.equal(await bob.locator('#plaintext').textContent(), message);
      assert.equal(await bob.locator('#plaintext img').count(), 0);
      await bob.locator('#reply').click();
      assert.equal(await bob.locator('#context').inputValue(), pastedCover);
      await bob.locator('#message').fill('حتما، تا بعد 👋');
      await bob.locator('#encrypt').click();
      await bob.locator('#cover-result').waitFor({ state: 'visible' });
      const reply = await bob.locator('#cover').inputValue();
      assert.ok(PROFILE_OPENERS[5].some((opener) => reply.startsWith(opener)));
      await alice.locator('#receive-mode').click();
      await alice.locator('#received').fill(reply);
      await alice.locator('#decrypt').click();
      await alice.locator('#plain-result').waitFor({ state: 'visible' });
      assert.equal(await alice.locator('#plaintext').textContent(), 'حتما، تا بعد 👋');
      await alice.locator('#received').fill(reply.slice(0, -20));
      assert.equal(await alice.locator('#plaintext').textContent(), '');
      await alice.locator('#decrypt').click();
      await alice.locator('#error').waitFor({ state: 'visible' });
      assert.equal(await alice.locator('#plain-result').isHidden(), true);
      // Replacing the pair invalidates a previously valid message.
      await bob.locator('#clear').click();
      await newPair(bob);
      await bob.locator('#receive-mode').click();
      await bob.locator('#received').fill(cover);
      await bob.locator('#decrypt').click();
      await bob.locator('#error').waitFor({ state: 'visible' });
      assert.match(await bob.locator('#error').textContent(), /Authentication failed/);
      assert.equal(await bob.locator('#plaintext').textContent(), '');
      // Current result must disappear as soon as its source changes.
      await alice.locator('#send-mode').click();
      await alice.locator('#message').fill('A changed draft');
      assert.equal(await alice.locator('#cover').inputValue(), '');
      await alice.locator('#encrypt').click();
      await alice.locator('#cover-result').waitFor({ state: 'visible' });
      await alice.locator('#context-details').evaluate((details) => { details.open = true; });
      await alice.locator('#act').selectOption('4');
      assert.equal(await alice.locator('#cover').inputValue(), '');
      await alice.locator('#encrypt').click();
      await alice.locator('#cover-result').waitFor({ state: 'visible' });
      assert.match(await alice.locator('#cover-stats').textContent(), /Acknowledge/);
      await mkdir('test-results', { recursive: true });
      await alice.screenshot({ path: `test-results/${channel}-desktop.png`, fullPage: true });
      await alice.setViewportSize({ width: 390, height: 844 });
      assert.equal(await alice.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await alice.screenshot({ path: `test-results/${channel}-mobile-width.png`, fullPage: true });
      await alice.locator('#clear').click();
      assert.equal(await alice.locator('#message').inputValue(), '');
      assert.equal(await alice.locator('#context').inputValue(), '');
      assert.equal(await alice.locator('#cover').inputValue(), '');
      assert.equal(await alice.locator('#received').inputValue(), '');
      assert.equal(await alice.locator('#encrypt').isDisabled(), true);
      await alice.reload();
      await alice.waitForFunction(() => !document.querySelector('#generate').disabled);
      assert.equal(await alice.locator('#pair-state').textContent(), 'Not connected');
      assert.equal(await alice.evaluate(() => localStorage.length + sessionStorage.length), 0);
      assert.deepEqual(network, []);
      assert.deepEqual(errors, []);
      console.log(`${channel}: offline load, setup, Unicode exchange, reply, copy, wrong-key rejection, truncation, clear/reload and mobile width passed; 0 HTTP requests.`);
    } finally { await browser.close(); }
  });
}

test('saved file exchanges v2 messages in both directions between Chrome and Edge', { timeout: 60_000 }, async () => {
  if (!channels.includes('msedge')) return;
  const chrome = await chromium.launch({ channel: 'chrome', headless: true });
  const edge = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const a = await (await chrome.newContext({ offline: true })).newPage();
    const b = await (await edge.newContext({ offline: true })).newPage();
    await Promise.all([a.goto(fileUrl), b.goto(fileUrl)]);
    const first = await newPair(a);
    await newPair(b, first.code);
    for (const [sender, receiver, message] of [[a, b, 'سلام، فردا ساعت پنج همدیگر را ببینیم.'], [b, a, '\uFEFFدقیق 👋 e\u0301\n ي ك']]) {
      await sender.locator('#send-mode').click();
      await sender.locator('#message').fill(message);
      await sender.locator('#encrypt').click();
      await sender.locator('#cover-result').waitFor({ state: 'visible' });
      const cover = await sender.locator('#cover').inputValue();
      await receiver.locator('#receive-mode').click();
      await receiver.locator('#received').fill(cover);
      await receiver.locator('#decrypt').click();
      await receiver.locator('#plain-result').waitFor({ state: 'visible' });
      assert.equal(await receiver.locator('#plaintext').textContent(), message);
    }
  } finally { await chrome.close(); await edge.close(); }
});

test('unsupported crypto fails closed; denied clipboard offers manual selection', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ channel: channels[0], headless: true });
  try {
    const unavailable = await browser.newContext();
    await unavailable.addInitScript(() => Object.defineProperty(globalThis, 'isSecureContext', { value: false }));
    const page = await unavailable.newPage();
    await page.goto(fileUrl);
    await page.waitForFunction(() => document.querySelector('#capability').textContent.includes('Cannot use encryption'));
    assert.equal(await page.locator('#generate').isDisabled(), true);
    const deniedClipboard = await browser.newContext();
    await deniedClipboard.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined }));
    const second = await deniedClipboard.newPage();
    await second.goto(fileUrl);
    await newPair(second);
    await second.locator('#message').fill('manual copy test');
    await second.locator('#encrypt').click();
    await second.locator('#cover-result').waitFor({ state: 'visible' });
    await second.locator('#copy-cover').click();
    assert.match(await second.locator('#feedback').textContent(), /text is selected/);
    assert.equal(await second.locator('#cover').evaluate((field) => field.selectionEnd - field.selectionStart === field.value.length), true);
  } finally { await browser.close(); }
});

test('portable file still passes CSP after Windows line-ending conversion', { timeout: 30_000 }, async () => {
  await mkdir('test-results', { recursive: true });
  const html = await readFile('bodo-pech-pech.html', 'utf8');
  const destination = resolve('test-results/windows-line-endings.html');
  await writeFile(destination, html.replace(/\r?\n/g, '\r\n'));
  const browser = await chromium.launch({ channel: channels[0], headless: true });
  try {
    const context = await browser.newContext({ offline: true });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (entry) => { if (entry.type() === 'error') errors.push(entry.text()); });
    await page.goto(pathToFileURL(destination).href);
    await page.waitForFunction(() => !document.querySelector('#generate').disabled);
    assert.equal(await page.locator('main').evaluate((node) => getComputedStyle(node).display), 'grid');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
