// BWAV (NintendoWare) parser + decoder
// Supports codecs: 0=PCM16LE, 1=DSP-ADPCM (GC/Switch), 2=NXOpus (Zelda TotK)
// Reference: vgmstream src/meta/bwav.c

import { decodeDspAdpcm, dspBytesForSamples } from "./dsp-adpcm";
import { OpusDecoder } from "opus-decoder";

export type BwavCodec = "pcm16" | "dsp" | "opus" | "unknown";

export interface BwavChannelInfo {
  codecId: number;
  layout: number;
  sampleRate: number;
  numSamples: number;
  numSamplesPrefetch: number;
  dataOffset: number; // start_offset for this channel (0x34) — also opus subfile offset for codec 2
  loopEnd: number;
  loopStart: number;
  coefs: Int16Array; // 16 coefs
  initialPS: number;
  initialHist1: number;
  initialHist2: number;
}

export interface BwavInfo {
  channels: number;
  codec: BwavCodec;
  sampleRate: number;
  numSamples: number;
  channelInfos: BwavChannelInfo[];
  isPrefetch: boolean;
}

const CHANNEL_ENTRY_SIZE = 0x4c;
const HEADER_SIZE = 0x10;

function readU16LE(d: DataView, o: number) { return d.getUint16(o, true); }
function readU32LE(d: DataView, o: number) { return d.getUint32(o, true); }
function readS32LE(d: DataView, o: number) { return d.getInt32(o, true); }
function readS16LE(d: DataView, o: number) { return d.getInt16(o, true); }

export function parseBwav(buf: Uint8Array): BwavInfo {
  if (buf.length < HEADER_SIZE + CHANNEL_ENTRY_SIZE) throw new Error("الملف صغير جدًا ليكون BWAV");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf[0] !== 0x42 || buf[1] !== 0x57 || buf[2] !== 0x41 || buf[3] !== 0x56)
    throw new Error("ليس ملف BWAV (التوقيع غير صحيح)");
  if (dv.getUint16(4, true) !== 0xFEFF) throw new Error("BOM غير مدعوم");
  const isPrefetch = readU16LE(dv, 0x0c) !== 0;
  const channels = readU16LE(dv, 0x0e);
  if (channels < 1 || channels > 8) throw new Error(`عدد قنوات غير مدعوم: ${channels}`);

  const infos: BwavChannelInfo[] = [];
  for (let ch = 0; ch < channels; ch++) {
    const base = HEADER_SIZE + ch * CHANNEL_ENTRY_SIZE;
    if (base + CHANNEL_ENTRY_SIZE > buf.length) throw new Error("بيانات القنوات مقطوعة");
    const coefs = new Int16Array(16);
    for (let i = 0; i < 16; i++) coefs[i] = readS16LE(dv, base + 0x10 + i * 2);
    infos.push({
      codecId: readU16LE(dv, base + 0x00),
      layout: readU16LE(dv, base + 0x02),
      sampleRate: readS32LE(dv, base + 0x04),
      numSamples: readS32LE(dv, base + 0x08),
      numSamplesPrefetch: readS32LE(dv, base + 0x0c),
      dataOffset: readU32LE(dv, base + 0x34),
      loopEnd: readS32LE(dv, base + 0x3c),
      loopStart: readS32LE(dv, base + 0x40),
      coefs,
      initialPS: readU16LE(dv, base + 0x44),
      initialHist1: readS16LE(dv, base + 0x46),
      initialHist2: readS16LE(dv, base + 0x48),
    });
  }
  const codecId = infos[0].codecId;
  const codec: BwavCodec =
    codecId === 0 ? "pcm16" :
    codecId === 1 ? "dsp" :
    codecId === 2 ? "opus" : "unknown";

  return {
    channels,
    codec,
    sampleRate: infos[0].sampleRate,
    numSamples: infos[0].numSamples,
    channelInfos: infos,
    isPrefetch,
  };
}

/** Decode PCM16 codec (interleaved between channels). */
function decodePcm16(buf: Uint8Array, info: BwavInfo): Int16Array {
  const ch = info.channels;
  const totalSamples = info.numSamples * ch;
  const out = new Int16Array(totalSamples);
  if (ch === 1) {
    const start = info.channelInfos[0].dataOffset;
    const dv = new DataView(buf.buffer, buf.byteOffset + start, info.numSamples * 2);
    for (let i = 0; i < info.numSamples; i++) out[i] = dv.getInt16(i * 2, true);
    return out;
  }
  // Multi-channel: each channel is a separate block at its own dataOffset
  for (let c = 0; c < ch; c++) {
    const start = info.channelInfos[c].dataOffset;
    const n = info.channelInfos[c].numSamples;
    const dv = new DataView(buf.buffer, buf.byteOffset + start, n * 2);
    for (let i = 0; i < n; i++) out[i * ch + c] = dv.getInt16(i * 2, true);
  }
  return out;
}

/** Decode DSP-ADPCM codec. */
function decodeDsp(buf: Uint8Array, info: BwavInfo): Int16Array {
  const ch = info.channels;
  const channelSamples: Int16Array[] = [];
  for (let c = 0; c < ch; c++) {
    const ci = info.channelInfos[c];
    const dataLen = dspBytesForSamples(ci.numSamples);
    const slice = buf.subarray(ci.dataOffset, ci.dataOffset + dataLen);
    channelSamples.push(
      decodeDspAdpcm(slice, ci.coefs, ci.numSamples, ci.initialPS, ci.initialHist1, ci.initialHist2),
    );
  }
  // interleave
  const n = info.numSamples;
  const out = new Int16Array(n * ch);
  for (let c = 0; c < ch; c++) {
    const cs = channelSamples[c];
    for (let i = 0; i < n; i++) out[i * ch + c] = cs[i] || 0;
  }
  return out;
}

/** Parse a Nintendo Opus (NXOpus) subfile and return individual Opus packets.
 *  NXOpus layout: 0x18 info header + 0x10 data header + packets.
 *  Each packet: 4-byte BE size + 4-byte BE final_range + raw opus packet bytes. */
function extractNxOpusPackets(buf: Uint8Array, offset: number): { packets: Uint8Array[]; sampleRate: number; channels: number; preSkip: number } {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // info header
  const infoMagic = dv.getUint32(offset + 0x00, false);
  if (infoMagic !== 0x80000001) throw new Error("NXOpus: توقيع info غير صحيح");
  const channels = buf[offset + 0x09];
  const sampleRate = readU32LE(dv, offset + 0x0c);
  const dataOffset = readU32LE(dv, offset + 0x10);
  const preSkip = readU16LE(dv, offset + 0x14);
  // data header at offset + dataOffset
  const dataStart = offset + dataOffset;
  const dataMagic = dv.getUint32(dataStart + 0x00, false);
  if (dataMagic !== 0x80000004) throw new Error("NXOpus: توقيع data غير صحيح");
  const dataSize = dv.getUint32(dataStart + 0x04, false);
  const packets: Uint8Array[] = [];
  let p = dataStart + 0x08;
  const end = p + dataSize;
  while (p < end) {
    const pktSize = dv.getUint32(p, false);
    p += 8; // skip size + final_range
    if (pktSize === 0 || p + pktSize > end) break;
    packets.push(buf.subarray(p, p + pktSize));
    p += pktSize;
  }
  return { packets, sampleRate, channels, preSkip };
}

/** Decode NXOpus (TotK) BWAV. Each channel is a mono Opus subfile. */
async function decodeOpus(buf: Uint8Array, info: BwavInfo): Promise<{ samples: Int16Array; sampleRate: number }> {
  const ch = info.channels;
  const decodedChannels: Float32Array[] = [];
  let outRate = 48000;
  let preSkip = 0;
  for (let c = 0; c < ch; c++) {
    const subOffset = info.channelInfos[c].dataOffset;
    const { packets, sampleRate, preSkip: ps } = extractNxOpusPackets(buf, subOffset);
    outRate = sampleRate;
    preSkip = ps;
    // opus-decoder only supports a fixed sample-rate enum; NXOpus is typically 48000.
    const decoder = new OpusDecoder({ channels: 1, sampleRate: 48000 });
    await decoder.ready;
    const pieces: Float32Array[] = [];
    let total = 0;
    for (const pkt of packets) {
      const { channelData, samplesDecoded } = decoder.decodeFrame(pkt);
      if (samplesDecoded > 0 && channelData[0]) {
        pieces.push(channelData[0].slice(0, samplesDecoded));
        total += samplesDecoded;
      }
    }
    decoder.free();
    const merged = new Float32Array(total);
    let off = 0;
    for (const piece of pieces) { merged.set(piece, off); off += piece.length; }
    // strip pre-skip samples
    const trimmed = preSkip > 0 && preSkip < merged.length ? merged.subarray(preSkip) : merged;
    decodedChannels.push(trimmed);
  }
  const n = Math.min(...decodedChannels.map(c => c.length));
  const interleaved = new Int16Array(n * ch);
  for (let c = 0; c < ch; c++) {
    const cd = decodedChannels[c];
    for (let i = 0; i < n; i++) {
      let v = Math.round(cd[i] * 32767);
      if (v > 32767) v = 32767; else if (v < -32768) v = -32768;
      interleaved[i * ch + c] = v;
    }
  }
  return { samples: interleaved, sampleRate: outRate };
}

export async function decodeBwavToPcm(buf: Uint8Array): Promise<{ samples: Int16Array; sampleRate: number; channels: number; info: BwavInfo }> {
  const info = parseBwav(buf);
  if (info.codec === "pcm16") {
    return { samples: decodePcm16(buf, info), sampleRate: info.sampleRate, channels: info.channels, info };
  }
  if (info.codec === "dsp") {
    return { samples: decodeDsp(buf, info), sampleRate: info.sampleRate, channels: info.channels, info };
  }
  if (info.codec === "opus") {
    const { samples, sampleRate } = await decodeOpus(buf, info);
    return { samples, sampleRate, channels: info.channels, info };
  }
  throw new Error(`صيغة BWAV غير مدعومة: codec=${info.channelInfos[0].codecId}`);
}
