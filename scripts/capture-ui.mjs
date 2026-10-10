import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const output = resolve(process.argv[2] || 'work/ui-preview');
const scratchRoot = resolve('work');
await mkdir(output, { recursive: true });
await mkdir(scratchRoot, { recursive: true });
const scratch = await mkdtemp(resolve(scratchRoot, 'visual-private-'));
if (dirname(scratch) !== scratchRoot) throw new Error('Scratch path is outside the owned root');
const genericUrl = pathToFileURL(resolve('bodo-pech-pech.html')).href;
const records = [];

try {
  for (const channel of ['chrome', 'msedge']) {
    const browser = await chromium.launch({ channel, headless: true });
    try {
      const context = await browser.newContext({ offline: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (entry) => { if (entry.type() === 'error') errors.push(entry.text()); });
      page.on('request', (request) => { if (/^https?:/.test(request.url())) errors.push('Unexpected HTTP request'); });
      for (const [size, viewport] of [['desktop', { width: 1360, height: 1040 }], ['mobile', { width: 390, height: 844 }]]) {
        await page.setViewportSize(viewport);
        const shot = async (screen) => {
          await page.evaluate(() => document.fonts.ready);
          const name = `${channel}-${size}-${screen}.png`;
          await page.screenshot({ path: resolve(output, name), fullPage: true });
          records.push({ channel, version: browser.version(), viewport, screen, path: name });
        };
        await page.goto(genericUrl);
        await page.locator('#setup-panel').waitFor({ state: 'visible' });
        await shot('setup');
        const pending = page.waitForEvent('download');
        await page.locator('#generate').click();
        const download = await pending;
        const file = resolve(scratch, `${channel}-${size}.html`);
        await download.saveAs(file);
        await shot('download');
        await page.goto(pathToFileURL(file).href);
        await page.locator('#conversation').waitFor({ state: 'visible' });
        await shot('home');
        await page.locator('#send-mode').click();
        await shot('write');
        // Disposable visual-review text; never a real private conversation.
        await page.locator('#message').fill('سلام، فردا همدیگر را می‌بینیم.');
        await page.locator('#encrypt').click();
        await page.locator('#cover-result').waitFor({ state: 'visible' });
        await shot('cover');
        const cover = await page.locator('#cover').inputValue();
        await page.locator('#clear').click();
        await page.locator('#receive-mode').click();
        await shot('read');
        await page.locator('#received').fill(cover);
        await page.locator('#decrypt').click();
        await page.locator('#plain-result').waitFor({ state: 'visible' });
        await shot('opened');
        await page.locator('#clear').click();
        await page.locator('#language').click();
        await shot('home-english');
        await page.locator('#send-mode').focus();
        await shot('focus');
        if (size === 'mobile') {
          await page.locator('html').evaluate((node) => { node.style.fontSize = '40px'; });
          await shot('home-200-percent');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        }
      }
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
  await writeFile(resolve(output, 'screenshots.json'), JSON.stringify(records, null, 2));
  console.log(`Saved ${records.length} offline screenshots in ${output}`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
