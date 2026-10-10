// Export only the immutable build-time shell plus the original bootstrap script.
// The key is an inert, restricted-format metadata value, not JavaScript or a URL.
export function personalFile(pristine: string, code: string): string {
  const canonical = code.replace(/[\s-]/g, '').toUpperCase();
  if (!/^BPP1[0-9A-F]{72}$/.test(canonical)) throw new Error('Invalid conversation code');
  const slot = '<meta name="bpp-conversation" content="">';
  if (!pristine.includes(slot)) throw new Error('Invalid file template');
  // The first occurrence belongs to the document head. Any later occurrence
  // is the inert shell literal inside the script and must remain key-free.
  return pristine.replace(slot, () => `<meta name="bpp-conversation" content="${canonical}">`);
}
