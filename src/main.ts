import { bytesToText, createPair, decryptBytes, encryptBytesV2, importPair, MAX_MESSAGE_BYTES, textToBytes } from './crypto.ts';
import type { PairKey } from './crypto.ts';
import { ACTS, chooseProfile, decodeMessageCover, encodeDialogue, TOPICS } from './dialogue.ts';

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing interface element: ${id}`);
  return found as T;
}
const input = (id: string) => el<HTMLInputElement>(id);
const area = (id: string) => el<HTMLTextAreaElement>(id);
const button = (id: string) => el<HTMLButtonElement>(id);
let pair: PairKey | undefined;
let ready = false;
let supported = false;
let busy = false;
let revision = 0;
let openedMessage = '';
let openedCover = '';

function feedback(message = ''): void {
  el('feedback').textContent = message;
  el('error').hidden = true;
  el('error').textContent = '';
}

function buttons(): void {
  button('generate').disabled = !supported || busy || ready;
  button('import').disabled = !supported || busy || ready;
  button('confirm').disabled = !pair || !input('verified').checked || busy || ready;
  button('encrypt').disabled = !ready || busy;
  button('decrypt').disabled = !ready || busy;
  button('copy-code').disabled = busy || !area('setup-code').value;
  button('copy-cover').disabled = busy || !area('cover').value;
  button('copy-plain').disabled = busy || !openedMessage;
  button('reply').disabled = busy || !openedCover;
}

function cancelPending(): void {
  revision++;
  busy = false;
}

async function run(operation: () => Promise<() => void>): Promise<void> {
  const token = ++revision;
  busy = true;
  feedback();
  buttons();
  try {
    const apply = await operation();
    if (token === revision) apply();
  } catch (error) {
    if (token === revision) {
      el('error').textContent = error instanceof Error ? error.message : 'This operation failed. Check your input and try again.';
      el('error').hidden = false;
    }
  } finally {
    if (token === revision) busy = false;
    buttons();
  }
}

function clearCover(): void {
  area('cover').value = '';
  el('cover-result').hidden = true;
  el('cover-stats').textContent = '';
}

function clearPlain(): void {
  openedMessage = '';
  openedCover = '';
  el('plaintext').textContent = '';
  el('plain-result').hidden = true;
}

function countBytes(): void {
  const count = new TextEncoder().encode(area('message').value).length;
  el('byte-count').textContent = `${count.toLocaleString()} / 2,048 bytes`;
  el('byte-count').classList.toggle('over-limit', count > MAX_MESSAGE_BYTES);
}

function mode(receive: boolean): void {
  el('send-panel').hidden = receive;
  el('receive-panel').hidden = !receive;
  button('send-mode').setAttribute('aria-pressed', String(!receive));
  button('receive-mode').setAttribute('aria-pressed', String(receive));
  feedback();
}

function resetSession(): void {
  cancelPending();
  pair = undefined;
  ready = false;
  document.querySelectorAll('textarea, input').forEach((field) => {
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = '';
  });
  input('verified').checked = false;
  el<HTMLSelectElement>('topic').value = 'auto';
  el<HTMLSelectElement>('act').value = 'auto';
  for (const id of ['generated-panel', 'verify-panel', 'active-pair']) el(id).hidden = true;
  for (const id of ['setup-panel', 'setup-controls', 'message-gate']) el(id).hidden = false;
  el<HTMLDetailsElement>('setup-panel').open = true;
  el<HTMLDetailsElement>('context-details').open = false;
  el('fingerprint').textContent = '';
  el('active-fingerprint').textContent = '';
  el('pair-state').textContent = 'Not connected';
  clearCover();
  clearPlain();
  countBytes();
  feedback();
  buttons();
}

function showPending(nextPair: PairKey): void {
  pair = nextPair;
  el('fingerprint').textContent = nextPair.fingerprint;
  el('verify-panel').hidden = false;
  el('pair-state').textContent = 'Compare fingerprints';
  input('verified').checked = false;
}

button('generate').addEventListener('click', () => {
  resetSession();
  void run(async () => {
    const nextPair = await createPair();
    return () => {
      showPending(nextPair);
      // Store only the CryptoKey and fingerprint in application state.
      pair = { key: nextPair.key, fingerprint: nextPair.fingerprint };
      area('setup-code').value = nextPair.code;
      el('generated-panel').hidden = false;
      feedback('Pair code created. Share it privately, then compare fingerprints.');
    };
  });
});

el('import-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!supported || busy || ready) return;
  const code = input('import-code').value;
  resetSession();
  void run(async () => {
    const nextPair = await importPair(code);
    return () => { showPending(nextPair); feedback('Code accepted. Compare fingerprints before continuing.'); };
  });
});

input('verified').addEventListener('change', buttons);
button('confirm').addEventListener('click', () => {
  if (!pair || !input('verified').checked || busy) return;
  ready = true;
  area('setup-code').value = '';
  input('import-code').value = '';
  el('setup-panel').hidden = true;
  el('generated-panel').hidden = true;
  el('verify-panel').hidden = true;
  el('active-pair').hidden = false;
  el('active-fingerprint').textContent = pair.fingerprint;
  el('pair-state').textContent = 'Ready';
  el('message-gate').hidden = true;
  feedback('Pair ready. Nothing is saved when you close or refresh this file.');
  buttons();
});

el('send-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!pair || !ready || busy) return;
  const key = pair.key;
  const message = area('message').value;
  const selected = el<HTMLSelectElement>('topic').value;
  const selectedAct = el<HTMLSelectElement>('act').value;
  const profile = chooseProfile(area('context').value, selected === 'auto' ? undefined : Number(selected), selectedAct === 'auto' ? undefined : Number(selectedAct));
  clearCover();
  void run(async () => {
    const bytes = textToBytes(message);
    let packet: Uint8Array<ArrayBuffer>;
    try { packet = await encryptBytesV2(key, bytes, profile); } finally { bytes.fill(0); }
    const cover = encodeDialogue(packet);
    return () => {
      area('cover').value = cover;
      el('cover-stats').textContent = `${TOPICS[Math.floor(profile / ACTS.length)]} · ${ACTS[profile % ACTS.length]} · ${cover.length.toLocaleString()} characters · Dialogue v2`;
      el('cover-result').hidden = false;
      feedback('Cover text is ready. Copy all of it into your existing messenger.');
    };
  });
});

el('receive-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!pair || !ready || busy) return;
  const key = pair.key;
  const cover = area('received').value;
  clearPlain();
  void run(async () => {
    const bytes = await decryptBytes(key, decodeMessageCover(cover));
    let text: string;
    try { text = bytesToText(bytes); } finally { bytes.fill(0); }
    return () => {
      openedMessage = text;
      openedCover = cover;
      el('plaintext').textContent = text;
      el('plain-result').hidden = false;
      feedback('Message authenticated and opened.');
    };
  });
});

for (const id of ['message', 'context', 'topic', 'act']) {
  el(id).addEventListener('input', () => {
    cancelPending();
    clearCover();
    countBytes();
    feedback();
    buttons();
  });
}
area('received').addEventListener('input', () => {
  cancelPending(); clearPlain(); feedback(); buttons();
});

async function copy(text: string, target: HTMLTextAreaElement | HTMLElement): Promise<void> {
  const token = revision;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    if (token === revision) feedback('Copied. Clipboard contents may be kept or synced by your device.');
  } catch {
    if (token !== revision) return;
    target.focus();
    if (target instanceof HTMLTextAreaElement) target.select();
    else {
      const range = document.createRange();
      range.selectNodeContents(target);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
    feedback('Automatic copy is unavailable. The text is selected; use your browser’s Copy command.');
  }
}
button('copy-code').addEventListener('click', () => { void copy(area('setup-code').value, area('setup-code')); });
button('copy-cover').addEventListener('click', () => { void copy(area('cover').value, area('cover')); });
button('copy-plain').addEventListener('click', () => { void copy(openedMessage, el('plaintext')); });
button('reply').addEventListener('click', () => {
  if (!openedCover) return;
  area('context').value = openedCover;
  el<HTMLSelectElement>('topic').value = 'auto';
  el<HTMLSelectElement>('act').value = 'auto';
  clearCover();
  area('message').value = '';
  countBytes();
  el<HTMLDetailsElement>('context-details').open = true;
  mode(false);
  feedback('The visible cover conversation is included as local reply context.');
  area('message').focus();
  buttons();
});
button('send-mode').addEventListener('click', () => mode(false));
button('receive-mode').addEventListener('click', () => mode(true));
button('clear').addEventListener('click', () => {
  resetSession();
  feedback('Key and messages cleared from this page. Clear your device clipboard separately if needed.');
});
window.addEventListener('pagehide', resetSession);
window.addEventListener('pageshow', (event) => { if (event.persisted) resetSession(); });
resetSession();

async function checkBrowser(): Promise<void> {
  try {
    if (!window.isSecureContext || !crypto?.subtle) throw new Error('Native Web Crypto is not available for this local file.');
    const probe = await createPair();
    const encrypted = await encryptBytesV2(probe.key, new Uint8Array([7]), 0);
    const decrypted = await decryptBytes(probe.key, encrypted);
    if (decrypted[0] !== 7) throw new Error('Browser encryption self-check failed.');
    supported = true;
    el('capability').textContent = 'Native encryption ready. This file works without a network connection.';
  } catch (error) {
    el('capability').textContent = `Cannot use encryption here: ${error instanceof Error ? error.message : 'browser self-check failed'} Open the saved HTML in a supported full browser, not a file previewer.`;
  }
  buttons();
}
void checkBrowser();
