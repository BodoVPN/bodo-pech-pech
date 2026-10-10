import { parseEnvelope } from './key-storage.ts';

// Only an authenticated-encryption envelope goes into the immutable shell.
// No live DOM, passphrase, plaintext key or legacy code is ever exported.
export function personalFile(pristine: string, envelope: string): string {
  parseEnvelope(envelope);
  const slot = '<meta name="bpp-conversation" content="">';
  if (!pristine.includes(slot)) throw new Error('Invalid file template');
  // The first occurrence belongs to the document head. Any later occurrence
  // is the inert shell literal inside the script and must remain key-free.
  return pristine.replace(slot, () => `<meta name="bpp-conversation" content="${envelope}">`);
}
