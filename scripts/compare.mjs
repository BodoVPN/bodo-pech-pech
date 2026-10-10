import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const run = promisify(execFile);
const baselineCommit = 'bd94d30eaeb161713d46e16ee37f5c95416325e4';
const dialogueCommit = 'c859a3badb2b193ff4e930fa9361b23a1ebf4cd2';
const directory = 'work/comparison';
await mkdir(directory, { recursive: true });
const { stdout } = await run('git', ['show', `${baselineCommit}:bodo-pech-pech.html`], { encoding: 'buffer' });
await writeFile(`${directory}/baseline-v1.html`, stdout);
const dialogue = await run('git', ['show', `${dialogueCommit}:bodo-pech-pech.html`], { encoding: 'buffer' });
await writeFile(`${directory}/baseline-v2.html`, dialogue.stdout);
const scenarios = [
  { name: 'Greeting', message: 'سلام', context: 'سلام، خوبی؟' },
  { name: 'Tea invitation / 67-byte reference', message: 'سلام، فردا ساعت پنج همدیگر را ببینیم.', context: 'چای دم کردم، کیک هم داریم. میای؟' },
  { name: 'Walk invitation', message: 'من ده دقیقه دیرتر می‌رسم.', context: 'فردا عصر بریم پارک؟ هوا خوبه.' },
  { name: 'Work question', message: 'فایل را امشب برایت می‌فرستم.', context: 'کار پروژه چطوره؟ خسته شدی؟' },
  { name: 'Music question', message: 'بعد از شام با من تماس بگیر.', context: 'نظرت درباره این آهنگ آروم چیه؟' },
  { name: 'Travel continuation', message: 'بلیط برای پنج‌شنبه رزرو شد.', context: 'برای سفر کوتاه، مسیر خلوت رو دوست دارم.' },
  { name: 'Mixed exact Unicode', message: '\uFEFF  سلام 👋\ne\u0301 ي ك ‌ <tag>  ', context: 'باشه، ممنون که گفتی.' },
  { name: 'Maximum ASCII', message: 'a'.repeat(2048), context: 'چای دم کردم، میای؟' },
  { name: 'Maximum Persian bytes', message: 'س'.repeat(1024), context: 'چای دم کردم، میای؟' },
];
const report = { date: new Date().toISOString(), baselineCommit, dialogueCommit, repetitions: 10, scenarios, browsers: [] };
const distribution = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return { min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1), mean: values.reduce((a, b) => a + b, 0) / values.length };
};

for (const channel of ['chrome', 'msedge']) {
  const browser = await chromium.launch({ channel, headless: true });
  try {
    const result = { channel, version: browser.version(), builds: [] };
    for (const [name, path] of [['v1', `${directory}/baseline-v1.html`], ['v2', `${directory}/baseline-v2.html`]]) {
      const context = await browser.newContext({ offline: true });
      const page = await context.newPage();
      const network = []; const errors = [];
      page.on('request', (request) => { if (/^https?:/.test(request.url())) network.push(request.url()); });
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (event) => { if (event.type() === 'error') errors.push(event.text()); });
      await page.goto(pathToFileURL(resolve(path)).href);
      await page.waitForFunction(() => !document.querySelector('#generate').disabled);
      const startupMilliseconds = await page.evaluate(() => globalThis.performance.now());
      await page.locator('#generate').click();
      await page.locator('#verify-panel').waitFor({ state: 'visible' });
      await page.locator('#verified').check();
      await page.locator('#confirm').click();
      await page.locator('#context-details').evaluate((node) => { node.open = true; });
      await page.evaluate(() => {
        globalThis.benchTiming = {};
        document.addEventListener('submit', (event) => {
          const send = event.target.id === 'send-form';
          if (!send && event.target.id !== 'receive-form') return;
          const start = globalThis.performance.now();
          const target = document.getElementById(send ? 'cover-result' : 'plain-result');
          const observer = new window.MutationObserver(() => {
            if (target.hidden) return;
            globalThis.benchTiming[send ? 'send' : 'receive'] = globalThis.performance.now() - start;
            observer.disconnect();
          });
          observer.observe(target, { attributes: true, attributeFilter: ['hidden'] });
        }, true);
      });
      const rows = [];
      for (const scenario of scenarios) {
        const samples = [];
        for (let iteration = 0; iteration < report.repetitions; iteration++) {
          await page.locator('#send-mode').click();
          await page.locator('#message').fill(scenario.message);
          await page.locator('#context').fill(scenario.context);
          await page.locator('#encrypt').click();
          await page.locator('#cover-result').waitFor({ state: 'visible' });
          const cover = await page.locator('#cover').inputValue();
          await page.locator('#receive-mode').click();
          await page.locator('#received').fill(cover);
          await page.locator('#decrypt').click();
          await page.locator('#plain-result').waitFor({ state: 'visible' });
          assert.equal(await page.locator('#plaintext').textContent(), scenario.message);
          samples.push({ characters: cover.length, ...await page.evaluate(() => globalThis.benchTiming), ...(iteration === 0 && Buffer.byteLength(scenario.message) < 1000 ? { cover } : {}) });
        }
        const row = { name: scenario.name, bytes: Buffer.byteLength(scenario.message), characters: distribution(samples.map((s) => s.characters)), sendMilliseconds: distribution(samples.map((s) => s.send)), receiveMilliseconds: distribution(samples.map((s) => s.receive)), exact: samples.length, samples };
        rows.push(row);
        console.log(JSON.stringify({ channel, build: name, case: scenario.name, characters: row.characters, sendMs: row.sendMilliseconds.median }));
      }
      const session = await context.newCDPSession(page);
      const heap = await session.send('Runtime.getHeapUsage');
      const dom = await session.send('Memory.getDOMCounters');
      await page.locator('#clear').click();
      await session.send('HeapProfiler.collectGarbage');
      const clearedHeap = await session.send('Runtime.getHeapUsage');
      const clearedDom = await session.send('Memory.getDOMCounters');
      assert.deepEqual(network, []); assert.deepEqual(errors, []);
      const html = await readFile(path);
      result.builds.push({ name, htmlBytes: html.length, sha256: createHash('sha256').update(html).digest('hex'), startupMilliseconds, heapAfterWorkload: heap, domAfterWorkload: dom, heapAfterClearAndCollection: clearedHeap, domAfterClearAndCollection: clearedDom, network, errors, rows });
      await context.close();
    }
    report.browsers.push(result);
    await writeFile(`${directory}/measurements.json`, JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
}
console.log(`Saved ${directory}/measurements.json`);
