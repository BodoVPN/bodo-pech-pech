import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import test from 'node:test';
import { bytesToText, createPair, decryptBytes, encryptBytes, textToBytes } from '../src/crypto.ts';
import { createProtectedConversation, KDF_ITERATIONS, legacyCodeFromHtml, MAX_LEGACY_FILE_BYTES, parseEnvelope, protectKey, unlockConversation, validateNewPassphrase } from '../src/key-storage.ts';
import { personalFile } from '../src/personal-file.ts';

const password = 'café river garden moon apple';
const encode = (bytes: Uint8Array): string => `BPK1-${Buffer.from(bytes).toString('hex').toUpperCase()}`;

test('native protection interoperates with independent Node PBKDF2 and AES-GCM in both directions', async () => {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const envelope = await protectKey(raw, password);
  const packet = parseEnvelope(envelope);
  const wrapping = pbkdf2Sync(password, packet.slice(11, 27), 600_000, 32, 'sha256');
  const decipher = createDecipheriv('aes-256-gcm', wrapping, packet.slice(27, 39));
  decipher.setAAD(packet.slice(0, 39)); decipher.setAuthTag(packet.slice(-16));
  const recovered = Buffer.concat([decipher.update(packet.slice(39, -16)), decipher.final()]);
  assert.ok(recovered.equals(Buffer.from(raw)), 'Independent decryption recovers the original random key');
  const header = Buffer.alloc(39);
  header.set([0x42, 0x50, 0x4b, 1, 1, 1, 1]); header.writeUInt32BE(600_000, 7);
  header.set(randomBytes(16), 11); header.set(randomBytes(12), 27);
  const cipher = createCipheriv('aes-256-gcm', pbkdf2Sync(password, header.subarray(11, 27), 600_000, 32, 'sha256'), header.subarray(27));
  cipher.setAAD(header);
  const fixture = encode(Buffer.concat([header, cipher.update(raw), cipher.final(), cipher.getAuthTag()]));
  const unlocked = await unlockConversation(fixture, password);
  assert.equal(unlocked.extractable, false);
  const original = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  assert.equal(bytesToText(await decryptBytes(unlocked, await encryptBytes(original, textToBytes('exact 👋\u200c\uFEFF\r\ne\u0301'), 0))), 'exact 👋\u200c\uFEFF\r\ne\u0301');
  const other = parseEnvelope(await protectKey(raw, password));
  assert.notDeepEqual(packet.slice(11, 27), other.slice(11, 27));
  assert.notDeepEqual(packet.slice(27, 39), other.slice(27, 39));
});

test('wrong passphrases and salt, nonce, ciphertext or tag changes fail authentication', async () => {
  const envelope = await createProtectedConversation(password);
  for (const wrong of ['wrong', `${password} `, password.toUpperCase()]) await assert.rejects(unlockConversation(envelope, wrong), /Unable to unlock/);
  for (const offset of [11, 26, 27, 38, 39, 70, 71, 86]) {
    const changed = parseEnvelope(envelope); changed[offset] ^= 1;
    await assert.rejects(unlockConversation(encode(changed), password), /Unable to unlock/);
  }
});

test('unsupported versions, suite, normalization and cost are rejected before any derivation', async () => {
  const packet = parseEnvelope(await createProtectedConversation(password));
  const original = crypto.subtle.deriveKey;
  let calls = 0;
  crypto.subtle.deriveKey = (() => { calls++; throw new Error('Must not run'); }) as typeof original;
  try {
    for (let offset = 0; offset < 11; offset++) {
      const changed = packet.slice(); changed[offset] ^= 1;
      await assert.rejects(unlockConversation(encode(changed), password), /Unsupported/);
    }
    for (const invalid of ['', 'BPK2-' + '00'.repeat(87), encode(packet).toLowerCase(), encode(packet).slice(0, -1), encode(packet) + '00', 'x'.repeat(10000)]) {
      await assert.rejects(unlockConversation(invalid, password), /Invalid/);
    }
    assert.equal(calls, 0);
  } finally { crypto.subtle.deriveKey = original; }
  assert.equal(KDF_ITERATIONS, 600_000);
});

test('Unicode passphrases use NFC only; creation bounds reject PINs and malformed text', async () => {
  const unicode = 'واژه‌های فارسی 👋 café باغ ماه';
  const envelope = await createProtectedConversation(unicode);
  await unlockConversation(envelope, unicode.normalize('NFD'));
  await assert.rejects(unlockConversation(envelope, unicode.replace('ی', 'ي')));
  for (const invalid of ['', '1234', '۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶۷۸۹۰', ' '.repeat(20), 'short words', 'a'.repeat(1025), '🌙'.repeat(257), 'invalid high \ud800 surrogate']) {
    assert.throws(() => validateNewPassphrase(invalid));
  }
  assert.doesNotThrow(() => validateNewPassphrase('a'.repeat(1024)));
  await assert.rejects(unlockConversation(envelope, '\ud800'));
});

test('legacy migration preserves the original key without exporting raw code or passphrase', async () => {
  const pair = await createPair();
  const envelope = await createProtectedConversation(password, pair.code);
  const key = await unlockConversation(envelope, password);
  assert.equal(bytesToText(await decryptBytes(key, await encryptBytes(pair.key, textToBytes('old message'), 2))), 'old message');
  const compact = pair.code.replace(/[\s-]/g, '');
  const html = `<html><head><meta name="bpp-conversation" content="${compact}"><style></style></head><body><script>throw 1</script><img src="https://invalid.example/test"></body></html>`;
  assert.equal(legacyCodeFromHtml(html), compact);
  const pristine = '<meta name="bpp-conversation" content=""><script>template has <meta name="bpp-conversation" content=""></script>';
  const exported = personalFile(pristine, envelope);
  assert.ok(!exported.includes(compact) && !exported.includes(password));
  assert.equal(exported.replace(envelope, ''), pristine);
  await assert.rejects(createProtectedConversation(password, compact.slice(0, -1) + (compact.endsWith('0') ? '1' : '0')));
  for (const invalid of [html.replace('<style>', `<meta name="bpp-conversation" content="${compact}"><style>`), html.replace(compact, 'invalid'), '<script>' + html, 'x'.repeat(MAX_LEGACY_FILE_BYTES + 1)]) assert.throws(() => legacyCodeFromHtml(invalid));
  assert.throws(() => personalFile(pristine, compact));
});
