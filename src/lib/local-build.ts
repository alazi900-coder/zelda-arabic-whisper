// In-browser version of the build pipeline that used to live inside the
// `arabize` Supabase Edge Function. Moving this client-side avoids the 546
// (WORKER_LIMIT) errors caused by zstd compression exceeding the function's
// CPU/memory budget, and works fully offline once the page has loaded.

import {
  ensureZstdReady,
  compress,
  compressUsingDict,
  createCCtx,
  createDCtx,
  decompress,
  decompressUsingDict,
} from "./zstd";
import {
  hasArabicPresentationForms,
  processArabicText,
  reshapeArabic,
  convertToArabicNumerals,
  mirrorPunctuation,
} from "./arabic-processing";

// =============================================================================
// MSBT parsing / rebuilding
// =============================================================================

interface TagInfo {
  markerCode: number; // PUA character code (0xE000+)
  bytes: Uint8Array;  // raw tag bytes from MSBT
}

export interface MsbtEntry {
  label: string;
  originalText: string;
  processedText: string;
  offset: number;
  size: number;
  tags: TagInfo[];
}

interface MsbtSection {
  magic: string;
  data: Uint8Array;
  size: number;
}

function readAscii(data: Uint8Array, pos: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(data[pos + i]);
  return s;
}

export function parseMSBT(data: Uint8Array): { entries: MsbtEntry[]; raw: Uint8Array } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (!readAscii(data, 0, 8).startsWith("MsgStdBn")) {
    throw new Error("Not a valid MSBT file");
  }

  const entries: MsbtEntry[] = [];
  const labelMap = new Map<number, string>();
  let pos = 0x20;
  while (pos < data.length - 16) {
    const sectionMagic = readAscii(data, pos, 4);
    const sectionSize = view.getUint32(pos + 4, true);
    if (sectionMagic === "LBL1") {
      const lbl1Start = pos + 16;
      const numBuckets = view.getUint32(lbl1Start, true);
      for (let b = 0; b < numBuckets; b++) {
        const bucketLabelCount = view.getUint32(lbl1Start + 4 + b * 8, true);
        const bucketOffset = view.getUint32(lbl1Start + 4 + b * 8 + 4, true);
        let labelPos = lbl1Start + bucketOffset;
        for (let l = 0; l < bucketLabelCount; l++) {
          const labelLen = data[labelPos];
          labelPos++;
          let labelName = "";
          for (let c = 0; c < labelLen; c++) {
            labelName += String.fromCharCode(data[labelPos + c]);
          }
          labelPos += labelLen;
          const itemIndex = view.getUint32(labelPos, true);
          labelPos += 4;
          labelMap.set(itemIndex, labelName);
        }
      }
      break;
    }
    pos += 16 + sectionSize;
    pos = (pos + 15) & ~15;
  }

  pos = 0x20;
  while (pos < data.length - 16) {
    const sectionMagic = readAscii(data, pos, 4);
    const sectionSize = view.getUint32(pos + 4, true);

    if (sectionMagic === "TXT2") {
      const txt2Start = pos + 16;
      const entryCount = view.getUint32(txt2Start, true);

      for (let i = 0; i < entryCount; i++) {
        const entryOffset = view.getUint32(txt2Start + 4 + i * 4, true);
        const nextOffset = i < entryCount - 1
          ? view.getUint32(txt2Start + 4 + (i + 1) * 4, true)
          : sectionSize;

        const absOffset = txt2Start + entryOffset;
        const textLength = nextOffset - entryOffset;

        const textParts: string[] = [];
        const tags: TagInfo[] = [];

        for (let j = 0; j < textLength - 2; j += 2) {
          const charCode = view.getUint16(absOffset + j, true);
          if (charCode === 0) break;
          if (charCode === 0x0E) {
            const paramSize = view.getUint16(absOffset + j + 6, true);
            const totalTagBytes = 8 + paramSize;
            const markerCode = 0xE000 + tags.length;
            const tagBytes = data.slice(absOffset + j, absOffset + j + totalTagBytes);
            tags.push({ markerCode, bytes: tagBytes });
            j += 6 + paramSize;
            textParts.push(String.fromCharCode(markerCode));
            continue;
          }
          textParts.push(String.fromCharCode(charCode));
        }
        const text = textParts.join("");

        entries.push({
          label: labelMap.get(i) || `entry_${i}`,
          originalText: text,
          processedText: text,
          offset: absOffset,
          size: textLength,
          tags,
        });
      }
      break;
    }
    pos += 16 + sectionSize;
    pos = (pos + 15) & ~15;
  }

  return { entries, raw: data };
}

export function encodeEntryToBytes(entry: MsbtEntry): Uint8Array {
  const tagMap = new Map<number, Uint8Array>();
  for (const tag of entry.tags) tagMap.set(tag.markerCode, tag.bytes);

  const parts: number[] = [];
  for (let i = 0; i < entry.processedText.length; i++) {
    const code = entry.processedText.charCodeAt(i);
    const tagBytes = tagMap.get(code);
    if (tagBytes) {
      for (const b of tagBytes) parts.push(b);
    } else {
      parts.push(code & 0xFF);
      parts.push((code >> 8) & 0xFF);
    }
  }
  parts.push(0, 0);
  return new Uint8Array(parts);
}

function alignTo16(size: number): number {
  return (size + 15) & ~15;
}

function padSection(buf: Uint8Array, contentLen: number): Uint8Array {
  const aligned = alignTo16(contentLen);
  if (aligned === contentLen) return buf;
  const padded = new Uint8Array(aligned);
  padded.set(buf);
  for (let i = contentLen; i < aligned; i++) padded[i] = 0xAB;
  return padded;
}

function parseMSBTSections(data: Uint8Array): MsbtSection[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const sections: MsbtSection[] = [];
  let pos = 0x20;

  while (pos < data.length - 16) {
    const magic = readAscii(data, pos, 4);
    const sectionSize = view.getUint32(pos + 4, true);
    if (sectionSize === 0 && magic === "\0\0\0\0") break;

    sections.push({
      magic,
      data: data.slice(pos + 16, pos + 16 + sectionSize),
      size: sectionSize,
    });

    pos += 16 + sectionSize;
    pos = (pos + 15) & ~15;
  }
  return sections;
}

export function rebuildMSBT(data: Uint8Array, entries: MsbtEntry[], entriesToModify?: Set<number>): Uint8Array {
  const sections = parseMSBTSections(data);

  const txt2Section = sections.find(s => s.magic === "TXT2");
  if (!txt2Section) return data;

  const txt2View = new DataView(txt2Section.data.buffer, txt2Section.data.byteOffset, txt2Section.data.byteLength);
  const entryCount = txt2View.getUint32(0, true);

  const encodedEntries: Uint8Array[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (entriesToModify && !entriesToModify.has(i)) {
      const origOffset = txt2View.getUint32(4 + i * 4, true);
      const nextOffset = i < entryCount - 1
        ? txt2View.getUint32(4 + (i + 1) * 4, true)
        : txt2Section.size;
      encodedEntries.push(txt2Section.data.slice(origOffset, nextOffset));
    } else {
      encodedEntries.push(encodeEntryToBytes(entries[i]));
    }
  }

  const offsetTableSize = 4 + entryCount * 4;
  let dataSize = 0;
  for (const enc of encodedEntries) dataSize += enc.length;
  const txt2ContentSize = offsetTableSize + dataSize;

  const newTxt2Content = new Uint8Array(txt2ContentSize);
  const txt2ContentView = new DataView(newTxt2Content.buffer);
  txt2ContentView.setUint32(0, entryCount, true);

  let currentOffset = offsetTableSize;
  for (let i = 0; i < encodedEntries.length; i++) {
    txt2ContentView.setUint32(4 + i * 4, currentOffset, true);
    newTxt2Content.set(encodedEntries[i], currentOffset);
    currentOffset += encodedEntries[i].length;
  }

  const sectionBuffers: Uint8Array[] = [];
  let totalContentSize = 0;

  for (const section of sections) {
    const sectionHeader = new Uint8Array(16);
    const shView = new DataView(sectionHeader.buffer);
    for (let i = 0; i < 4; i++) sectionHeader[i] = section.magic.charCodeAt(i);

    let content: Uint8Array;
    if (section.magic === "TXT2") {
      content = newTxt2Content;
      shView.setUint32(4, txt2ContentSize, true);
    } else {
      content = section.data;
      shView.setUint32(4, section.size, true);
    }

    const fullSection = new Uint8Array(16 + content.length);
    fullSection.set(sectionHeader);
    fullSection.set(content, 16);

    const padded = padSection(fullSection, fullSection.length);
    sectionBuffers.push(padded);
    totalContentSize += padded.length;
  }

  const msbtHeader = new Uint8Array(0x20);
  msbtHeader.set(data.slice(0, 0x20));

  const fileSize = 0x20 + totalContentSize;
  const headerView = new DataView(msbtHeader.buffer);
  headerView.setUint32(18, fileSize, true);

  const result = new Uint8Array(fileSize);
  result.set(msbtHeader);
  let writePos = 0x20;
  for (const buf of sectionBuffers) {
    result.set(buf, writePos);
    writePos += buf.length;
  }

  return result;
}

// =============================================================================
// SARC parsing / rebuilding
// =============================================================================

export interface SarcFile { name: string; data: Uint8Array; }

export function parseSARC(data: Uint8Array): SarcFile[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (readAscii(data, 0, 4) !== "SARC") throw new Error("Not a valid SARC archive");

  const headerSize = view.getUint16(4, true);
  const dataOffset = view.getUint32(0x0C, true);
  const sfatOffset = headerSize;
  if (readAscii(data, sfatOffset, 4) !== "SFAT") throw new Error("Missing SFAT section");

  const nodeCount = view.getUint16(sfatOffset + 6, true);
  const sfntOffset = sfatOffset + 12 + nodeCount * 16;
  const files: SarcFile[] = [];

  for (let i = 0; i < nodeCount; i++) {
    const nodeOffset = sfatOffset + 12 + i * 16;
    const nameOffset = (view.getUint32(nodeOffset + 4, true) & 0x00FFFFFF) * 4;
    const fileDataStart = view.getUint32(nodeOffset + 8, true);
    const fileDataEnd = view.getUint32(nodeOffset + 12, true);

    let name = "";
    let p = sfntOffset + 8 + nameOffset;
    while (p < data.length && data[p] !== 0) {
      name += String.fromCharCode(data[p]);
      p++;
    }

    files.push({ name, data: data.slice(dataOffset + fileDataStart, dataOffset + fileDataEnd) });
  }
  return files;
}

function sarcHash(name: string, multiplier: number): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * multiplier + name.charCodeAt(i)) & 0xFFFFFFFF;
  }
  return hash >>> 0;
}

export function rebuildSARC(files: SarcFile[], originalData: Uint8Array): Uint8Array {
  const origView = new DataView(originalData.buffer, originalData.byteOffset, originalData.byteLength);
  const headerSize = origView.getUint16(4, true);
  const bom = origView.getUint16(6, true);
  const version = origView.getUint16(0x10, true);

  const sfatOffset = headerSize;
  const nodeCount = origView.getUint16(sfatOffset + 6, true);
  const hashMultiplier = origView.getUint32(sfatOffset + 8, true);

  const nameBytes: Uint8Array[] = [];
  const nameOffsets: number[] = [];
  let namePos = 0;

  for (const file of files) {
    nameOffsets.push(namePos);
    const encoded = new TextEncoder().encode(file.name);
    const nameAligned = (encoded.length + 1 + 3) & ~3;
    const nameBuf = new Uint8Array(nameAligned);
    nameBuf.set(encoded);
    nameBytes.push(nameBuf);
    namePos += nameAligned;
  }

  const sfntContentSize = namePos;
  const sfntTotalSize = 8 + sfntContentSize;
  const sfntAligned = alignTo16(sfntTotalSize);

  const sfatTotalSize = 12 + nodeCount * 16;
  const metaSize = headerSize + sfatTotalSize + sfntAligned;
  const dataOffset = alignTo16(metaSize);

  const fileDataOffsets: number[] = [];
  const fileDataEnds: number[] = [];
  let filePos = 0;

  for (const file of files) {
    const alignedStart = (filePos + 15) & ~15;
    if (fileDataOffsets.length === 0) {
      fileDataOffsets.push(0);
      fileDataEnds.push(file.data.length);
      filePos = file.data.length;
    } else {
      fileDataOffsets.push(alignedStart);
      fileDataEnds.push(alignedStart + file.data.length);
      filePos = alignedStart + file.data.length;
    }
  }

  const totalDataSize = filePos;
  const totalFileSize = dataOffset + totalDataSize;

  const result = new Uint8Array(totalFileSize);
  const resultView = new DataView(result.buffer);

  result[0] = 0x53; result[1] = 0x41; result[2] = 0x52; result[3] = 0x43;
  resultView.setUint16(4, headerSize, true);
  resultView.setUint16(6, bom, true);
  resultView.setUint32(8, totalFileSize, true);
  resultView.setUint32(0x0C, dataOffset, true);
  resultView.setUint16(0x10, version, true);

  let wp = headerSize;
  result[wp] = 0x53; result[wp + 1] = 0x46; result[wp + 2] = 0x41; result[wp + 3] = 0x54;
  resultView.setUint16(wp + 4, 0x0C, true);
  resultView.setUint16(wp + 6, files.length, true);
  resultView.setUint32(wp + 8, hashMultiplier, true);

  wp += 12;
  for (let i = 0; i < files.length; i++) {
    const hash = sarcHash(files[i].name, hashMultiplier);
    resultView.setUint32(wp, hash, true);
    resultView.setUint32(wp + 4, 0x01000000 | (nameOffsets[i] / 4), true);
    resultView.setUint32(wp + 8, fileDataOffsets[i], true);
    resultView.setUint32(wp + 12, fileDataEnds[i], true);
    wp += 16;
  }

  result[wp] = 0x53; result[wp + 1] = 0x46; result[wp + 2] = 0x4E; result[wp + 3] = 0x54;
  resultView.setUint16(wp + 4, 0x08, true);
  wp += 8;

  for (const nameBuf of nameBytes) {
    result.set(nameBuf, wp);
    wp += nameBuf.length;
  }

  for (let i = 0; i < files.length; i++) {
    result.set(files[i].data, dataOffset + fileDataOffsets[i]);
  }

  return result;
}

function isSarcMagic(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === 0x53 && buf[1] === 0x41 && buf[2] === 0x52 && buf[3] === 0x43;
}

function headerBytes(buf: Uint8Array, n = 8): string {
  return Array.from(buf.slice(0, n)).map(b => b.toString(16).padStart(2, "0")).join(" ");
}

function headerAscii(buf: Uint8Array, n = 8): string {
  return Array.from(buf.slice(0, n))
    .map(b => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : ".")
    .join("");
}

// =============================================================================
// Decompression of the .pack.zs lang file using the zsdic dictionary
// =============================================================================

export interface BuildDecompressDiagnostics {
  langFileName: string;
  langSize: number;
  langHeaderHex: string;
  langHeaderAscii: string;
  isSarc: boolean;
  isZstd: boolean;
  dictFiles: string[];
  attempts: { dict: string; ok: boolean; outHeaderHex?: string; outHeaderAscii?: string; outSize?: number; error?: string }[];
}

export class LocalBuildError extends Error {
  diagnostics: BuildDecompressDiagnostics;
  constructor(message: string, diagnostics: BuildDecompressDiagnostics) {
    super(message);
    this.name = "LocalBuildError";
    this.diagnostics = diagnostics;
  }
}

export function decompressLangFile(
  langData: Uint8Array,
  dictData: Uint8Array | null,
  langFileName: string,
): { sarcData: Uint8Array; rawDict: Uint8Array | null } {
  const isSarc = isSarcMagic(langData);
  const isZstd = langData[0] === 0x28 && langData[1] === 0xB5 && langData[2] === 0x2F && langData[3] === 0xFD;
  const diag: BuildDecompressDiagnostics = {
    langFileName,
    langSize: langData.length,
    langHeaderHex: headerBytes(langData),
    langHeaderAscii: headerAscii(langData),
    isSarc,
    isZstd,
    dictFiles: [],
    attempts: [],
  };

  if (isSarc) return { sarcData: langData, rawDict: null };

  if (!isZstd) {
    throw new LocalBuildError(
      `الملف غير معروف. الترويسة "${diag.langHeaderHex}" (${diag.langHeaderAscii}) لا تطابق SARC ولا zstd.`,
      diag,
    );
  }

  if (!dictData) {
    // Try raw decompress without dict as last resort.
    try {
      const sarcData = decompress(langData);
      if (isSarcMagic(sarcData)) return { sarcData, rawDict: null };
    } catch (_e) {
      // fall through to error below
    }
    throw new LocalBuildError(
      `ملف اللغة مضغوط بـ zstd لكن لا يوجد قاموس متاح لفكّه.`,
      diag,
    );
  }

  let dictSarcData: Uint8Array;
  try { dictSarcData = decompress(dictData); } catch { dictSarcData = dictData; }

  let dictFiles: SarcFile[];
  try {
    dictFiles = parseSARC(dictSarcData);
  } catch (e) {
    throw new LocalBuildError(
      `فشل قراءة ملف القاموس كـ SARC: ${e instanceof Error ? e.message : String(e)}`,
      diag,
    );
  }
  diag.dictFiles = dictFiles.map(f => f.name);

  const lowerName = langFileName.toLowerCase();
  const ordered: { name: string; data: Uint8Array }[] = [];
  const push = (f?: { name: string; data: Uint8Array }) => {
    if (f && !ordered.find(o => o.name === f.name)) ordered.push(f);
  };
  if (lowerName.includes(".pack.")) push(dictFiles.find(f => f.name.endsWith("pack.zsdic")));
  if (lowerName.includes(".bcett.byml.")) push(dictFiles.find(f => f.name.endsWith("bcett.byml.zsdic")));
  push(dictFiles.find(f => f.name.endsWith("zs.zsdic") && !f.name.includes("pack") && !f.name.includes("bcett")));
  for (const f of dictFiles) push(f);

  if (ordered.length === 0) {
    throw new LocalBuildError("لم يتم العثور على قاموس .zsdic في ملف القاموس", diag);
  }

  for (const cand of ordered) {
    try {
      const dctx = createDCtx();
      const sarcData = decompressUsingDict(dctx, langData, cand.data);
      const outHeaderHex = headerBytes(sarcData);
      const outHeaderAscii = headerAscii(sarcData);
      const ok = isSarcMagic(sarcData);
      diag.attempts.push({ dict: cand.name, ok, outHeaderHex, outHeaderAscii, outSize: sarcData.length });
      if (ok) return { sarcData, rawDict: cand.data };
    } catch (e) {
      diag.attempts.push({ dict: cand.name, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  throw new LocalBuildError(
    `تعذّر فكّ ضغط ملف اللغة "${langFileName}" بأيّ من قواميس .zsdic المتاحة.`,
    diag,
  );
}

// =============================================================================
// Main build entry point — mirrors the server's build mode.
// =============================================================================

export interface LocalBuildOptions {
  langFile: ArrayBuffer;
  langFileName: string;
  dictFile: ArrayBuffer | null;
  translations: Record<string, string>;
  protectedEntries?: Set<string>;
  arabicNumerals?: boolean;
  mirrorPunct?: boolean;
  onProgress?: (msg: string) => void;
}

export interface LocalBuildStats {
  expanded: number;
  avgBytePercent: number;
  maxBytePercent: number;
  longest: { key: string; bytes: number } | null;
  shortest: { key: string; bytes: number } | null;
  categories: Record<string, { total: number; modified: number }>;
}

export interface LocalBuildResult {
  blob: Blob;
  fileName: string;
  modifiedCount: number;
  expandedCount: number;
  skippedAlreadyArabized: number;
  fileSize: number;
  compressedSize: number | null;
  isCompressed: boolean;
  buildStats: LocalBuildStats;
}

export async function localBuild(opts: LocalBuildOptions): Promise<LocalBuildResult> {
  const { langFile, langFileName, dictFile, translations, onProgress } = opts;
  const protectedEntries = opts.protectedEntries ?? new Set<string>();
  const arabicNumerals = !!opts.arabicNumerals;
  const mirrorPunct = !!opts.mirrorPunct;
  const processOptions = { arabicNumerals, mirrorPunct };

  onProgress?.("تجهيز محرّك الضغط...");
  await ensureZstdReady();

  onProgress?.("فكّ ضغط ملف اللغة...");
  const langData = new Uint8Array(langFile);
  const dictData = dictFile ? new Uint8Array(dictFile) : null;
  const { sarcData, rawDict } = decompressLangFile(langData, dictData, langFileName);

  onProgress?.("قراءة الأرشيف...");
  const files = parseSARC(sarcData);

  const hasCustomTranslations = Object.keys(translations).length > 0;

  let modifiedCount = 0;
  let skippedAlreadyArabized = 0;
  let expandedCount = 0;
  let totalByteRatio = 0;
  let maxByteRatio = 0;
  let longestEntry = { key: "", bytes: 0 };
  let shortestEntry: { key: string; bytes: number } = { key: "", bytes: Infinity };
  const categoryStats: Record<string, { total: number; modified: number }> = {};

  const msbtFiles = files.filter(f => f.name.endsWith(".msbt"));
  const totalMsbt = msbtFiles.length;
  let processedMsbt = 0;

  const processedFiles: SarcFile[] = [];
  for (const file of files) {
    if (!file.name.endsWith(".msbt")) {
      processedFiles.push(file);
      continue;
    }

    try {
      const { entries, raw } = parseMSBT(file.data);
      const entriesToModify = new Set<number>();

      if (hasCustomTranslations) {
        for (let i = 0; i < entries.length; i++) {
          const key = `${file.name}:${i}`;
          const t = translations[key];
          if (t === undefined || t === "") continue;

          let translationText = t;

          const hasLegacyMarkers = /[\uFFF9-\uFFFC]/.test(translationText);
          if (hasLegacyMarkers && entries[i].tags.length > 0) {
            let tagIdx = 0;
            translationText = translationText.replace(/[\uFFF9\uFFFA\uFFFB\uFFFC]/g, () => {
              if (tagIdx < entries[i].tags.length) {
                return String.fromCharCode(entries[i].tags[tagIdx++].markerCode);
              }
              return "";
            });
          }

          if (protectedEntries.has(key)) {
            let processed = reshapeArabic(translationText);
            if (arabicNumerals) processed = convertToArabicNumerals(processed);
            if (mirrorPunct) processed = mirrorPunctuation(processed);
            entries[i].processedText = processed;
          } else if (hasArabicPresentationForms(translationText)) {
            entries[i].processedText = translationText;
          } else {
            entries[i].processedText = processArabicText(translationText, processOptions);
          }
          entriesToModify.add(i);
          modifiedCount++;

          const encoded = encodeEntryToBytes(entries[i]);
          if (encoded.length > entries[i].size) expandedCount++;

          const ratio = entries[i].size > 0 ? encoded.length / entries[i].size : 0;
          totalByteRatio += ratio;
          if (ratio > maxByteRatio) maxByteRatio = ratio;
          if (encoded.length > longestEntry.bytes) longestEntry = { key, bytes: encoded.length };
          if (encoded.length < shortestEntry.bytes) shortestEntry = { key, bytes: encoded.length };

          const catParts = file.name.split("/");
          const cat = catParts.length > 1 ? catParts[0] : "Other";
          if (!categoryStats[cat]) categoryStats[cat] = { total: 0, modified: 0 };
          categoryStats[cat].modified++;
        }
      } else {
        for (let i = 0; i < entries.length; i++) {
          if (hasArabicPresentationForms(entries[i].originalText)) {
            skippedAlreadyArabized++;
            continue;
          }
          entries[i].processedText = processArabicText(entries[i].originalText, processOptions);
          entriesToModify.add(i);
          modifiedCount++;
        }
      }

      const injected = rebuildMSBT(raw, entries, entriesToModify);
      processedFiles.push({ name: file.name, data: injected });
    } catch (e) {
      console.warn(`Failed to process MSBT ${file.name}: ${e instanceof Error ? e.message : "unknown"}`);
      processedFiles.push(file);
    }

    processedMsbt++;
    if (processedMsbt % 50 === 0 || processedMsbt === totalMsbt) {
      onProgress?.(`معالجة الترجمات: ${processedMsbt}/${totalMsbt} ملف...`);
      // Yield to the event loop so the UI stays responsive.
      await new Promise(r => setTimeout(r, 0));
    }
  }

  onProgress?.("إعادة بناء الأرشيف...");
  const repackedData = rebuildSARC(processedFiles, sarcData);

  onProgress?.("إعادة ضغط الملف...");
  let outputData: Uint8Array = repackedData;
  let isCompressed = false;
  try {
    if (rawDict) {
      const cctx = createCCtx();
      outputData = compressUsingDict(cctx, repackedData, rawDict, 3);
      isCompressed = true;
    } else {
      outputData = compress(repackedData);
      isCompressed = true;
    }
  } catch (e) {
    console.error(`Re-compression failed: ${e instanceof Error ? e.message : "Unknown"}`);
  }

  const avgRatio = modifiedCount > 0 ? Math.round((totalByteRatio / modifiedCount) * 100) : 0;
  const buildStats: LocalBuildStats = {
    expanded: expandedCount,
    avgBytePercent: avgRatio,
    maxBytePercent: Math.round(maxByteRatio * 100),
    longest: longestEntry.key ? longestEntry : null,
    shortest: shortestEntry.bytes < Infinity ? shortestEntry : null,
    categories: categoryStats,
  };

  const blob = new Blob([new Uint8Array(outputData)], { type: "application/octet-stream" });

  return {
    blob,
    fileName: `arabized_${langFileName}`,
    modifiedCount,
    expandedCount,
    skippedAlreadyArabized,
    fileSize: repackedData.length,
    compressedSize: isCompressed ? outputData.length : null,
    isCompressed,
    buildStats,
  };
}
