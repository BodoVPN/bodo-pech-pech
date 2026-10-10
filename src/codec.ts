import { MAX_PACKET_BYTES, PACKET_OVERHEAD, packetTopic } from './crypto.ts';

export const MAX_COVER_CHARS = 180_000;
export const TOPIC_NAMES = ['Everyday life', 'Food and tea', 'Getting outside'] as const;
// These tables are the v1 wire format. Reordering or editing them is a protocol change.
export const OPENERS = [
  'راستی از حال و روزت بگو',
  'حالا که صحبت خوراکی شد',
  'درباره بیرون رفتن که گفتی',
] as const;
export const STARTS = [
  'راستش', 'اتفاقا', 'خلاصه', 'جالب اینکه', 'به نظرم', 'از قضا', 'امروز', 'دیروز',
  'این بار', 'تازه', 'بالاخره', 'در کل', 'برای من', 'اگر بپرسی', 'یادم هست', 'حالا که فکر می‌کنم',
] as const;
export const SUBJECTS = [
  ['این استراحت کوتاه', 'آن گپ دوستانه', 'یک عصر آرام', 'تماشای آن فیلم', 'خواندن آن کتاب', 'صدای موسیقی', 'وقت گذراندن در خانه', 'رسیدگی به گلدان', 'دیدن عکس قدیمی', 'تماس با یک دوست', 'مرتب کردن اتاق', 'شنیدن آن داستان', 'خواب بعدازظهر', 'نوشتن چند خط', 'سکوت صبح', 'نور کنار پنجره'],
  ['چای تازه', 'قهوه صبح', 'نان گرم', 'صبحانه ساده', 'شام خانگی', 'سوپ داغ', 'برنج زعفرانی', 'کیک عصرانه', 'میوه تازه', 'سالاد رنگارنگ', 'خوراک سبزیجات', 'دسر خانگی', 'آش رشته', 'سیب پخته', 'شربت خنک', 'بوی دارچین'],
  ['قدم زدن در پارک', 'هوای خنک', 'بوی باران', 'مسیر کنار رودخانه', 'آفتاب صبح', 'سایه درخت', 'تماشای آسمان', 'دیدن کوه', 'نسیم عصر', 'صدای پرنده', 'پیاده‌روی کوتاه', 'نشستن روی نیمکت', 'سفر یک روزه', 'منظره باغ', 'خلوت کوچه', 'راه برگشت'],
] as const;
export const MIDDLES = [
  'خیلی خوب بود', 'واقعا دلنشین بود', 'حس خوبی داشت', 'ارزشش را داشت',
  'آرامش خاصی داشت', 'مثل همیشه دلچسب بود', 'بیشتر از انتظارم خوب بود', 'برای تنوع بد نبود',
  'جای تعریف داشت', 'به دلم نشست', 'از خاطرم نرفت', 'بهتر از دفعه قبل بود',
  'یک جور دیگری بود', 'حالم را بهتر کرد', 'در نوع خودش جالب بود', 'بدون شک خوشایند بود',
] as const;
export const ENDS = [
  'تو چه فکر می‌کنی', 'باز هم از این خبرها بگو', 'بعدا بیشتر حرف می‌زنیم', 'امیدوارم روزت خوب باشد',
  'من که راضی بودم', 'دلم می‌خواهد تکرارش کنم', 'شاید باز هم پیش بیاید', 'باید برایش وقت بگذاریم',
  'حیف که زود گذشت', 'هنوز هم یادش هستم', 'ببینیم دفعه بعد چه می‌شود', 'حالا نوبت توست',
  'کاش تو هم بودی', 'فعلا همین را بگویم', 'راستی تو چه خبر', 'حتما دوباره درباره‌اش حرف می‌زنیم',
] as const;

export function normalizeCover(text: string): string {
  return text.normalize('NFKC').replace(/[يك]/g, (letter) => letter === 'ي' ? 'ی' : 'ک')
    .replace(/[\u064B-\u065F]/gu, '').replace(/\u0670/gu, '')
    .replace(/[\s\p{P}\u0640\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/gu, '');
}

export function chooseTopic(context: string): number {
  const text = normalizeCover(context);
  const existing = OPENERS.findIndex((opener) => text.startsWith(normalizeCover(opener)));
  if (existing >= 0) return existing;
  if (/چای|قهوه|غذا|خوراک|ناهار|شام|صبحانه|کیک|نان|آشپزی/.test(text)) return 1;
  if (/باران|هوا|پارک|بیرون|قدم|سفر|پیاده|کوه|آفتاب/.test(text)) return 2;
  return 0;
}

export function encodeCover(packet: Uint8Array): string {
  const topic = packetTopic(packet);
  // A 16-bit byte length followed by the packet and (only if needed) one zero pad byte.
  const framed = new Uint8Array(2 + packet.length + (packet.length % 2));
  new DataView(framed.buffer).setUint16(0, packet.length, false);
  framed.set(packet, 2);
  const sentences = [`${OPENERS[topic]}.`];
  for (let index = 0; index < framed.length; index += 2) {
    const a = framed[index];
    const b = framed[index + 1];
    sentences.push(`${STARTS[a >>> 4]} ${SUBJECTS[topic][a & 15]} ${MIDDLES[b >>> 4]}؛ ${ENDS[b & 15]}.`);
  }
  return sentences.join(' ');
}

export function decodeCover(cover: string): Uint8Array<ArrayBuffer> {
  if (!cover.trim()) throw new Error('Paste the Persian cover text first.');
  if (cover.length > MAX_COVER_CHARS) throw new Error('This cover text is too long for this prototype.');
  const normalized = normalizeCover(cover);
  const topic = OPENERS.findIndex((opener) => normalized.startsWith(normalizeCover(opener)));
  if (topic < 0) throw new Error('The cover opening is missing or unrecognized. Paste only the complete cover text, without sender names or timestamps.');
  const tables = [STARTS, SUBJECTS[topic], MIDDLES, ENDS].map((table) => table.map(normalizeCover));
  let position = normalizeCover(OPENERS[topic]).length;
  const nibbles: number[] = [];
  while (position < normalized.length) {
    const table = tables[nibbles.length % 4];
    const choice = table.findIndex((phrase) => normalized.startsWith(phrase, position));
    if (choice < 0) throw new Error('The cover text is incomplete or contains changed words. Copy it again without editing or translating it.');
    nibbles.push(choice);
    position += table[choice].length;
    if (nibbles.length > (MAX_PACKET_BYTES + 3) * 2) throw new Error('The encoded message exceeds the supported size.');
  }
  if (nibbles.length < 4 || nibbles.length % 4) throw new Error('The cover text ends before a complete sentence.');
  const framed = new Uint8Array(nibbles.length / 2);
  for (let index = 0; index < framed.length; index++) framed[index] = (nibbles[index * 2] << 4) | nibbles[index * 2 + 1];
  const length = new DataView(framed.buffer).getUint16(0, false);
  const expected = 2 + length + (length % 2);
  if (length < PACKET_OVERHEAD + 1 || length > MAX_PACKET_BYTES || expected !== framed.length || (length % 2 && framed.at(-1) !== 0)) {
    throw new Error('The message length does not match. The cover text may be truncated, duplicated, or changed.');
  }
  const packet = framed.slice(2, 2 + length);
  if (packetTopic(packet) !== topic) throw new Error('The cover topic does not match its message. Copy the original cover text.');
  return packet;
}
