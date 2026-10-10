import { importPair } from './crypto.ts';

export const KDF_ITERATIONS = 600_000;
export const ENVELOPE_LENGTH = 179;
const HEADER_LENGTH = 39;
const TOTAL_LENGTH = 87;
const MAX_PASSPHRASE_BYTES = 1024;
const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();

function passphraseBytes(value: string, creating = false): Uint8Array<ArrayBuffer> {
  if (value.length > 1024 || /[\uD800-\uDFFF]/u.test(value)) throw new Error('Invalid passphrase text');
  // NFC only: preserve case, spaces, Persian/Arabic variants and ZWNJ.
  const normalized = value.normalize('NFC');
  if (creating && (Array.from(normalized).length < 16 || /^[\p{N}\s]*$/u.test(normalized))) {
    throw new Error('Choose a long passphrase, not a PIN');
  }
  const bytes = new TextEncoder().encode(normalized);
  if (!bytes.length || bytes.length > MAX_PASSPHRASE_BYTES) { bytes.fill(0); throw new Error('Passphrase length is outside the supported range'); }
  return bytes;
}

export function validateNewPassphrase(value: string): void { passphraseBytes(value, true).fill(0); }

export function parseEnvelope(value: string): Uint8Array<ArrayBuffer> {
  if (value.length !== ENVELOPE_LENGTH || !/^BPK1-[0-9A-F]{174}$/.test(value)) throw new Error('Invalid protected-file envelope');
  const bytes = Uint8Array.from(value.slice(5).match(/../g)!, (part) => parseInt(part, 16));
  // One explicitly supported suite. No attacker-chosen cost or fallback.
  const fixed = [0x42, 0x50, 0x4b, 1, 1, 1, 1];
  if (fixed.some((byte, index) => bytes[index] !== byte) || new DataView(bytes.buffer).getUint32(7) !== KDF_ITERATIONS) {
    throw new Error('Unsupported protected-file parameters');
  }
  return bytes;
}

async function derive(passphrase: string, salt: Uint8Array<ArrayBuffer>, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  const bytes = passphraseBytes(passphrase);
  try {
    const material = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', iterations: KDF_ITERATIONS, salt },
      material, { name: 'AES-GCM', length: 256 }, false, [usage],
    );
  } finally { bytes.fill(0); }
}

export async function protectKey(raw: Uint8Array<ArrayBuffer>, passphrase: string): Promise<string> {
  validateNewPassphrase(passphrase);
  if (raw.length !== 32) throw new Error('Invalid conversation key length');
  const header = new Uint8Array(HEADER_LENGTH);
  header.set([0x42, 0x50, 0x4b, 1, 1, 1, 1]);
  new DataView(header.buffer).setUint32(7, KDF_ITERATIONS);
  header.set(crypto.getRandomValues(new Uint8Array(16)), 11);
  header.set(crypto.getRandomValues(new Uint8Array(12)), 27);
  const wrappingKey = await derive(passphrase, header.slice(11, 27), 'encrypt');
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: header.slice(27), additionalData: header, tagLength: 128 }, wrappingKey, raw,
  ));
  const envelope = new Uint8Array(TOTAL_LENGTH);
  envelope.set(header); envelope.set(encrypted, HEADER_LENGTH);
  return `BPK1-${hex(envelope)}`;
}

export async function createProtectedConversation(passphrase: string, legacyCode?: string): Promise<string> {
  validateNewPassphrase(passphrase);
  let raw: Uint8Array<ArrayBuffer>;
  if (legacyCode !== undefined) {
    // Existing checksum and syntax validation is authoritative; never execute old HTML.
    await importPair(legacyCode);
    const compact = legacyCode.replace(/[\s-]/g, '').toUpperCase();
    raw = Uint8Array.from(compact.slice(4, 68).match(/../g)!, (part) => parseInt(part, 16));
  } else raw = crypto.getRandomValues(new Uint8Array(32));
  try { return await protectKey(raw, passphrase); } finally { raw.fill(0); }
}

export async function unlockConversation(value: string, passphrase: string): Promise<CryptoKey> {
  const envelope = parseEnvelope(value); // Bounds and suite validation precede the KDF.
  const header = envelope.slice(0, HEADER_LENGTH);
  const wrappingKey = await derive(passphrase, header.slice(11, 27), 'decrypt');
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: header.slice(27), additionalData: header, tagLength: 128 }, wrappingKey, envelope.slice(HEADER_LENGTH),
    ));
  } catch { throw new Error('Unable to unlock this file'); }
  try {
    if (raw.length !== 32) throw new Error('Invalid conversation key length');
    return await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  } finally { raw.fill(0); }
}

export function protectedFileId(value: string): string { return hex(parseEnvelope(value).slice(11, 15)).toLowerCase(); }

export const MAX_LEGACY_FILE_BYTES = 2 * 1024 * 1024;
export function legacyCodeFromHtml(html: string): string {
  if (html.length > MAX_LEGACY_FILE_BYTES) throw new Error('Old file is too large');
  // Read only the known prologue format. No DOM parser, insertion, resource load
  // or script execution. The released files place metadata before these blocks.
  let head = html.slice(0, 8192);
  const boundary = head.search(/<(?:script|style|template)\b|<\/head\s*>/i);
  if (boundary < 0) throw new Error('Not an old conversation file');
  head = head.slice(0, boundary).replace(/<!--[\s\S]*?-->/g, '');
  const slots = [...head.matchAll(/<meta\s+name="bpp-conversation"\s+content="(BPP1[0-9A-F]{72})"\s*>/g)];
  if (slots.length !== 1) throw new Error('Not an old conversation file');
  return slots[0][1];
}
