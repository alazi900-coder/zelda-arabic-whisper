// ============================================================
// Scene Mixer — concat WAVs in browser + generate SRT
// ============================================================

export interface SceneClip {
  url: string;
  charName: string;
  text: string;
  /** فاصل صامت بعد المقطع بالميلي ثانية */
  gapMs?: number;
}

/** يحوّل WAV blob URL إلى AudioBuffer */
async function urlToAudioBuffer(url: string, ctx: AudioContext): Promise<AudioBuffer> {
  const res = await fetch(url);
  const arr = await res.arrayBuffer();
  return ctx.decodeAudioData(arr);
}

/** يولّد AudioBuffer صامت بطول معيّن */
function silence(ctx: AudioContext, ms: number, sampleRate: number, channels: number): AudioBuffer {
  const len = Math.max(1, Math.round((ms / 1000) * sampleRate));
  return ctx.createBuffer(channels, len, sampleRate);
}

/** يدمج عدّة AudioBuffers في buffer واحد بالترتيب */
function concatBuffers(ctx: AudioContext, buffers: AudioBuffer[]): AudioBuffer {
  if (buffers.length === 0) throw new Error("لا توجد مقاطع");
  const sampleRate = buffers[0].sampleRate;
  const channels = buffers[0].numberOfChannels;
  const totalLen = buffers.reduce((s, b) => s + b.length, 0);
  const out = ctx.createBuffer(channels, totalLen, sampleRate);
  for (let ch = 0; ch < channels; ch++) {
    const dst = out.getChannelData(ch);
    let off = 0;
    for (const b of buffers) {
      const src = b.getChannelData(Math.min(ch, b.numberOfChannels - 1));
      dst.set(src, off);
      off += b.length;
    }
  }
  return out;
}

/** يحوّل AudioBuffer إلى WAV Blob (PCM 16-bit) */
function audioBufferToWavBlob(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels;
  const sr = buf.sampleRate;
  const len = buf.length * ch * 2;
  const ab = new ArrayBuffer(44 + len);
  const v = new DataView(ab);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, 36 + len, true); ws(8, "WAVE");
  ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true);
  v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  ws(36, "data"); v.setUint32(40, len, true);

  let off = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < ch; c++) channels.push(buf.getChannelData(c));
  for (let i = 0; i < buf.length; i++) {
    for (let c = 0; c < ch; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      v.setInt16(off, s, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

export interface MixResult {
  blob: Blob;
  url: string;
  /** بداية كل مقطع بالميلي ثانية في الـ mix */
  starts: number[];
  /** نهاية كل مقطع بالميلي ثانية */
  ends: number[];
  durationMs: number;
}

/** يدمج المقاطع ويرجع WAV واحد + توقيتات */
export async function mixScene(clips: SceneClip[]): Promise<MixResult> {
  if (clips.length === 0) throw new Error("لا توجد مقاطع للدمج");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
  const ctx: AudioContext = new Ctx();
  try {
    const buffers: AudioBuffer[] = [];
    const starts: number[] = [];
    const ends: number[] = [];
    let cursorMs = 0;
    let firstSampleRate = 0;
    let firstChannels = 0;

    for (let i = 0; i < clips.length; i++) {
      const buf = await urlToAudioBuffer(clips[i].url, ctx);
      if (i === 0) { firstSampleRate = buf.sampleRate; firstChannels = buf.numberOfChannels; }
      buffers.push(buf);
      const durMs = (buf.length / buf.sampleRate) * 1000;
      starts.push(cursorMs);
      ends.push(cursorMs + durMs);
      cursorMs += durMs;

      const gap = clips[i].gapMs ?? 350;
      if (gap > 0 && i < clips.length - 1) {
        buffers.push(silence(ctx, gap, firstSampleRate, firstChannels));
        cursorMs += gap;
      }
    }

    const merged = concatBuffers(ctx, buffers);
    const blob = audioBufferToWavBlob(merged);
    const url = URL.createObjectURL(blob);
    return { blob, url, starts, ends, durationMs: cursorMs };
  } finally {
    if (ctx.state !== "closed") ctx.close().catch(() => {});
  }
}

/** يحوّل ms إلى توقيت SRT: HH:MM:SS,mmm */
function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const mm = Math.floor(ms % 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(mm, 3)}`;
}

/** يولّد محتوى ملف SRT من المقاطع وتوقيتاتها */
export function buildSrt(clips: SceneClip[], starts: number[], ends: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    out.push(String(i + 1));
    out.push(`${msToSrtTime(starts[i])} --> ${msToSrtTime(ends[i])}`);
    out.push(`${clips[i].charName}: ${clips[i].text}`);
    out.push("");
  }
  return out.join("\n");
}

export { msToSrtTime };
