import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import test from 'node:test';
import { bytesToText, createPair, decryptBytes, encryptBytes, encryptBytesV2, MAX_MESSAGE_BYTES, textToBytes } from '../src/crypto.ts';
import { encodeCover, MAX_COVER_CHARS, normalizeCover } from '../src/codec.ts';
import { chooseProfile, decodeMessageCover, encodeDialogue } from '../src/dialogue.ts';
import { ACTS, FUTURE_BY_TOPIC, POOLS, PROFILE_OPENERS, STAGES, SUBJECTS_V2, TOPICS } from '../src/dialogue-data.ts';
import { PACKING_ALPHABET, packBytes, unpackBytes } from '../src/packing.ts';

test('v2 grammar branches are unambiguous and fit their bit widths', () => {
  assert.equal(PROFILE_OPENERS.length, TOPICS.length * ACTS.length);
  for (const values of [...Object.values(POOLS), ...FUTURE_BY_TOPIC, ...SUBJECTS_V2, PROFILE_OPENERS.flat(), ...STAGES.map((stage) => stage.map((structure) => structure[0] as string))]) {
    const normalized = values.map(normalizeCover);
    for (let i = 0; i < normalized.length; i++) for (let j = 0; j < normalized.length; j++) {
      if (i !== j) assert.ok(!normalized[j].startsWith(normalized[i]), `${values[i]} is a prefix of ${values[j]}`);
    }
  }
  for (const values of Object.values(POOLS)) assert.ok(Number.isInteger(Math.log2(values.length)));
  SUBJECTS_V2.forEach((values) => assert.equal(values.length, 33));
  STAGES.forEach((stage) => assert.equal(stage.length, 9));
});

test('lossless packing preserves every byte and never expands beyond its mode byte', () => {
  assert.equal(new Set(PACKING_ALPHABET).size, PACKING_ALPHABET.length);
  assert.ok(PACKING_ALPHABET.length <= 64);
  const cases = [textToBytes(PACKING_ALPHABET.join('')), textToBytes('\uFEFF\0\r\n e\u0301 é 👨‍👩‍👧‍👦 فارسی ي ك'), Uint8Array.from({ length: 256 }, (_, i) => i)];
  for (let i = 1; i <= 64; i++) cases.push(new Uint8Array(randomBytes(i * 31)));
  for (const bytes of cases) {
    const packed = packBytes(bytes);
    assert.ok(packed.length <= bytes.length + 1);
    assert.deepEqual(unpackBytes(packed, MAX_MESSAGE_BYTES), bytes);
  }
  assert.equal(packBytes(textToBytes('سلام، می‌خواهم دقیق بماند.'))[0], 1);
  assert.equal(packBytes(textToBytes('hello'))[0], 0);
  for (const invalid of [new Uint8Array(), new Uint8Array([2]), new Uint8Array([1, 255]), new Uint8Array([1, 240]), new Uint8Array([0]), new Uint8Array([1])]) assert.throws(() => unpackBytes(invalid, 2048));
  assert.throws(() => unpackBytes(new Uint8Array([1, 128, 128]), 3), /exceeds/);
});

test('v2 serialisation has a frozen fixture', () => {
  const packet = Uint8Array.from({ length: 71 }, (_, i) => i);
  packet.set([66, 80, 80, 2, 7]);
  const cover = encodeDialogue(packet);
  assert.equal(createHash('sha256').update(cover).digest('hex'), '8b9f7d4c5fbb69730b77374c387aec636fcb3dd99876fde3217443654f1510a4');
  assert.deepEqual(decodeMessageCover(cover), packet);
});

test('all 30 public profiles preserve exact Unicode with fresh nonces', async () => {
  const pair = await createPair();
  const texts = ['سلام، فردا ساعت پنج همدیگر را ببینیم.', '\uFEFF  دقیق\r\n\0 e\u0301 👋 ي ك ‌', '<img src=x onerror=alert(1)> & </script>'];
  for (let profile = 0; profile < PROFILE_OPENERS.length; profile++) for (const text of texts) {
    const bytes = textToBytes(text);
    const packet = await encryptBytesV2(pair.key, bytes, profile);
    const cover = encodeDialogue(packet);
    assert.deepEqual(decodeMessageCover(cover), packet);
    assert.deepEqual(await decryptBytes(pair.key, decodeMessageCover(cover)), bytes);
    assert.equal(/[؟?]/.test(cover), false, 'No repeated questions in body');
  }
  const a = await encryptBytesV2(pair.key, textToBytes('همان متن'), 0);
  const b = await encryptBytesV2(pair.key, textToBytes('همان متن'), 0);
  assert.notDeepEqual(a.slice(5, 17), b.slice(5, 17));
});

test('all bytes, random lengths and both raw/packed maximum messages cross stage and padding boundaries', async () => {
  const pair = await createPair();
  for (const length of [1, 2, 3, 31, 32, 127, 255, 256, 511, 1023, 2047, 2048]) {
    for (const bytes of [new Uint8Array(randomBytes(length)), new TextEncoder().encode('س'.repeat(Math.max(1, Math.floor(length / 2))))]) {
      const packet = await encryptBytesV2(pair.key, bytes, length % 30);
      const cover = encodeDialogue(packet);
      assert.ok(cover.length < MAX_COVER_CHARS);
      assert.deepEqual(await decryptBytes(pair.key, decodeMessageCover(cover)), bytes);
    }
  }
  for (let length = 1; length <= 96; length++) {
    const bytes = Uint8Array.from({ length }, (_, i) => i);
    const packet = await encryptBytesV2(pair.key, bytes, length % 30);
    assert.deepEqual(decodeMessageCover(encodeDialogue(packet)), packet);
  }
});

test('v1 messages remain readable through the new automatic decoder', async () => {
  const pair = await createPair();
  for (let topic = 0; topic < 3; topic++) {
    const packet = await encryptBytes(pair.key, textToBytes('قدیمی\uFEFF\r\n👋'), topic);
    assert.equal(bytesToText(await decryptBytes(pair.key, decodeMessageCover(encodeCover(packet)))), 'قدیمی\uFEFF\r\n👋');
    assert.throws(() => encodeDialogue(packet), /v2/);
  }
});

test('v2 handles documented copy/paste normalization without touching private bytes', async () => {
  const pair = await createPair();
  const packet = await encryptBytesV2(pair.key, textToBytes('ي ك ی ک ‌\r\n'), 17);
  const cover = encodeDialogue(packet);
  for (const variant of [
    cover.replace(/ی/g, 'ي').replace(/ک/g, 'ك'),
    cover.replace(/ /g, '\r\n\t\u00a0').replace(/؛/g, ',').replace(/\./g, '؟'),
    cover.replace(/[\s\p{P}\u200c]/gu, ''),
    `\u2067${cover.replace(/ا/g, 'اَ').replace(/ /g, '\u200f \u200b')}\u2069`,
    cover.replace(/ک/g, 'ﻛ'),
  ]) assert.deepEqual(decodeMessageCover(variant), packet);
});

test('wrong keys, context/version changes and every packet byte mutation fail closed', async () => {
  const pair = await createPair();
  const wrong = await createPair();
  const packet = await encryptBytesV2(pair.key, textToBytes('این متن اصلی است'), 7);
  await assert.rejects(decryptBytes(wrong.key, packet), /Authentication failed/);
  for (let i = 0; i < packet.length; i++) {
    const changed = packet.slice(); changed[i] ^= 1;
    await assert.rejects(decryptBytes(pair.key, changed));
  }
  const cover = encodeDialogue(packet);
  const opening = PROFILE_OPENERS[7].find((value) => cover.startsWith(value))!;
  // Same theme, different dialogue act: parsing succeeds, authenticated AAD fails.
  const changedAct = cover.replace(opening, PROFILE_OPENERS[5][0]);
  await assert.rejects(decryptBytes(pair.key, decodeMessageCover(changedAct)), /Authentication failed/);
  assert.throws(() => decodeMessageCover(cover.replace(opening, PROFILE_OPENERS[10][0])));
  assert.throws(() => decodeMessageCover(cover.replace(opening, 'راستی از حال و روزت بگو')));
  const changedVersion = packet.slice(); changedVersion[3] = 1; changedVersion[4] = 1;
  await assert.rejects(decryptBytes(pair.key, changedVersion), /Authentication failed/);
});

test('malformed, truncated, appended, duplicated and reworded covers cannot produce plaintext', async () => {
  const pair = await createPair();
  const cover = encodeDialogue(await encryptBytesV2(pair.key, textToBytes('a short message'), 0));
  const sentences = cover.split('.');
  const variants = ['', 'سلام دوست من', cover.slice(0, -12), sentences.slice(0, -2).join('.'), `${cover} ${sentences[1]}.`, `Alice: ${cover}`, `${cover}💬`, cover.replace('یه', 'یک')];
  for (const value of variants) await assert.rejects(async () => decryptBytes(pair.key, decodeMessageCover(value)));
  assert.throws(() => decodeMessageCover('x'.repeat(MAX_COVER_CHARS + 1)), /too long/);
});

test('independent Node AES fixture authenticates profile and decodes the v2 byte representation', async () => {
  const raw = Buffer.from('0123456789abcdef'.repeat(4), 'hex');
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  const header = Buffer.from([66, 80, 80, 2, 7]);
  const nonce = Buffer.from('00112233445566778899aabb', 'hex');
  // Mode 1, س=alphabet index 15, ل=27, ا=0, م=28.
  const encoded = Buffer.from([1, 143, 155, 128, 156]);
  const cipher = createCipheriv('aes-256-gcm', raw, nonce); cipher.setAAD(header);
  const encrypted = Buffer.concat([cipher.update(encoded), cipher.final()]);
  const packet = new Uint8Array(Buffer.concat([header, nonce, encrypted, cipher.getAuthTag()]));
  assert.equal(bytesToText(await decryptBytes(key, decodeMessageCover(encodeDialogue(packet)))), 'سلام');
});

test('visible dialogue acts, bounded themes, overrides and generated replies select context predictably', () => {
  assert.equal(chooseProfile('سلام، خوبی؟'), 1);
  assert.equal(chooseProfile('چای دم کردم، کیک هم داریم. میای؟'), 7);
  assert.equal(chooseProfile('فردا بریم پارک؟'), 12);
  assert.equal(chooseProfile('کار پروژه چطوره؟'), 18);
  assert.equal(chooseProfile('نظرت درباره این آهنگ چیه؟'), 23);
  assert.equal(chooseProfile('برای سفر بلیط قطار گرفتم، تو چی؟'), 28);
  assert.equal(chooseProfile('باشه مرسی'), 4);
  assert.equal(chooseProfile('باشه مرسی', 1, 2), 7);
  assert.equal(chooseProfile('باشه'), 4, 'آش must not match باشه');
  assert.equal(chooseProfile('بریم پارک؟\nباشه مرسی'), 14, 'reply act comes from the last visible line');
  assert.equal(chooseProfile('راستی از حال و روزت بگو. تو چه خبر'), 0, 'v1 covers continue without repeated greetings');
  assert.equal(chooseProfile('سلامت باشی'), 0, 'سلام must not match سلامت');
  for (let profile = 0; profile < PROFILE_OPENERS.length; profile++) {
    assert.equal(chooseProfile(PROFILE_OPENERS[profile][0] + '. سوال؟ سلام، میای؟'), Math.floor(profile / 5) * 5);
  }
  assert.throws(() => chooseProfile('', 6), /Unsupported/);
  assert.throws(() => chooseProfile('', 0, 5), /Unsupported/);
});
