import { bytesToText, createPair, decryptBytes, encryptBytesV2, importPair, MAX_MESSAGE_BYTES, textToBytes } from './crypto.ts';
import { chooseProfile, decodeMessageCover, encodeDialogue } from './dialogue.ts';
import { personalFile } from './personal-file.ts';

declare const __BPP_SHELL__: string;
const script = document.currentScript?.textContent ?? '';
const policy = document.querySelector<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy"]')?.content ?? '';
const pristine = __BPP_SHELL__.replace('__CSP__', () => policy).replace('__SCRIPT__', () => script);
function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing interface element: ${id}`);
  return found as T;
}
const area = (id: string) => el<HTMLTextAreaElement>(id);
const button = (id: string) => el<HTMLButtonElement>(id);
let english = false;
const translated = Array.from(document.querySelectorAll<HTMLElement>('[data-en]'), (node) => ({ node, fa: node.textContent ?? '' }));
const t = (fa: string, en: string): string => english ? en : fa;
let key: CryptoKey | undefined;
let supported = false;
let busy = false;
let revision = 0;
let replyContext = '';
let openedCover = '';
let downloadCode = '';
let downloadUrl = '';
let status: [string, string] = ['', ''];
let errorText: [string, string] = ['', ''];

function feedback(fa = '', en = ''): void {
  status = [fa, en];
  el('feedback').textContent = t(...status);
  el('error').hidden = true;
  el('error').textContent = '';
  errorText = ['', ''];
}
function fail(fa: string, en: string): void {
  errorText = [fa, en];
  el('error').textContent = t(fa, en);
  el('error').hidden = false;
  el('error').focus();
}
function buttons(): void {
  for (const id of ['generate', 'import']) button(id).disabled = !supported || busy;
  for (const id of ['encrypt', 'decrypt', 'paste-cover']) button(id).disabled = !key || busy;
  for (const id of ['copy-cover', 'copy-plain', 'reply']) button(id).disabled = busy;
}
function cancelPending(): void { revision++; busy = false; buttons(); }
async function run(operation: () => Promise<() => void>, error: [string, string]): Promise<void> {
  const token = ++revision;
  busy = true; feedback(); buttons();
  try {
    const apply = await operation();
    if (token === revision) apply();
  } catch {
    if (token === revision) fail(...error);
  } finally {
    if (token === revision) busy = false;
    buttons();
  }
}
function clearResults(): void {
  area('cover').value = '';
  el('plaintext').textContent = '';
  openedCover = '';
  el('cover-result').hidden = true;
  el('plain-result').hidden = true;
  el('send-form').hidden = false;
  el('receive-form').hidden = false;
}
function home(focus = true): void {
  cancelPending(); clearResults();
  area('message').value = ''; area('received').value = '';
  replyContext = '';
  el('home').hidden = false; el('message-screen').hidden = true;
  feedback();
  if (focus && key) el('home-heading').focus();
}
function mode(receive: boolean): void {
  cancelPending(); clearResults(); feedback();
  el('home').hidden = true; el('message-screen').hidden = false;
  el('send-panel').hidden = receive; el('receive-panel').hidden = !receive;
  area(receive ? 'received' : 'message').focus();
}
function makeDownload(code: string): void {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = URL.createObjectURL(new Blob([personalFile(pristine, code)], { type: 'text/html;charset=utf-8' }));
  el<HTMLAnchorElement>('download').href = downloadUrl;
}
function offerFile(code: string, fingerprint: string): void {
  makeDownload(code);
  downloadCode = code;
  const link = el<HTMLAnchorElement>('download');
  link.download = `pech-pech-private-${fingerprint.replaceAll(' ', '').slice(0, 8).toLowerCase()}.html`;
  el('setup-controls').hidden = true;
  el('download-panel').hidden = false;
  el<HTMLInputElement>('import-code').value = '';
  el('download-heading').focus();
  link.click();
}
button('generate').addEventListener('click', () => {
  if (!supported || busy || downloadCode) return;
  void run(async () => {
    const pair = await createPair();
    return () => offerFile(pair.code, pair.fingerprint);
  }, ['فایل ساخته نشد. دوباره امتحان کنید.', 'The file could not be created. Try again.']);
});
el('import-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!supported || busy || downloadCode) return;
  const code = el<HTMLInputElement>('import-code').value;
  void run(async () => {
    const pair = await importPair(code);
    return () => offerFile(code, pair.fingerprint);
  }, ['کد کامل نیست یا درست کپی نشده است. کد قبلی را دوباره بچسبانید.', 'That code is incomplete or incorrect. Paste the complete old setup code.']);
});
el('send-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!key || busy) return;
  const activeKey = key;
  const message = area('message').value;
  if (!message.length) { fail('اول پیام خود را بنویسید.', 'Write your message first.'); return; }
  if (new TextEncoder().encode(message).length > MAX_MESSAGE_BYTES) {
    fail('پیام طولانی است. آن را کوتاه‌تر کنید یا در چند پیام بفرستید.', 'This message is too long. Shorten it or send several smaller messages.'); return;
  }
  const profile = chooseProfile(replyContext);
  void run(async () => {
    const bytes = textToBytes(message);
    let packet: Uint8Array<ArrayBuffer>;
    try { packet = await encryptBytesV2(activeKey, bytes, profile); } finally { bytes.fill(0); }
    const cover = encodeDialogue(packet);
    return () => {
      area('cover').value = cover;
      // Context comes only from the public cover, never the private message.
      replyContext = cover;
      el('send-form').hidden = true; el('cover-result').hidden = false;
      el('cover-heading').focus();
    };
  }, ['پیام آماده نشد. نوشته را بررسی کنید و دوباره امتحان کنید.', 'The message could not be prepared. Check the text and try again.']);
});
el('receive-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!key || busy) return;
  const activeKey = key;
  const cover = area('received').value;
  if (!cover.trim()) { fail('اول پیام دریافتی را بچسبانید.', 'Paste the received message first.'); return; }
  clearResults();
  void run(async () => {
    const bytes = await decryptBytes(activeKey, decodeMessageCover(cover));
    let text: string;
    try { text = bytesToText(bytes); } finally { bytes.fill(0); }
    return () => {
      openedCover = cover;
      el('plaintext').textContent = text;
      el('receive-form').hidden = true; el('plain-result').hidden = false;
      el('plain-heading').focus();
    };
  }, ['پیام باز نشد. همهٔ متن را دوباره کپی کنید و فایل همین گفت‌وگو را باز کنید.', 'The message could not be opened. Copy all of it again and use the file for this conversation.']);
});
for (const id of ['message', 'received']) area(id).addEventListener('input', () => {
  cancelPending(); clearResults(); feedback();
});
async function copy(text: string, target: HTMLTextAreaElement | HTMLElement): Promise<void> {
  const token = revision;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    if (token === revision) feedback('کپی شد. حالا در پیام‌رسان بچسبانید.', 'Copied. Now paste it in your messenger.');
  } catch {
    if (token !== revision) return;
    target.focus();
    if (target instanceof HTMLTextAreaElement) target.select();
    else {
      const range = document.createRange(); range.selectNodeContents(target);
      window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range);
    }
    feedback('متن انتخاب شد. روی آن نگه دارید و «کپی» را بزنید؛ در رایانه Ctrl+C بزنید.', 'The text is selected. Long-press it and choose Copy, or press Ctrl+C on a computer.');
  }
}
button('copy-cover').addEventListener('click', () => { void copy(area('cover').value, area('cover')); });
button('copy-plain').addEventListener('click', () => { void copy(el('plaintext').textContent ?? '', el('plaintext')); });
button('paste-cover').addEventListener('click', () => {
  const token = revision;
  void (async () => {
    try {
      if (!navigator.clipboard?.readText) throw new Error('Clipboard unavailable');
      const text = await navigator.clipboard.readText();
      if (token !== revision) return;
      if (text.length > 180000) { fail('متن طولانی است. فقط یک پیام را کپی کنید.', 'That text is too long. Copy just one message.'); return; }
      area('received').value = text;
      cancelPending(); clearResults(); feedback();
      if (!text) feedback('چیزی کپی نشده است. اول پیام را از پیام‌رسان کپی کنید.', 'Nothing was copied. Copy the message from your messenger first.');
      area('received').focus();
    } catch {
      if (token !== revision) return;
      area('received').focus();
      feedback('در کادر نگه دارید و «چسباندن» را بزنید؛ در رایانه Ctrl+V بزنید.', 'Long-press inside the box and choose Paste, or press Ctrl+V on a computer.');
    }
  })();
});
button('reply').addEventListener('click', () => {
  if (!openedCover) return;
  replyContext = openedCover;
  area('message').value = ''; area('received').value = '';
  mode(false);
});
button('edit-message').addEventListener('click', () => mode(false));
button('new-message').addEventListener('click', () => { area('message').value = ''; mode(false); });
button('read-another').addEventListener('click', () => { area('received').value = ''; mode(true); });
button('send-mode').addEventListener('click', () => mode(false));
button('receive-mode').addEventListener('click', () => mode(true));
button('clear').addEventListener('click', () => home());
button('language').addEventListener('click', () => {
  english = !english;
  document.documentElement.lang = english ? 'en' : 'fa';
  document.documentElement.dir = english ? 'ltr' : 'rtl';
  translated.forEach(({ node, fa }) => { node.textContent = english ? node.dataset.en ?? fa : fa; });
  button('language').textContent = english ? 'فارسی' : 'English';
  button('language').lang = english ? 'fa' : 'en';
  el('feedback').textContent = t(...status);
  el('error').textContent = t(...errorText);
  el('conversation').setAttribute('aria-label', t('گفت‌وگو', 'Conversation'));
});
window.addEventListener('pagehide', () => {
  home(false);
  el<HTMLInputElement>('import-code').value = '';
  if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = ''; }
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    home(false);
    if (downloadCode) makeDownload(downloadCode);
  }
});

async function start(): Promise<void> {
  let embedded = '';
  try {
    if (!window.isSecureContext || !crypto?.subtle) throw new Error('Unsupported browser');
    const probe = await createPair();
    const packet = await encryptBytesV2(probe.key, new Uint8Array([7]), 0);
    if ((await decryptBytes(probe.key, packet))[0] !== 7) throw new Error('Encryption check failed');
    supported = true;
    const slot = document.querySelector<HTMLMetaElement>('meta[name="bpp-conversation"]');
    if (!slot) throw new Error('Missing conversation metadata');
    embedded = slot.content;
    slot.content = '';
    if (embedded) {
      key = (await importPair(embedded)).key;
      el('conversation').hidden = false;
    } else el('setup-panel').hidden = false;
    el('capability').hidden = true;
  } catch {
    fail(...(embedded
      ? ['این فایل خصوصی آسیب دیده است. نسخهٔ اصلی را دوباره از فرد مورد اعتماد بگیرید.', 'This private file is damaged. Get the original copy again from the person you trust.'] as [string, string]
      : ['این فایل اینجا کار نمی‌کند. آن را در Chrome یا Edge باز کنید، نه پیش‌نمایش فایل.', 'This file cannot work here. Open it in Chrome or Edge, not a file previewer.'] as [string, string]));
    el('capability').hidden = true;
  }
  buttons();
}
void start();
