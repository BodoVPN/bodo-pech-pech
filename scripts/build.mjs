import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

const font = await readFile('assets/fonts/vazirmatn/Vazirmatn-Variable.woff2');
const license = await readFile('assets/fonts/vazirmatn/OFL.txt', 'utf8');
const notices = await readFile('THIRD_PARTY_NOTICES.txt', 'utf8');
const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const attribution = `<template id="font-license"><pre>Vazirmatn v33.003 — Saber Rastikerdar\nSource: https://github.com/rastikerdar/vazirmatn/tree/v33.003\nOriginal variable WOFF2, unmodified.\n\n${escapeHtml(license)}</pre></template>`;
const template = (await readFile('src/index.html', 'utf8')).replace('__FONT_LICENSE__', () => `${attribution}\n<template id="ui-licenses"><pre>${escapeHtml(notices)}</pre></template>`);
const css = (await readFile('src/style.css', 'utf8')).replace('__FONT_DATA__', () => font.toString('base64'));
const compiled = await postcss([tailwindcss()]).process(css, { from: 'src/style.css' });
const style = (await transform(compiled.css, { loader: 'css', minify: true })).code.replace(/\r\n?/g, '\n');
// An immutable build-time shell makes exports independent of the live page DOM.
const exportShell = template.replace('__STYLE__', () => style);
const result = await build({
  entryPoints: ['src/main.tsx'], bundle: true, write: false, platform: 'browser',
  format: 'iife', target: ['es2023'], minify: true, legalComments: 'none',
  define: { __BPP_SHELL__: JSON.stringify(exportShell), 'process.env.NODE_ENV': '"production"' },
});
// HTML parsing normalizes CRLF to LF before CSP hash verification.
const script = result.outputFiles[0].text.replace(/\r\n?/g, '\n').replace(/<\/script/gi, '<\\/script');
const hash = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
const csp = `default-src 'none'; script-src ${hash(script)}; style-src ${hash(style)}; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'`;
const html = template.replace('__CSP__', () => csp).replace('__STYLE__', () => style).replace('__SCRIPT__', () => script);
await writeFile('bodo-pech-pech.html', html);
console.log(`Built bodo-pech-pech.html (${Buffer.byteLength(html).toLocaleString()} bytes). Open it directly in a browser.`);
