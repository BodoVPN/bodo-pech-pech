import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const template = await readFile('src/index.html', 'utf8');
const css = await readFile('src/style.css', 'utf8');
const style = (await transform(css, { loader: 'css', minify: true })).code.replace(/\r\n?/g, '\n');
// An immutable build-time shell makes exports independent of the live page DOM.
const exportShell = template.replace('__STYLE__', () => style);
const result = await build({
  entryPoints: ['src/main.ts'], bundle: true, write: false, platform: 'browser',
  format: 'iife', target: ['es2023'], minify: true, legalComments: 'none',
  define: { __BPP_SHELL__: JSON.stringify(exportShell) },
});
// HTML parsing normalizes CRLF to LF before CSP hash verification.
const script = result.outputFiles[0].text.replace(/\r\n?/g, '\n').replace(/<\/script/gi, '<\\/script');
const hash = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
const csp = `default-src 'none'; script-src ${hash(script)}; style-src ${hash(style)}; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'`;
const html = template.replace('__CSP__', () => csp).replace('__STYLE__', () => style).replace('__SCRIPT__', () => script);
await writeFile('bodo-pech-pech.html', html);
console.log(`Built bodo-pech-pech.html (${Buffer.byteLength(html).toLocaleString()} bytes). Open it directly in a browser.`);
