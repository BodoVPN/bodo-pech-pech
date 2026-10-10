// A fixed byte substitution, not a model or adaptive dictionary. The table is
// part of v2's wire format. It never normalizes the original UTF-8 bytes.
export const PACKING_ALPHABET = 'ا آ ب پ ت ث ج چ ح خ د ذ ر ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن و ه ی ء أ إ ؤ ئ ة ۀ ي ك ۰ ۱ ۲ ۳ ۴ ۵ ۶ ۷ ۸ ۹ ، ؛ ؟ ‌'.split(' ');
const entries = PACKING_ALPHABET.map((letter) => new TextEncoder().encode(letter));

export function packBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const packed: number[] = [1];
  for (let offset = 0; offset < bytes.length;) {
    const index = bytes[offset] < 128 ? -1 : entries.findIndex((entry) => entry.every((value, i) => bytes[offset + i] === value));
    if (index >= 0) { packed.push(128 + index); offset += entries[index].length; }
    else {
      if (bytes[offset] >= 128) packed.push(255);
      packed.push(bytes[offset++]);
    }
  }
  if (packed.length < bytes.length + 1) return new Uint8Array(packed);
  const raw = new Uint8Array(bytes.length + 1);
  raw.set(bytes, 1); // Mode 0: original bytes, for inputs that would expand.
  return raw;
}

export function unpackBytes(packed: Uint8Array, limit: number): Uint8Array<ArrayBuffer> {
  if (packed[0] === 0) {
    if (packed.length < 2 || packed.length > limit + 1) throw new Error('Invalid authenticated message length.');
    return packed.slice(1);
  }
  if (packed[0] !== 1) throw new Error('Unsupported authenticated message encoding.');
  const output: number[] = [];
  for (let offset = 1; offset < packed.length; offset++) {
    const value = packed[offset];
    if (value < 128) output.push(value);
    else if (value === 255) {
      if (++offset >= packed.length) throw new Error('Incomplete authenticated byte escape.');
      output.push(packed[offset]);
    } else {
      const entry = entries[value - 128];
      if (!entry) throw new Error('Invalid authenticated byte symbol.');
      output.push(...entry);
    }
    if (output.length > limit) throw new Error('The authenticated message exceeds the supported size.');
  }
  if (!output.length) throw new Error('The authenticated message is empty.');
  return new Uint8Array(output);
}
