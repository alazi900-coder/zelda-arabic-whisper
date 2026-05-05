import { describe, it, expect } from "vitest";
import { parseGlossaryEntries, trimGlossaryToBatch } from "@/lib/glossary-trim";

const GLOSSARY = `# Comment line — should be ignored
// Another comment
Link=لينك
Zelda=زيلدا
Hyrule=هايرول
sword=سيف
key=مفتاح
Ganon=غانون
Master Sword=سيف السيد
Fairy Bow=قوس الجنية
رجل=man
=missing-key
missing-value=
`;

describe("parseGlossaryEntries", () => {
  it("returns empty for null/empty inputs", () => {
    expect(parseGlossaryEntries(undefined)).toEqual([]);
    expect(parseGlossaryEntries(null)).toEqual([]);
    expect(parseGlossaryEntries("")).toEqual([]);
    expect(parseGlossaryEntries("   \n\n  ")).toEqual([]);
  });

  it("skips comments and malformed lines", () => {
    const out = parseGlossaryEntries(GLOSSARY);
    const keys = out.map((e) => e.key);
    expect(keys).not.toContain("");
    expect(keys).not.toContain("missing-value");
    // The line `=missing-key` has empty key on the left of '=' so it's skipped
    expect(out.find((e) => e.key === "missing-key")).toBeUndefined();
  });

  it("lowercases keys but preserves original line case", () => {
    const out = parseGlossaryEntries("Link=لينك");
    expect(out).toEqual([{ line: "Link=لينك", key: "link" }]);
  });

  it("handles non-ASCII keys", () => {
    const out = parseGlossaryEntries("رجل=man");
    expect(out[0].key).toBe("رجل");
  });
});

describe("trimGlossaryToBatch", () => {
  it("returns empty when no glossary or no entries", () => {
    expect(trimGlossaryToBatch("", [{ original: "anything" }])).toBe("");
    expect(trimGlossaryToBatch(GLOSSARY, [])).toBe("");
    expect(trimGlossaryToBatch(undefined, [{ original: "anything" }])).toBe("");
  });

  it("returns empty when no glossary key appears in batch", () => {
    const result = trimGlossaryToBatch(GLOSSARY, [
      { original: "Hello world" },
      { original: "Good morning" },
    ]);
    expect(result).toBe("");
  });

  it("includes only matching keys", () => {
    const result = trimGlossaryToBatch(GLOSSARY, [
      { original: "Link wields the Master Sword" },
    ]);
    expect(result).toContain("Link=لينك");
    expect(result).toContain("Master Sword=سيف السيد");
    expect(result).toContain("sword=سيف");
    expect(result).not.toContain("Zelda=");
    expect(result).not.toContain("Ganon=");
  });

  it("uses word-boundary matching for ASCII keys (no false positives)", () => {
    // 'key' must NOT match 'monkey'
    const result = trimGlossaryToBatch(GLOSSARY, [
      { original: "There is a monkey in the room" },
    ]);
    expect(result).not.toContain("key=");
  });

  it("matches non-ASCII keys via substring", () => {
    const result = trimGlossaryToBatch(GLOSSARY, [
      { original: "هذا رجل عجوز" },
    ]);
    expect(result).toContain("رجل=man");
  });

  it("dedupes by key", () => {
    const dup = "Link=لينك\nLink=لينك\nlink=alt";
    const result = trimGlossaryToBatch(dup, [{ original: "Link is here" }]);
    // First match wins; second skipped as duplicate by lowercased key.
    expect(result.split("\n").length).toBe(1);
    expect(result).toBe("Link=لينك");
  });

  it("respects maxTerms cap", () => {
    const big = Array.from({ length: 200 }, (_, i) => `term${i}=ترجمة${i}`).join("\n");
    const haystack = Array.from({ length: 200 }, (_, i) => `term${i}`).join(" ");
    const result = trimGlossaryToBatch(big, [{ original: haystack }], 50);
    expect(result.split("\n").length).toBe(50);
  });

  it("aggregates matches across multiple batch entries", () => {
    const result = trimGlossaryToBatch(GLOSSARY, [
      { original: "Link found a sword" },
      { original: "Zelda was waiting" },
      { original: "irrelevant text" },
    ]);
    expect(result).toContain("Link=");
    expect(result).toContain("sword=");
    expect(result).toContain("Zelda=");
    expect(result).not.toContain("Ganon=");
  });

  it("is case-insensitive for ASCII keys", () => {
    const result = trimGlossaryToBatch(GLOSSARY, [
      { original: "LINK opens the door" },
    ]);
    expect(result).toContain("Link=لينك");
  });

  it("preserves original glossary line formatting", () => {
    const g = "Master Sword = سيف السيد";
    const result = trimGlossaryToBatch(g, [{ original: "the master sword" }]);
    expect(result).toBe("Master Sword = سيف السيد");
  });
});
