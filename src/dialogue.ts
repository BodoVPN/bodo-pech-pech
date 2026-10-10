import { MAX_PACKET_BYTES, PACKET_OVERHEAD, validatePacket } from './crypto.ts';
import { decodeCover as decodeV1, MAX_COVER_CHARS, normalizeCover, OPENERS as V1_OPENERS } from './codec.ts';
import { ACTS, FUTURE_BY_TOPIC, POOLS, PROFILE_OPENERS, STAGES, STRUCTURES, SUBJECTS_V2, TOPICS } from './dialogue-data.ts';
import type { PoolName } from './dialogue-data.ts';
export { ACTS, TOPICS } from './dialogue-data.ts';

const normalizedOpeners = PROFILE_OPENERS.map((pair) => pair.map(normalizeCover));
const normalizedPools = Object.fromEntries(Object.entries(POOLS).map(([name, values]) => [name, values.map(normalizeCover)])) as Record<keyof typeof POOLS, string[]>;
const normalizedSubjects = SUBJECTS_V2.map((values) => values.map(normalizeCover));
const normalizedFuture = FUTURE_BY_TOPIC.map((values) => values.map(normalizeCover));
const normalizedStages = STAGES.map((structures) => structures.map((structure) => structure.map((part) => typeof part === 'string' ? normalizeCover(part) : part)));
const without = <T>(values: readonly T[], previous: number): T[] => values.filter((_, index) => index !== previous);
const structureIds = STRUCTURES.map((_, index) => index);

function openerProfile(text: string): { profile: number; length: number } | undefined {
  for (let profile = 0; profile < normalizedOpeners.length; profile++) {
    for (const opener of normalizedOpeners[profile]) {
      if (text.startsWith(opener)) return { profile, length: opener.length };
    }
  }
}

/** Only visible context enters this decision. It is never needed by a receiver. */
export function chooseProfile(context: string, topicOverride?: number, actOverride?: number): number {
  const text = context.slice(-MAX_COVER_CHARS);
  const normalized = normalizeCover(text);
  const previous = openerProfile(normalized);
  const legacy = V1_OPENERS.findIndex((opener) => normalized.startsWith(normalizeCover(opener)));
  let topic = previous ? Math.floor(previous.profile / ACTS.length) : 0;
  let act = 0;
  if (!previous) {
    if (legacy >= 0) topic = legacy;
    else {
      // Whole tokens avoid matches such as آش inside باشه. Later occurrences
      // win equal scores, giving the most recent part of a pasted chat weight.
      const words = text.normalize('NFKC').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\u200c/g, '').split(/[\s\p{P}]+/u);
      const keywords = [[], ['چای', 'دمنوش', 'کیک', 'بیسکویت', 'عصرونه', 'عصرانه', 'پذیرایی'], ['پارک', 'بیرون', 'هوا', 'قدم', 'پیادهروی', 'بارون', 'باران'], ['کار', 'درس', 'امتحان', 'پروژه', 'تمرین', 'اداره', 'دانشگاه'], ['موسیقی', 'آهنگ', 'ترانه', 'ملودی', 'کنسرت'], ['سفر', 'جاده', 'بلیط', 'قطار', 'هتل', 'مسافرت', 'مقصد']];
      const scores = keywords.map(() => 0);
      const last = keywords.map(() => -1);
      words.forEach((word, index) => keywords.forEach((list, candidate) => {
        if (list.includes(word)) { scores[candidate]++; last[candidate] = index; }
      }));
      for (let candidate = 1; candidate < TOPICS.length; candidate++) {
        if (scores[candidate] > scores[topic] || (scores[candidate] === scores[topic] && last[candidate] > last[topic])) topic = candidate;
      }
    }
    const trimmed = text.trim();
    const recent = trimmed.slice(trimmed.lastIndexOf('\n') + 1).slice(-1500);
    const plain = normalizeCover(recent);
    const words = recent.normalize('NFKC').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\u200c/g, '').split(/[\s\p{P}]+/u);
    if (words.some((word) => ['میای', 'نمیای', 'بیای', 'بریم', 'دعوت'].includes(word)) || /باهمبرویم/.test(plain)) act = 2;
    else if (words.some((word) => ['سلام', 'خوبی', 'چطوری'].includes(word)) || /حالتچطوره|چهخبر/.test(plain)) act = 1;
    else if (/[؟?]/.test(recent) || /نظرت|چطوره|چگونه|چرا|موافقی/.test(plain)) act = 3;
    else if (/ممنون|مرسی|باشه|قبوله|متشکرم|فهمیدم/.test(plain)) act = 4;
    if (legacy >= 0) act = 0;
  }
  // An app-generated reply continues the topic instead of echoing its greeting
  // or treating incidental words inside a long cover as a fresh invitation.
  if (topicOverride !== undefined) topic = topicOverride;
  if (actOverride !== undefined) act = actOverride;
  if (!Number.isInteger(topic) || topic < 0 || topic >= TOPICS.length || !Number.isInteger(act) || act < 0 || act >= ACTS.length) throw new Error('Unsupported cover context.');
  return topic * ACTS.length + act;
}

export function encodeDialogue(packet: Uint8Array): string {
  validatePacket(packet);
  if (packet[3] !== 2) throw new Error('The dialogue codec requires a v2 packet.');
  const profile = packet[4];
  const topic = Math.floor(profile / ACTS.length);
  // One nonce byte first varies the initial structure. The length follows so
  // the decoder knows the stage schedule before the first stage transition.
  // The five-byte authenticated header is reconstructed from the public opener.
  const frame = new Uint8Array(packet.length - 3);
  frame[0] = packet[5];
  frame[1] = packet.length >>> 8;
  frame[2] = packet.length & 255;
  frame.set(packet.subarray(6, 17), 3);
  frame.set(packet.subarray(17), 14);
  let bit = 0;
  const read = (width: number): number => {
    let value = 0;
    for (let i = 0; i < width; i++, bit++) value = (value << 1) | (bit < frame.length * 8 ? (frame[bit >>> 3] >>> (7 - (bit & 7))) & 1 : 0);
    return value;
  };
  let previousStructure = 8;
  let previousSubject = 32;
  let cover = PROFILE_OPENERS[profile][packet[5] & 1] + (profile % ACTS.length === 3 ? ':' : '.');
  let previousStage = 0;
  let paragraphSentences = 0;
  while (bit < frame.length * 8) {
    const stage = Math.min(2, Math.floor(bit * 3 / (frame.length * 8)));
    const paragraph = stage !== previousStage || paragraphSentences === 4;
    if (paragraph) paragraphSentences = 0;
    previousStage = stage;
    const structure = without(structureIds, previousStructure)[read(3)];
    previousStructure = structure;
    let sentence = '';
    for (const part of STAGES[stage][structure]) {
      if (typeof part === 'string') sentence += part;
      else if (part.pool === 'subject') {
        const index = without(SUBJECTS_V2[topic].map((_, i) => i), previousSubject)[read(5)];
        previousSubject = index;
        sentence += SUBJECTS_V2[topic][index];
      } else {
        const pool = part.pool === 'future' ? FUTURE_BY_TOPIC[topic] : POOLS[part.pool];
        sentence += pool[read(Math.log2(pool.length))];
      }
    }
    cover += (paragraph ? '\n\n' : ' ') + sentence + '.';
    paragraphSentences++;
  }
  return cover;
}

export function decodeMessageCover(cover: string): Uint8Array<ArrayBuffer> {
  if (cover.length > MAX_COVER_CHARS) throw new Error('The cover text is too long.');
  const text = normalizeCover(cover);
  const opening = openerProfile(text);
  if (!opening) return decodeV1(cover);
  const topic = Math.floor(opening.profile / ACTS.length);
  let cursor = opening.length;
  let previousStructure = 8;
  let previousSubject = 32;
  const bits: number[] = [];
  const append = (value: number, width: number): void => { for (let shift = width - 1; shift >= 0; shift--) bits.push((value >>> shift) & 1); };
  const consume = (literal: string): void => {
    if (!text.startsWith(literal, cursor)) throw new Error('The cover text is incomplete or has been reworded. Copy all of it.');
    cursor += literal.length;
  };
  const readChoice = (pool: readonly string[]): number => {
    const index = pool.findIndex((candidate) => text.startsWith(candidate, cursor));
    if (index < 0) throw new Error('A cover phrase is missing or changed. Copy the complete text.');
    cursor += pool[index].length;
    return index;
  };
  const numberAt = (offset: number, width: number): number => bits.slice(offset, offset + width).reduce((value, next) => value * 2 + next, 0);
  let packetLength = 0;
  let frameBits = 0;
  while (!frameBits || bits.length < frameBits) {
    const stage = frameBits ? Math.min(2, Math.floor(bits.length * 3 / frameBits)) : 0;
    const normalizedStructures = normalizedStages[stage];
    const available = without(structureIds, previousStructure);
    const index = readChoice(available.map((id) => normalizedStructures[id][0] as string));
    append(index, 3);
    const structure = available[index];
    previousStructure = structure;
    for (const part of normalizedStructures[structure].slice(1)) {
      if (typeof part === 'string') consume(part);
      else if (part.pool === 'subject') {
        const indexes = without(normalizedSubjects[topic].map((_, i) => i), previousSubject);
        const selected = readChoice(indexes.map((i) => normalizedSubjects[topic][i]));
        append(selected, 5);
        previousSubject = indexes[selected];
      } else {
        const pool = part.pool === 'future' ? normalizedFuture[topic] : normalizedPools[part.pool as Exclude<PoolName, 'subject'>];
        append(readChoice(pool), Math.log2(pool.length));
      }
    }
    if (!frameBits && bits.length >= 24) {
      packetLength = numberAt(8, 16);
      if (packetLength < PACKET_OVERHEAD + 1 || packetLength > MAX_PACKET_BYTES) throw new Error('The cover length is invalid or the text is damaged.');
      frameBits = (packetLength - 3) * 8;
    }
    if (bits.length > (MAX_PACKET_BYTES - 3) * 8 + 20) throw new Error('The cover length is invalid.');
  }
  if (cursor !== text.length || bits.slice(frameBits).some(Boolean)) throw new Error('The cover has extra, missing, or changed content.');
  const frame = Uint8Array.from({ length: frameBits / 8 }, (_, i) => numberAt(i * 8, 8));
  const packet = new Uint8Array(packetLength);
  packet.set([66, 80, 80, 2, opening.profile]);
  packet[5] = frame[0];
  packet.set(frame.subarray(3, 14), 6);
  packet.set(frame.subarray(14), 17);
  validatePacket(packet);
  return packet;
}
