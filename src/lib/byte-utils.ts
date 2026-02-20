/**
 * Calculate the byte length of a string in UTF-8 encoding.
 * XC3 (Xenoblade Chronicles 3) BDAT files use UTF-8.
 * - ASCII chars  (U+0000–U+007F)  → 1 byte
 * - Latin/Greek  (U+0080–U+07FF)  → 2 bytes
 * - Arabic/CJK   (U+0800–U+FFFF)  → 3 bytes  ← Arabic is here
 * - Emoji/SMP    (U+10000+)        → 4 bytes (surrogate pair in JS)
 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xD800 && code <= 0xDBFF) {
      // Surrogate pair → U+10000 and above → 4 bytes in UTF-8
      bytes += 4;
      i++; // Skip the low surrogate
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

/**
 * Calculate the byte length of a string in UTF-16LE encoding.
 * Kept for legacy MSBT compatibility (Zelda).
 */
export function utf16leByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDBFF) {
      bytes += 4;
      i++;
    } else {
      bytes += 2;
    }
  }
  return bytes;
}
