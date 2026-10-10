import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import test from 'node:test';
import { bytesToText, createPair, decryptBytes, encryptBytes, importPair, MAX_MESSAGE_BYTES, textToBytes } from '../src/crypto.ts';
import { chooseTopic, decodeCover, encodeCover, ENDS, MAX_COVER_CHARS, MIDDLES, normalizeCover, OPENERS, STARTS, SUBJECTS } from '../src/codec.ts';

test('every v1 phrase table is unambiguous after normalization', () => {
  for (const table of [OPENERS, STARTS, ...SUBJECTS, MIDDLES, ENDS]) {
    const normalized = table.map(normalizeCover);
    assert.equal(new Set(normalized).size, table.length);
    normalized.forEach((phrase, i) => normalized.forEach((other, j) => {
      if (i !== j) assert.ok(!other.startsWith(phrase), `${phrase} is a prefix of ${other}`);
    }));
  }
  for (const table of [STARTS, ...SUBJECTS, MIDDLES, ENDS]) assert.equal(table.length, 16);
});

test('v1 cover serialization stays compatible with its fixed fixture', () => {
  const packet = new Uint8Array(39);
  packet.set([66, 80, 80, 1, 2]);
  for (let i = 5; i < packet.length; i++) packet[i] = i;
  const cover = encodeCover(packet);
  assert.equal(createHash('sha256').update(cover).digest('hex'), '3f400d7e2936224b18da92a717f05a0cce0034ec36c928928b1ac9e5d6534083');
  assert.deepEqual(decodeCover(cover), packet);
});

test('generated setup codes import to the same non-extractable key and fingerprint', async () => {
  const created = await createPair();
  const imported = await importPair(created.code.toLowerCase().replace(/-/g, ' \n'));
  assert.equal(imported.fingerprint, created.fingerprint);
  assert.equal(imported.key.extractable, false);
  await assert.rejects(crypto.subtle.exportKey('raw', imported.key));
  const packet = await encryptBytes(created.key, textToBytes('hello'), 0);
  assert.equal(bytesToText(await decryptBytes(imported.key, packet)), 'hello');
  await assert.rejects(importPair('my memorable password'), /Invalid setup code/);
  const corrupted = created.code.slice(0, -1) + (created.code.at(-1) === '0' ? '1' : '0');
  await assert.rejects(importPair(corrupted), /checksum/);
  assert.notEqual((await createPair()).fingerprint, created.fingerprint);
});

test('independent Node AES-GCM fixture decrypts with authenticated v1 header', async () => {
  const raw = Buffer.from('0123456789abcdef'.repeat(4), 'hex');
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  const header = Buffer.from([0x42, 0x50, 0x50, 1, 2]);
  const nonce = Buffer.from('00112233445566778899aabb', 'hex');
  const message = Buffer.from('\uFEFFسلام\r\n دقیق 👋\0', 'utf8');
  const cipher = createCipheriv('aes-256-gcm', raw, nonce);
  cipher.setAAD(header);
  const encrypted = Buffer.concat([cipher.update(message), cipher.final()]);
  const packet = new Uint8Array(Buffer.concat([header, nonce, encrypted, cipher.getAuthTag()]));
  const actual = await decryptBytes(key, decodeCover(encodeCover(packet)));
  assert.deepEqual(Buffer.from(actual), message);
});

test('exact Unicode, BOM, whitespace, newlines and HTML-like text survive all topics', async () => {
  const pair = await createPair();
  const texts = ['سلام، دنیا! می‌خواهم دقیق بماند.', '\uFEFF  first\r\n\nlast\t\0  ', '👨‍👩‍👧‍👦 e\u0301 é י العربية فارسی', '<img src=x onerror=alert(1)> & </script>'];
  for (let topic = 0; topic < 3; topic++) {
    for (const text of texts) {
      const bytes = textToBytes(text);
      const packet = await encryptBytes(pair.key, bytes, topic);
      const decoded = decodeCover(encodeCover(packet));
      assert.deepEqual(decoded, packet);
      assert.deepEqual(await decryptBytes(pair.key, decoded), bytes);
      assert.equal(bytesToText(await decryptBytes(pair.key, decoded)), text);
    }
  }
  assert.throws(() => textToBytes('\uD800'), /Unicode/);
  assert.throws(() => textToBytes(''), /Write a message/);
  assert.throws(() => textToBytes('a'.repeat(MAX_MESSAGE_BYTES + 1)), /Shorten/);
  assert.throws(() => bytesToText(new Uint8Array([0xc3, 0x28])), /valid UTF-8/);
});

test('all byte values, random messages and maximum-size covers round-trip', async () => {
  const pair = await createPair();
  for (let topic = 0; topic < 3; topic++) {
    for (const length of [1, 2, 3, 31, 32, 255, 256, MAX_MESSAGE_BYTES - 1, MAX_MESSAGE_BYTES]) {
      const bytes = length === 256 ? Uint8Array.from({ length }, (_, i) => i) : new Uint8Array(randomBytes(length));
      const packet = await encryptBytes(pair.key, bytes, topic);
      const cover = encodeCover(packet);
      assert.ok(cover.length < MAX_COVER_CHARS);
      assert.deepEqual(await decryptBytes(pair.key, decodeCover(cover)), bytes);
    }
  }
  for (let i = 0; i < 50; i++) {
    const bytes = new Uint8Array(randomBytes(i * 7 + 1));
    const packet = await encryptBytes(pair.key, bytes, i % 3);
    assert.deepEqual(decodeCover(encodeCover(packet)), packet);
  }
});

test('documented copy/paste transformations preserve bytes', async () => {
  const pair = await createPair();
  const packet = await encryptBytes(pair.key, textToBytes('کلمات اصلی را تغییر نده'), 2);
  const cover = encodeCover(packet);
  const variants = [
    cover.replace(/ی/g, 'ي').replace(/ک/g, 'ك'),
    cover.replace(/ /g, '\r\n\t\u00a0').replace(/؛/g, ',').replace(/\./g, '؟'),
    cover.replace(/[\s\p{P}\u200c]/gu, ''),
    `\u2067${cover.replace(/ا/g, 'اَ').replace(/ /g, '\u200f \u200b')}\u2069`,
    cover.replace(/ک/g, 'ﻛ'),
  ];
  for (const variant of variants) assert.deepEqual(decodeCover(variant), packet);
});

test('wrong key and every single-byte packet mutation fail before returning plaintext', async () => {
  const sender = await createPair();
  const wrong = await createPair();
  const packet = await encryptBytes(sender.key, textToBytes('a short secret'), 1);
  await assert.rejects(decryptBytes(wrong.key, packet), /Authentication failed/);
  for (let i = 0; i < packet.length; i++) {
    const modified = packet.slice();
    modified[i] ^= 1;
    await assert.rejects(decryptBytes(sender.key, modified));
  }
  const second = await encryptBytes(sender.key, textToBytes('a short secret'), 1);
  assert.notDeepEqual(packet.slice(5, 17), second.slice(5, 17));
});

test('malformed, truncated, appended, reworded and topic-swapped cover text is rejected', async () => {
  const pair = await createPair();
  const cover = encodeCover(await encryptBytes(pair.key, textToBytes('odd length'), 0));
  const sentences = cover.split('. ');
  const variants = ['', 'سلام دوست من', cover.slice(0, -12), sentences.slice(0, -1).join('. '),
    `${cover} ${sentences[1]}`, cover.replace(OPENERS[0], OPENERS[1]),
    `Alice: ${cover}`, `${cover}💬`, cover.replace(/راستش/, 'البته')];
  for (const variant of variants) assert.throws(() => decodeCover(variant));
  assert.throws(() => decodeCover('x'.repeat(MAX_COVER_CHARS + 1)), /too long/);
});

test('a syntactically valid phrase substitution cannot pass authentication', async () => {
  const pair = await createPair();
  const cover = encodeCover(await encryptBytes(pair.key, textToBytes('test'), 1));
  const parts = cover.split('. ');
  // Fifth encoded sentence changes the nonce, not a framing/header byte.
  const original = STARTS.find((phrase) => parts[5].startsWith(phrase));
  assert.ok(original);
  parts[5] = parts[5].replace(original, STARTS[(STARTS.indexOf(original) + 1) % 16]);
  await assert.rejects(decryptBytes(pair.key, decodeCover(parts.join('. '))), /Authentication failed/);
});

test('reply topic follows only visible context, with an everyday fallback', () => {
  assert.equal(chooseTopic('چای و کیک چطوره؟'), 1);
  assert.equal(chooseTopic('برای قدم زدن بریم پارک؟'), 2);
  assert.equal(chooseTopic('سلام، خوبی؟'), 0);
  OPENERS.forEach((opener, topic) => assert.equal(chooseTopic(opener), topic));
});
