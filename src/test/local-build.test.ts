import { describe, it, expect, vi } from "vitest";
import {
  parseMSBT,
  rebuildMSBT,
  encodeEntryToBytes,
  parseSARC,
  rebuildSARC,
  decompressLangFile,
  LocalBuildError,
  type MsbtEntry,
  type SarcFile,
} from "@/lib/local-build";

// ---------------------------------------------------------------------------
// Binary fixture builders — produce minimal valid MSBT / SARC blobs in the
// exact format the parser/rebuilder expects, so tests do not need real game
// files.
// ---------------------------------------------------------------------------

function packSection(magic: string, content: Uint8Array): Uint8Array {
  const total = 16 + content.length;
  const aligned = (total + 15) & ~15;
  const buf = new Uint8Array(aligned);
  for (let i = 0; i < 4; i++) buf[i] = magic.charCodeAt(i);
  new DataView(buf.buffer).setUint32(4, content.length, true);
  buf.set(content, 16);
  for (let i = total; i < aligned; i++) buf[i] = 0xAB;
  return buf;
}

function encodeUtf16Le(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 2 + 2);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out[i * 2] = code & 0xFF;
    out[i * 2 + 1] = (code >> 8) & 0xFF;
  }
  return out;
}

/** Build a minimal valid MSBT file with the given (label, text) entries. */
function makeMSBT(entries: { label: string; text: string }[]): Uint8Array {
  // LBL1 content: 1 bucket holding all labels.
  let labelsBytes = 0;
  for (const e of entries) labelsBytes += 1 + e.label.length + 4;
  const lbl1 = new Uint8Array(4 + 8 + labelsBytes);
  const lbl1View = new DataView(lbl1.buffer);
  lbl1View.setUint32(0, 1, true); // numBuckets
  lbl1View.setUint32(4, entries.length, true); // bucketLabelCount
  lbl1View.setUint32(8, 12, true); // bucketOffset = past header
  let lp = 12;
  for (let i = 0; i < entries.length; i++) {
    const name = entries[i].label;
    lbl1[lp++] = name.length;
    for (let c = 0; c < name.length; c++) lbl1[lp + c] = name.charCodeAt(c);
    lp += name.length;
    lbl1View.setUint32(lp, i, true);
    lp += 4;
  }

  // TXT2 content: count + offset table + UTF-16 LE texts (each null terminated).
  const encoded = entries.map(e => encodeUtf16Le(e.text));
  const tableSize = 4 + 4 * entries.length;
  let totalText = 0;
  for (const e of encoded) totalText += e.length;
  const txt2 = new Uint8Array(tableSize + totalText);
  const txt2View = new DataView(txt2.buffer);
  txt2View.setUint32(0, entries.length, true);
  let off = tableSize;
  for (let i = 0; i < entries.length; i++) {
    txt2View.setUint32(4 + i * 4, off, true);
    txt2.set(encoded[i], off);
    off += encoded[i].length;
  }

  const lbl1Section = packSection("LBL1", lbl1);
  const txt2Section = packSection("TXT2", txt2);

  // 0x20 byte header. parseMSBT only validates the magic string.
  const header = new Uint8Array(0x20);
  for (let i = 0; i < 8; i++) header[i] = "MsgStdBn".charCodeAt(i);
  const headerView = new DataView(header.buffer);
  headerView.setUint16(8, 0xFEFF, true); // BOM
  const fileSize = header.length + lbl1Section.length + txt2Section.length;
  headerView.setUint32(18, fileSize, true);

  const out = new Uint8Array(fileSize);
  out.set(header, 0);
  out.set(lbl1Section, 0x20);
  out.set(txt2Section, 0x20 + lbl1Section.length);
  return out;
}

/** Build a minimal valid SARC archive containing the given files. */
function makeSARC(files: SarcFile[]): Uint8Array {
  const headerSize = 0x14;
  const sfatSize = 12 + files.length * 16;
  const hashMultiplier = 0x65;

  // Names go in SFNT, each 4-byte aligned with trailing zeros.
  const nameBufs: Uint8Array[] = [];
  const nameOffsets: number[] = [];
  let namePos = 0;
  for (const f of files) {
    nameOffsets.push(namePos);
    const enc = new TextEncoder().encode(f.name);
    const aligned = (enc.length + 1 + 3) & ~3;
    const buf = new Uint8Array(aligned);
    buf.set(enc);
    nameBufs.push(buf);
    namePos += aligned;
  }
  const sfntContentSize = namePos;
  const sfntTotalSize = 8 + sfntContentSize;
  const sfntAligned = (sfntTotalSize + 15) & ~15;

  // File data area starts at the next 16-byte boundary after meta.
  const metaSize = headerSize + sfatSize + sfntAligned;
  const dataOffset = (metaSize + 15) & ~15;

  // Stored offsets are relative to dataOffset; first file at 0, subsequent
  // ones 16-byte aligned (this matches rebuildSARC's heuristic).
  const fileStarts: number[] = [];
  const fileEnds: number[] = [];
  let pos = 0;
  for (let i = 0; i < files.length; i++) {
    if (i === 0) {
      fileStarts.push(0);
      fileEnds.push(files[i].data.length);
      pos = files[i].data.length;
    } else {
      const aligned = (pos + 15) & ~15;
      fileStarts.push(aligned);
      fileEnds.push(aligned + files[i].data.length);
      pos = aligned + files[i].data.length;
    }
  }
  const totalFileSize = dataOffset + pos;

  const out = new Uint8Array(totalFileSize);
  const view = new DataView(out.buffer);
  // SARC header
  out[0] = 0x53; out[1] = 0x41; out[2] = 0x52; out[3] = 0x43;
  view.setUint16(4, headerSize, true);
  view.setUint16(6, 0xFEFF, true);
  view.setUint32(8, totalFileSize, true);
  view.setUint32(0x0C, dataOffset, true);
  view.setUint16(0x10, 0x0100, true);

  // SFAT header + nodes
  let wp = headerSize;
  out[wp] = 0x53; out[wp + 1] = 0x46; out[wp + 2] = 0x41; out[wp + 3] = 0x54;
  view.setUint16(wp + 4, 0x0C, true);
  view.setUint16(wp + 6, files.length, true);
  view.setUint32(wp + 8, hashMultiplier, true);
  wp += 12;
  for (let i = 0; i < files.length; i++) {
    // Hash function mirrors local-build's sarcHash.
    let h = 0;
    for (let c = 0; c < files[i].name.length; c++) {
      h = (h * hashMultiplier + files[i].name.charCodeAt(c)) & 0xFFFFFFFF;
    }
    view.setUint32(wp, h >>> 0, true);
    view.setUint32(wp + 4, 0x01000000 | (nameOffsets[i] / 4), true);
    view.setUint32(wp + 8, fileStarts[i], true);
    view.setUint32(wp + 12, fileEnds[i], true);
    wp += 16;
  }

  // SFNT header + names
  out[wp] = 0x53; out[wp + 1] = 0x46; out[wp + 2] = 0x4E; out[wp + 3] = 0x54;
  view.setUint16(wp + 4, 0x08, true);
  wp += 8;
  for (const nb of nameBufs) {
    out.set(nb, wp);
    wp += nb.length;
  }

  // File data
  for (let i = 0; i < files.length; i++) {
    out.set(files[i].data, dataOffset + fileStarts[i]);
  }

  return out;
}

// ---------------------------------------------------------------------------
// MSBT
// ---------------------------------------------------------------------------

describe("parseMSBT", () => {
  it("extracts entries with their labels and original text", () => {
    const blob = makeMSBT([
      { label: "GREETING", text: "Hello" },
      { label: "FAREWELL", text: "Bye" },
    ]);
    const { entries } = parseMSBT(blob);
    expect(entries).toHaveLength(2);
    expect(entries[0].label).toBe("GREETING");
    expect(entries[0].originalText).toBe("Hello");
    expect(entries[1].label).toBe("FAREWELL");
    expect(entries[1].originalText).toBe("Bye");
  });

  it("returns processedText equal to originalText on parse", () => {
    const blob = makeMSBT([{ label: "L", text: "World" }]);
    const { entries } = parseMSBT(blob);
    expect(entries[0].processedText).toBe(entries[0].originalText);
  });

  it("populates tags array with the marker code 0xE000+i", () => {
    // Manually construct one entry containing a single 0x0E tag with
    // group=1, type=2, paramSize=0 and the literal text 'X' afterwards.
    const tagBytes = new Uint8Array([
      0x0E, 0x00, // tag marker (uint16 LE = 0x000E)
      0x01, 0x00, // group
      0x02, 0x00, // type
      0x00, 0x00, // paramSize
    ]);
    const xUtf16 = new Uint8Array([0x58, 0x00]); // 'X'
    const nullTerm = new Uint8Array([0x00, 0x00]);
    const text = new Uint8Array(tagBytes.length + xUtf16.length + nullTerm.length);
    text.set(tagBytes, 0);
    text.set(xUtf16, tagBytes.length);
    text.set(nullTerm, tagBytes.length + xUtf16.length);

    // Hand-craft the TXT2 / LBL1 around this binary entry.
    const lbl1 = new Uint8Array(12 + 1 + 1 + 4);
    const lv = new DataView(lbl1.buffer);
    lv.setUint32(0, 1, true);
    lv.setUint32(4, 1, true);
    lv.setUint32(8, 12, true);
    lbl1[12] = 1; // labelLen
    lbl1[13] = "L".charCodeAt(0);
    lv.setUint32(14, 0, true); // itemIndex

    const txt2 = new Uint8Array(8 + text.length);
    const tv = new DataView(txt2.buffer);
    tv.setUint32(0, 1, true); // entryCount
    tv.setUint32(4, 8, true); // entryOffset
    txt2.set(text, 8);

    const lbl1Sec = packSection("LBL1", lbl1);
    const txt2Sec = packSection("TXT2", txt2);
    const header = new Uint8Array(0x20);
    for (let i = 0; i < 8; i++) header[i] = "MsgStdBn".charCodeAt(i);
    const blob = new Uint8Array(0x20 + lbl1Sec.length + txt2Sec.length);
    blob.set(header, 0);
    blob.set(lbl1Sec, 0x20);
    blob.set(txt2Sec, 0x20 + lbl1Sec.length);

    const { entries } = parseMSBT(blob);
    expect(entries).toHaveLength(1);
    expect(entries[0].tags).toHaveLength(1);
    expect(entries[0].tags[0].markerCode).toBe(0xE000);
    expect(Array.from(entries[0].tags[0].bytes)).toEqual(Array.from(tagBytes));
    // The marker character + 'X' should appear in originalText.
    expect(entries[0].originalText).toBe(String.fromCharCode(0xE000) + "X");
  });

  it("throws when the magic header is not MsgStdBn", () => {
    const blob = new Uint8Array(0x40);
    blob.set([0x46, 0x41, 0x4B, 0x45]); // "FAKE"
    expect(() => parseMSBT(blob)).toThrow(/MSBT/);
  });
});

describe("encodeEntryToBytes", () => {
  it("encodes plain text as UTF-16 LE and appends a null terminator", () => {
    const entry: MsbtEntry = {
      label: "L", originalText: "Hi", processedText: "Hi",
      offset: 0, size: 0, tags: [],
    };
    const bytes = encodeEntryToBytes(entry);
    expect(Array.from(bytes)).toEqual([0x48, 0x00, 0x69, 0x00, 0x00, 0x00]);
  });

  it("re-emits tag bytes when the marker character appears", () => {
    const tagBytes = new Uint8Array([0x0E, 0x00, 0x01, 0x00, 0x02, 0x00, 0x00, 0x00]);
    const entry: MsbtEntry = {
      label: "L",
      originalText: String.fromCharCode(0xE000) + "X",
      processedText: String.fromCharCode(0xE000) + "X",
      offset: 0, size: 0,
      tags: [{ markerCode: 0xE000, bytes: tagBytes }],
    };
    const bytes = encodeEntryToBytes(entry);
    // Should start with the tag bytes, then 'X' UTF-16 LE, then null terminator.
    expect(Array.from(bytes.slice(0, 8))).toEqual(Array.from(tagBytes));
    expect(Array.from(bytes.slice(8))).toEqual([0x58, 0x00, 0x00, 0x00]);
  });
});

describe("rebuildMSBT", () => {
  it("round-trips bytes unchanged when no entries are modified", () => {
    const blob = makeMSBT([
      { label: "A", text: "First" },
      { label: "B", text: "Second" },
    ]);
    const { entries } = parseMSBT(blob);
    const rebuilt = rebuildMSBT(blob, entries, new Set());
    expect(rebuilt.length).toBe(blob.length);
    expect(Array.from(rebuilt)).toEqual(Array.from(blob));
  });

  it("re-parses to the same entries after rebuild with translations applied", () => {
    const blob = makeMSBT([
      { label: "A", text: "Hello" },
      { label: "B", text: "Bye" },
    ]);
    const { entries } = parseMSBT(blob);
    entries[0].processedText = "Hi";
    const rebuilt = rebuildMSBT(blob, entries, new Set([0]));
    const re = parseMSBT(rebuilt).entries;
    expect(re).toHaveLength(2);
    expect(re[0].originalText).toBe("Hi");
    expect(re[1].originalText).toBe("Bye");
    expect(re[0].label).toBe("A");
    expect(re[1].label).toBe("B");
  });

  it("only touches modified entries; un-modified entries keep their original bytes", () => {
    const blob = makeMSBT([
      { label: "A", text: "Hello" },
      { label: "B", text: "Bye" },
    ]);
    const { entries } = parseMSBT(blob);
    entries[1].processedText = "Goodbye";
    const rebuilt = rebuildMSBT(blob, entries, new Set([1]));
    const re = parseMSBT(rebuilt).entries;
    expect(re[0].originalText).toBe("Hello");
    expect(re[1].originalText).toBe("Goodbye");
  });

  it("updates the file size field in the 0x20 byte header", () => {
    const blob = makeMSBT([{ label: "A", text: "Hi" }]);
    const { entries } = parseMSBT(blob);
    entries[0].processedText = "A much longer translated string than the original";
    const rebuilt = rebuildMSBT(blob, entries, new Set([0]));
    const reportedSize = new DataView(rebuilt.buffer).getUint32(18, true);
    expect(reportedSize).toBe(rebuilt.length);
  });
});

// ---------------------------------------------------------------------------
// SARC
// ---------------------------------------------------------------------------

describe("parseSARC + rebuildSARC", () => {
  it("parses files by name and exposes their data", () => {
    const sarc = makeSARC([
      { name: "a.bin", data: new Uint8Array([0xAA, 0xBB, 0xCC]) },
      { name: "b.bin", data: new Uint8Array([0x11, 0x22]) },
    ]);
    const files = parseSARC(sarc);
    expect(files).toHaveLength(2);
    expect(files[0].name).toBe("a.bin");
    expect(Array.from(files[0].data)).toEqual([0xAA, 0xBB, 0xCC]);
    expect(files[1].name).toBe("b.bin");
    expect(Array.from(files[1].data)).toEqual([0x11, 0x22]);
  });

  it("round-trips: parse(rebuild(parse(sarc))) preserves file count, names, and bytes", () => {
    const original = makeSARC([
      { name: "first.bin", data: new Uint8Array([1, 2, 3, 4, 5]) },
      { name: "second.bin", data: new Uint8Array([9, 9, 9]) },
      { name: "third.bin", data: new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]) },
    ]);
    const files = parseSARC(original);
    const rebuilt = rebuildSARC(files, original);
    const reparsed = parseSARC(rebuilt);
    expect(reparsed).toHaveLength(files.length);
    for (let i = 0; i < files.length; i++) {
      expect(reparsed[i].name).toBe(files[i].name);
      expect(Array.from(reparsed[i].data)).toEqual(Array.from(files[i].data));
    }
  });

  it("uses the original header's hash multiplier when computing node hashes", () => {
    // The SARC builder uses multiplier 0x65; rebuildSARC must read this value
    // from the original buffer and produce stable, decodable output.
    const original = makeSARC([{ name: "only.bin", data: new Uint8Array([0xFF]) }]);
    const rebuilt = rebuildSARC(parseSARC(original), original);
    const headerSize = new DataView(rebuilt.buffer).getUint16(4, true);
    const sfatHashMultiplier = new DataView(rebuilt.buffer).getUint32(headerSize + 8, true);
    expect(sfatHashMultiplier).toBe(0x65);
  });

  it("rebuilds with new file contents that are larger than the originals", () => {
    const original = makeSARC([
      { name: "small.bin", data: new Uint8Array([1, 2]) },
    ]);
    const files = parseSARC(original);
    files[0].data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const rebuilt = rebuildSARC(files, original);
    const reparsed = parseSARC(rebuilt);
    expect(Array.from(reparsed[0].data)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("throws on a non-SARC buffer", () => {
    const blob = new Uint8Array([0x66, 0x61, 0x6B, 0x65, 0, 0, 0, 0]); // "fake"
    expect(() => parseSARC(blob)).toThrow(/SARC/);
  });
});

// ---------------------------------------------------------------------------
// decompressLangFile — error paths and the SARC pass-through
//
// The zstd path is exercised in integration with the real WASM at runtime;
// here we mock @bokuweb/zstd-wasm so the tests run in a few milliseconds and
// without WASM initialisation.
// ---------------------------------------------------------------------------

vi.mock("@bokuweb/zstd-wasm", () => {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    decompress: vi.fn((data: Uint8Array) => data),
    compress: vi.fn((data: Uint8Array) => data),
    createDCtx: vi.fn(() => ({})),
    createCCtx: vi.fn(() => ({})),
    decompressUsingDict: vi.fn(() => new Uint8Array([0x53, 0x41, 0x52, 0x43])),
    compressUsingDict: vi.fn((_c: unknown, data: Uint8Array) => data),
  };
});

describe("decompressLangFile", () => {
  it("returns the input unchanged when it already starts with SARC magic", () => {
    const sarc = makeSARC([{ name: "x.bin", data: new Uint8Array([0xAB]) }]);
    const { sarcData, rawDict } = decompressLangFile(sarc, null, "anything.bin");
    expect(sarcData).toBe(sarc);
    expect(rawDict).toBeNull();
  });

  it("throws LocalBuildError with diagnostics when the header is neither SARC nor zstd", () => {
    const blob = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF, 0, 0, 0, 0]);
    try {
      decompressLangFile(blob, null, "weird.bin");
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(LocalBuildError);
      const err = e as LocalBuildError;
      expect(err.diagnostics.langFileName).toBe("weird.bin");
      expect(err.diagnostics.isSarc).toBe(false);
      expect(err.diagnostics.isZstd).toBe(false);
      expect(err.diagnostics.langHeaderHex).toContain("de ad be ef");
    }
  });

  it("throws LocalBuildError when the file is zstd but no dictionary is provided", () => {
    const zstdBlob = new Uint8Array([0x28, 0xB5, 0x2F, 0xFD, 0, 0, 0, 0]);
    // The mocked `decompress` returns the input unchanged, which does NOT
    // start with SARC magic, so the fallback path must fail too.
    try {
      decompressLangFile(zstdBlob, null, "lang.pack.zs");
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(LocalBuildError);
      const err = e as LocalBuildError;
      expect(err.diagnostics.isZstd).toBe(true);
      expect(err.message).toMatch(/قاموس|dict/i);
    }
  });

  it("decompresses with a dictionary when one matches and the output is SARC", () => {
    // Build a tiny dict SARC containing a single 'pack.zsdic' entry.
    const dictSarc = makeSARC([
      { name: "USen.Product.110.pack.zsdic", data: new Uint8Array([0x01, 0x02, 0x03]) },
    ]);
    const zstdBlob = new Uint8Array([0x28, 0xB5, 0x2F, 0xFD, 0, 0, 0, 0]);
    const { sarcData, rawDict } = decompressLangFile(zstdBlob, dictSarc, "USen.Product.110.pack.zs");
    // The mock's decompressUsingDict returns the bytes "SARC".
    expect(sarcData[0]).toBe(0x53);
    expect(sarcData[1]).toBe(0x41);
    expect(sarcData[2]).toBe(0x52);
    expect(sarcData[3]).toBe(0x43);
    expect(rawDict).not.toBeNull();
  });
});
