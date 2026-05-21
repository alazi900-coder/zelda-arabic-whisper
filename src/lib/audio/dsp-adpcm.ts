// Nintendo DSP-ADPCM decoder (GC/Wii/Switch).
// Decodes one channel of DSP-ADPCM bytes to Int16 samples using provided coefficients.
// Each frame = 8 bytes (1 header + 7 data) producing 14 samples.
export function decodeDspAdpcm(
  data: Uint8Array,
  coefs: Int16Array, // length 16
  numSamples: number,
  initialPS: number,
  initialHist1: number,
  initialHist2: number,
): Int16Array {
  const out = new Int16Array(numSamples);
  let hist1 = initialHist1 | 0;
  let hist2 = initialHist2 | 0;
  let sampleIdx = 0;
  let byteIdx = 0;
  // first frame uses initial PS too; vgmstream re-reads PS from each frame header
  while (sampleIdx < numSamples && byteIdx < data.length) {
    const header = data[byteIdx++];
    const scale = 1 << (header & 0x0f);
    const coefIdx = (header >> 4) & 0x07;
    const c1 = coefs[coefIdx * 2];
    const c2 = coefs[coefIdx * 2 + 1];
    for (let s = 0; s < 14 && sampleIdx < numSamples; s++) {
      let nibble: number;
      if ((s & 1) === 0) {
        nibble = (data[byteIdx] >> 4) & 0x0f;
      } else {
        nibble = data[byteIdx] & 0x0f;
        byteIdx++;
      }
      // sign-extend 4-bit
      if (nibble >= 8) nibble -= 16;
      let sample = (((nibble * scale) << 11) + 1024 + (c1 * hist1 + c2 * hist2)) >> 11;
      if (sample > 32767) sample = 32767;
      else if (sample < -32768) sample = -32768;
      out[sampleIdx++] = sample;
      hist2 = hist1;
      hist1 = sample;
    }
    // if we exited mid-byte (odd s ended on nibble 0), the next nibble in same byte is wasted — but we always do 14 nibbles = 7 bytes
  }
  // suppress unused warning
  void initialPS;
  return out;
}

// Compute number of bytes that encode N samples in DSP-ADPCM
export function dspBytesForSamples(numSamples: number): number {
  const frames = Math.ceil(numSamples / 14);
  return frames * 8;
}
