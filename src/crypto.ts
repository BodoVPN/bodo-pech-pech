import { packBytes, unpackBytes } from './packing.ts';

export const MAX_MESSAGE_BYTES = 2048;
export const HEADER_BYTES = 5;
export const PACKET_OVERHEAD = HEADER_BYTES + 12 + 16;
export const MAX_PACKET_BYTES = MAX_MESSAGE_BYTES + PACKET_OVERHEAD + 1;
export const V2_PROFILE_COUNT = 30;
const encoder = new TextEncoder();

export interface PairKey {
  key: CryptoKey;
  fingerprint: string;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function identity(raw: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const label = encoder.encode('Bodo Pech Pech setup v1\0');
  const input = new Uint8Array(label.length + raw.length);
  input.set(label);
  input.set(raw, label.length);
  try {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  } finally {
    input.fill(0);
  }
}

async function loadKey(raw: Uint8Array<ArrayBuffer>, digest: Uint8Array): Promise<PairKey> {
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { key, fingerprint: hex(digest.slice(0, 12)).match(/.{4}/g)!.join(' ') };
}

export async function createPair(): Promise<PairKey & { code: string }> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  try {
    const digest = await identity(raw);
    const code = `BPP1-${hex(raw).match(/.{8}/g)!.join('-')}-${hex(digest.slice(0, 4))}`;
    return { ...await loadKey(raw, digest), code };
  } finally {
    raw.fill(0);
  }
}

export async function importPair(code: string): Promise<PairKey> {
  if (code.length > 256) throw new Error('The setup code is too long. Paste only the BPP1 setup code.');
  const compact = code.replace(/[\s-]/g, '').toUpperCase();
  if (!/^BPP1[0-9A-F]{72}$/.test(compact)) {
    throw new Error('Invalid setup code. Paste the complete generated BPP1 code, not a password.');
  }
  const raw = Uint8Array.from(compact.slice(4, 68).match(/.{2}/g)!, (part) => parseInt(part, 16));
  try {
    const digest = await identity(raw);
    if (hex(digest.slice(0, 4)) !== compact.slice(68)) {
      throw new Error('The setup code checksum does not match. Check the code with your partner.');
    }
    return await loadKey(raw, digest);
  } finally {
    raw.fill(0);
  }
}

export function textToBytes(text: string): Uint8Array<ArrayBuffer> {
  // In Unicode mode a valid surrogate pair is one code point outside this range.
  if (/[\uD800-\uDFFF]/u.test(text)) throw new Error('The message contains invalid Unicode. Remove the broken character and try again.');
  const bytes = encoder.encode(text);
  if (!bytes.length) throw new Error('Write a message first.');
  if (bytes.length > MAX_MESSAGE_BYTES) throw new Error(`This prototype accepts up to ${MAX_MESSAGE_BYTES} UTF-8 bytes per message. Shorten the message.`);
  return bytes;
}

export function bytesToText(bytes: Uint8Array): string {
  try {
    // Preserve an initial UTF-8 BOM as message content, rather than stripping it.
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error('The authenticated message is not valid UTF-8 text.');
  }
}

export function packetTopic(packet: Uint8Array): number {
  validatePacket(packet);
  if (packet[3] !== 1) throw new Error('This is not a supported Bodo Pech Pech v1 message.');
  return packet[4];
}

export function validatePacket(packet: Uint8Array): void {
  if (packet.length < PACKET_OVERHEAD + 1 || packet.length > MAX_PACKET_BYTES) {
    throw new Error('The message length is invalid or the text is incomplete. Copy the whole cover text.');
  }
  if (packet[0] !== 0x42 || packet[1] !== 0x50 || packet[2] !== 0x50 || ![1, 2].includes(packet[3])) {
    throw new Error('This is not a supported Bodo Pech Pech message version.');
  }
  if (packet[4] >= (packet[3] === 1 ? 3 : V2_PROFILE_COUNT)) throw new Error('The message has an unsupported cover profile.');
  if (packet[3] === 1 && packet.length > MAX_MESSAGE_BYTES + PACKET_OVERHEAD) throw new Error('The v1 message exceeds its size limit.');
}

export async function encryptBytes(key: CryptoKey, message: Uint8Array<ArrayBuffer>, topic: number): Promise<Uint8Array<ArrayBuffer>> {
  if (!Number.isInteger(topic) || topic < 0 || topic > 2) throw new Error('Unsupported cover topic.');
  return encryptPacket(key, message, 1, topic);
}

export async function encryptBytesV2(key: CryptoKey, message: Uint8Array<ArrayBuffer>, profile: number): Promise<Uint8Array<ArrayBuffer>> {
  if (!Number.isInteger(profile) || profile < 0 || profile >= V2_PROFILE_COUNT) throw new Error('Unsupported cover profile.');
  if (!message.length || message.length > MAX_MESSAGE_BYTES) throw new Error('Message byte length is outside the supported range.');
  const packed = packBytes(message);
  try { return await encryptPacket(key, packed, 2, profile); } finally { packed.fill(0); }
}

async function encryptPacket(key: CryptoKey, message: Uint8Array<ArrayBuffer>, version: number, profile: number): Promise<Uint8Array<ArrayBuffer>> {
  if (!message.length || message.length > MAX_MESSAGE_BYTES + (version === 2 ? 1 : 0)) throw new Error('Message byte length is outside the supported range.');
  const header = new Uint8Array([0x42, 0x50, 0x50, version, profile]);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: header, tagLength: 128 }, key, message,
  ));
  const packet = new Uint8Array(header.length + nonce.length + encrypted.length);
  packet.set(header);
  packet.set(nonce, header.length);
  packet.set(encrypted, header.length + nonce.length);
  return packet;
}

export async function decryptBytes(key: CryptoKey, packet: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  validatePacket(packet);
  let plaintext: Uint8Array<ArrayBuffer>;
  try {
    plaintext = new Uint8Array(await crypto.subtle.decrypt({
      name: 'AES-GCM', iv: packet.slice(HEADER_BYTES, HEADER_BYTES + 12),
      additionalData: packet.slice(0, HEADER_BYTES), tagLength: 128,
    }, key, packet.slice(HEADER_BYTES + 12)));
  } catch {
    throw new Error('Authentication failed. The pair key is different, or the cover text was changed. No message was opened.');
  }
  if (packet[3] === 1) return plaintext;
  try { return unpackBytes(plaintext, MAX_MESSAGE_BYTES); } finally { plaintext.fill(0); }
}
