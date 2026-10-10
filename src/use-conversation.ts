import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { bytesToText, createPair, decryptBytes, encryptBytesV2, MAX_MESSAGE_BYTES, textToBytes } from './crypto.ts';
import { chooseProfile, decodeMessageCover, encodeDialogue } from './dialogue.ts';
import { personalFile } from './personal-file.ts';
import { createProtectedConversation, generatePassphrase, legacyCodeFromHtml, MAX_CONVERSATION_FILE_BYTES, MAX_LEGACY_FILE_BYTES, parseEnvelope, protectedEnvelopeFromHtml, protectedFileId, unlockConversation, validateNewPassphrase } from './key-storage.ts';

export type Words = [string, string];
export type Screen = 'loading' | 'unavailable' | 'setup' | 'download' | 'unlock' | 'home' | 'write' | 'cover' | 'read' | 'message';
export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing interface element: ${id}`);
  return found as T;
}
const input = (id: string) => element<HTMLInputElement>(id);
const area = (id: string) => element<HTMLTextAreaElement>(id);

/** UI state belongs to React; keys and operation tokens never enter rendered state.
 * Secret inputs and results are uncontrolled DOM nodes, cleared explicitly below.
 * Exports are built from the immutable build-time shell, never this live DOM. */
export function useConversation(pristine: string) {
  const [screen, setScreen] = useState<Screen>('loading');
  const [busy, setBusy] = useState(false);
  const [deriving, setDeriving] = useState(false);
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Words>(['', '']);
  const [error, setError] = useState<Words>(['', '']);
  const [showSetup, setShowSetup] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [invalid, setInvalid] = useState('');
  const session = useRef({ key: undefined as CryptoKey | undefined, supported: false, busy: false, deriving: false,
    revision: 0, replyContext: '', openedCover: '', downloadEnvelope: '', embeddedEnvelope: '', downloadUrl: '' });
  const state = session.current;
  const focus = useRef('');
  useEffect(() => {
    if (focus.current) { document.getElementById(focus.current)?.focus(); focus.current = ''; }
  });
  function feedback(...words: Words | []) { setStatus(words.length ? words : ['', '']); setError(['', '']); setInvalid(''); }
  function fail(words: Words, field = '') { setError(words); setStatus(['', '']); setInvalid(field); focus.current = 'error'; }
  function go(next: Screen, target = '') { setScreen(next); focus.current = target; }
  function cancelPending() { state.revision++; state.busy = false; setBusy(false); }
  function changed() { cancelPending(); feedback(); }
  async function run(operation: () => Promise<() => void>, failure: Words, field = '') {
    const token = ++state.revision;
    state.busy = true; setBusy(true); feedback();
    try { const apply = await operation(); if (token === state.revision) apply(); }
    catch { if (token === state.revision) fail(failure, field); }
    finally { if (token === state.revision) { state.busy = false; setBusy(false); } }
  }
  // Web Crypto cannot be aborted. The latch survives input edits and pagehide,
  // preventing simultaneous PBKDF2 jobs until the original promise settles.
  async function keyOperation(operation: () => Promise<() => void>, failure: Words, field = '') {
    state.deriving = true; setDeriving(true);
    try { await run(operation, failure, field); }
    finally { state.deriving = false; setDeriving(false); }
  }
  function clearResults() { area('cover').value = ''; element('plaintext').textContent = ''; state.openedCover = ''; }
  function home(shouldFocus = true) {
    changed(); clearResults(); area('message').value = ''; area('received').value = ''; state.replyContext = '';
    if (state.key) go('home', shouldFocus ? 'home-heading' : '');
  }
  function mode(receive: boolean) { changed(); clearResults(); go(receive ? 'read' : 'write', receive ? 'received' : 'message'); }
  function clearPassphrase(id: 'setup' | 'unlock') {
    input(`${id}-passphrase`).value = '';
    // Clear synchronously even while React's next render is pending.
    input(`${id}-passphrase`).type = 'password';
    (id === 'setup' ? setShowSetup : setShowUnlock)(false);
  }
  function makeDownload(envelope: string) {
    if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);
    state.downloadUrl = '';
    const url = URL.createObjectURL(new Blob([personalFile(pristine, envelope)], { type: 'text/html;charset=utf-8' }));
    state.downloadUrl = url;
    const link = element<HTMLAnchorElement>('download');
    link.href = url; link.download = `bodo-pech-pech-private-${protectedFileId(envelope)}.html`;
  }
  function offerFile(envelope: string) {
    makeDownload(envelope);
    state.downloadEnvelope = envelope;
    input('import-code').value = ''; input('import-file').value = '';
    go('download', 'download-heading');
    element<HTMLAnchorElement>('download').click();
  }
  function generate() {
    if (!state.supported || state.downloadEnvelope) return;
    changed();
    try { input('setup-passphrase').value = generatePassphrase(); setShowSetup(true); focus.current = 'setup-passphrase'; }
    catch { fail(['عبارت رمز ساخته نشد. دوباره امتحان کنید.', 'The passphrase could not be generated. Try again.']); }
  }
  function prepareFile(migrate: boolean) {
    if (!state.supported || state.busy || state.deriving || state.downloadEnvelope) return;
    let passphrase = input('setup-passphrase').value;
    try { validateNewPassphrase(passphrase); } catch {
      fail(['دست‌کم ۸ نویسه، یک عدد و یک نماد وارد کنید. فاصله نماد نیست.', 'Use at least 8 characters, one number and one symbol. A space is not a symbol.'], 'setup'); return;
    }
    let code = migrate ? input('import-code').value : undefined;
    const file = migrate ? input('import-file').files?.[0] : undefined;
    clearPassphrase('setup'); input('import-code').value = ''; input('import-file').value = '';
    void keyOperation(async () => {
      try {
        if (file) {
          if (file.size > MAX_LEGACY_FILE_BYTES || code) throw new Error('Choose one legacy source');
          code = legacyCodeFromHtml(await file.text());
        }
        const envelope = await createProtectedConversation(passphrase, code);
        return () => offerFile(envelope);
      } finally { passphrase = ''; code = undefined; }
    }, migrate
      ? ['فایل یا کد قدیمی معتبر نیست، یا فایل تازه ساخته نشد. عبارت رمز را دوباره وارد و امتحان کنید.', 'The old file or code is invalid, or the new file could not be created. Enter your passphrase and try again.']
      : ['فایل ساخته نشد. عبارت رمز را دوباره وارد و امتحان کنید.', 'The file could not be created. Enter your passphrase and try again.']);
  }
  function openFile() {
    if (!state.supported || state.busy || state.deriving || state.embeddedEnvelope) return;
    const file = input('saved-file').files?.[0]; input('saved-file').value = '';
    if (!file) { fail(['فایل خصوصی ذخیره‌شده را انتخاب کنید.', 'Choose your saved private file.']); return; }
    void run(async () => {
      if (file.size > MAX_CONVERSATION_FILE_BYTES) throw new Error('Conversation file is too large');
      // Bounded metadata only: selected HTML is never executed or navigated to.
      const envelope = protectedEnvelopeFromHtml(await file.text());
      return () => {
        state.embeddedEnvelope = envelope;
        clearPassphrase('setup'); clearPassphrase('unlock');
        input('import-code').value = ''; input('import-file').value = '';
        go('unlock', 'unlock-passphrase');
      };
    }, ['این فایل گفت‌وگوی محافظت‌شده معتبر نیست. نسخهٔ اصلی را انتخاب کنید. برای فایل‌های قدیمیِ بدون رمز، «محافظت از گفت‌وگوی قبلی» را بزنید.', 'This is not a valid protected conversation file. Choose the original copy. For older unprotected files, use Protect an older conversation.']);
  }
  function unlock() {
    if (!state.supported || state.busy || state.deriving || state.key || !state.embeddedEnvelope) return;
    let passphrase = input('unlock-passphrase').value;
    clearPassphrase('unlock');
    void keyOperation(async () => {
      try {
        const key = await unlockConversation(state.embeddedEnvelope, passphrase);
        return () => { state.key = key; home(); };
      } finally { passphrase = ''; }
    }, ['عبارت رمز درست نیست یا فایل تغییر کرده است. دوباره امتحان کنید.', 'The passphrase is incorrect or the file has changed. Try again.'], 'unlock');
  }
  function encrypt() {
    if (!state.key || state.busy) return;
    const activeKey = state.key;
    const message = area('message').value;
    if (!message.length) { fail(['اول پیام خود را بنویسید.', 'Write your message first.'], 'message'); return; }
    if (new TextEncoder().encode(message).length > MAX_MESSAGE_BYTES) {
      fail(['پیام طولانی است. آن را کوتاه‌تر کنید یا در چند پیام بفرستید.', 'This message is too long. Shorten it or send several smaller messages.'], 'message'); return;
    }
    const profile = chooseProfile(state.replyContext);
    void run(async () => {
      const bytes = textToBytes(message);
      let packet: Uint8Array<ArrayBuffer>;
      try { packet = await encryptBytesV2(activeKey, bytes, profile); } finally { bytes.fill(0); }
      const cover = encodeDialogue(packet);
      return () => { area('cover').value = cover; state.replyContext = cover; go('cover', 'cover-heading'); };
    }, ['پیام آماده نشد. نوشته را بررسی کنید و دوباره امتحان کنید.', 'The message could not be prepared. Check the text and try again.']);
  }
  function decrypt() {
    if (!state.key || state.busy) return;
    const activeKey = state.key;
    const cover = area('received').value;
    if (!cover.trim()) { fail(['اول پیام دریافتی را بچسبانید.', 'Paste the received message first.'], 'received'); return; }
    clearResults();
    void run(async () => {
      const bytes = await decryptBytes(activeKey, decodeMessageCover(cover));
      let text: string;
      try { text = bytesToText(bytes); } finally { bytes.fill(0); }
      return () => { state.openedCover = cover; element('plaintext').textContent = text; go('message', 'plain-heading'); };
    }, ['پیام باز نشد. همهٔ متن را دوباره کپی کنید و فایل همین گفت‌وگو را باز کنید.', 'The message could not be opened. Copy all of it again and use the file for this conversation.'], 'received');
  }
  function edit(receive: boolean) { changed(); clearResults(); go(receive ? 'read' : 'write'); }
  async function copy(id: 'cover' | 'plaintext') {
    const token = state.revision;
    const target = element(id);
    const text = id === 'cover' ? area(id).value : target.textContent ?? '';
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      if (token === state.revision) feedback('کپی شد. حالا در پیام‌رسان بچسبانید.', 'Copied. Now paste it in your messenger.');
    } catch {
      if (token !== state.revision) return;
      target.focus();
      if (target instanceof HTMLTextAreaElement) target.select();
      else { const range = document.createRange(); range.selectNodeContents(target); window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range); }
      feedback('متن انتخاب شد. روی آن نگه دارید و «کپی» را بزنید؛ در رایانه Ctrl+C بزنید.', 'The text is selected. Long-press it and choose Copy, or press Ctrl+C on a computer.');
    }
  }
  async function paste() {
    const token = state.revision;
    try {
      if (!navigator.clipboard?.readText) throw new Error('Clipboard unavailable');
      const text = await navigator.clipboard.readText();
      if (token !== state.revision) return;
      if (text.length > 180000) { fail(['متن طولانی است. فقط یک پیام را کپی کنید.', 'That text is too long. Copy just one message.']); return; }
      area('received').value = text; edit(true);
      if (!text) feedback('چیزی کپی نشده است. اول پیام را از پیام‌رسان کپی کنید.', 'Nothing was copied. Copy the message from your messenger first.');
      area('received').focus();
    } catch {
      if (token !== state.revision) return;
      area('received').focus();
      feedback('در کادر نگه دارید و «چسباندن» را بزنید؛ در رایانه Ctrl+V بزنید.', 'Long-press inside the box and choose Paste, or press Ctrl+V on a computer.');
    }
  }
  function reply() {
    if (!state.openedCover) return;
    state.replyContext = state.openedCover; area('message').value = ''; area('received').value = ''; mode(false);
  }
  function fresh(receive: boolean) { area(receive ? 'received' : 'message').value = ''; mode(receive); }

  useEffect(() => {
    let disposed = false;
    async function start() {
      let embedded = '';
      const token = state.revision;
      try {
        if (!window.isSecureContext || !crypto?.subtle) throw new Error('Unsupported browser');
        const probe = await createPair();
        const packet = await encryptBytesV2(probe.key, new Uint8Array([7]), 0);
        if ((await decryptBytes(probe.key, packet))[0] !== 7) throw new Error('Encryption check failed');
        if (disposed || token !== state.revision) return;
        const slot = document.querySelector<HTMLMetaElement>('meta[name="bpp-conversation"]');
        if (!slot) throw new Error('Missing conversation metadata');
        embedded = slot.content; slot.content = '';
        if (embedded) { parseEnvelope(embedded); state.embeddedEnvelope = embedded; }
        state.supported = true; setSupported(true); go(embedded ? 'unlock' : 'setup');
      } catch {
        if (disposed || token !== state.revision) return;
        go('unavailable');
        fail(embedded
          ? ['این فایل خصوصی آسیب دیده است. نسخهٔ اصلی را دوباره از فرد مورد اعتماد بگیرید.', 'This private file is damaged. Get the original copy again from the person you trust.']
          : ['این نمایشگر امکان رمزگذاری لازم را ندارد. Chrome یا Edge ویندوز را امتحان کنید. پیش‌نمایش پیوست iPhone و iPad پشتیبانی نمی‌شود.', 'This viewer lacks the required encryption support. Try Windows Chrome or Edge. iPhone and iPad attachment previews are not supported.']);
      }
    }
    function abandon() {
      // Flush visibility as well as secret clearing before a page can enter bfcache.
      flushSync(() => {
        home(false); state.key = undefined;
        input('import-code').value = ''; input('import-file').value = ''; input('saved-file').value = '';
        clearPassphrase('setup'); clearPassphrase('unlock');
        go(state.embeddedEnvelope ? 'unlock' : state.downloadEnvelope ? 'download' : 'setup');
      });
      if (state.downloadUrl) { URL.revokeObjectURL(state.downloadUrl); state.downloadUrl = ''; }
    }
    function restore(event: PageTransitionEvent) {
      if (!event.persisted) return;
      if (state.downloadEnvelope) makeDownload(state.downloadEnvelope);
      if (!state.supported) void start();
    }
    window.addEventListener('pagehide', abandon); window.addEventListener('pageshow', restore);
    void start();
    return () => { disposed = true; state.revision++; state.key = undefined; window.removeEventListener('pagehide', abandon); window.removeEventListener('pageshow', restore); if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl); };
  }, []);
  return { screen, busy, deriving, supported, status, error, invalid, showSetup, showUnlock,
    setShowSetup, setShowUnlock, changed, home, mode, generate, prepareFile, openFile, unlock, encrypt, decrypt, edit, copy, paste, reply, fresh };
}
