import { describe, it, expect } from "vitest";
import { scanAllLocally, buildConsistencyMap } from "@/lib/local-enhance-scanner";

describe("local-enhance-scanner — comprehensive offline rules", () => {
  it("detects double spaces", () => {
    const res = scanAllLocally([{ key: "a:1", original: "Hello", translation: "مرحبا  بك" }]);
    expect(res.some(r => r.rule === "double_space")).toBe(true);
  });

  it("detects space before punctuation", () => {
    const res = scanAllLocally([{ key: "a:1", original: "Hi.", translation: "مرحبا ." }]);
    expect(res.some(r => r.rule === "space_before_punct")).toBe(true);
  });

  it("detects repeated word", () => {
    const res = scanAllLocally([{ key: "a:1", original: "Go", translation: "اذهب اذهب الآن" }]);
    expect(res.some(r => r.rule === "repeated_word")).toBe(true);
  });

  it("detects 4+ repeated chars", () => {
    const res = scanAllLocally([{ key: "a:1", original: "Wow", translation: "وااااو رائع" }]);
    expect(res.some(r => r.rule === "repeated_char")).toBe(true);
  });

  it("detects glued Arabic+Latin", () => {
    const res = scanAllLocally([{ key: "a:1", original: "Link is here", translation: "Linkالبطل هنا" }]);
    expect(res.some(r => r.rule === "glued_scripts")).toBe(true);
  });

  it("detects untranslated text (no Arabic chars)", () => {
    const res = scanAllLocally([{ key: "a:1", original: "Hello world", translation: "Hello world" }]);
    expect(res.some(r => r.rule === "untranslated")).toBe(true);
  });

  it("detects missing technical tags", () => {
    const res = scanAllLocally([{ key: "a:1", original: "Hello [Color:Red] world", translation: "مرحبا بالعالم" }]);
    expect(res.some(r => r.rule === "missing_tags")).toBe(true);
  });

  it("detects unclosed brackets", () => {
    const res = scanAllLocally([{ key: "a:1", original: "X", translation: "[Color:Red مرحبا" }]);
    expect(res.some(r => r.rule === "unclosed_brackets")).toBe(true);
  });

  it("detects byte-limit overflow", () => {
    // Arabic chars are 2 bytes each in UTF-8; "أ" is 2 bytes
    const res = scanAllLocally([{ key: "a:1", original: "Hi", translation: "مرحبا أهلا وسهلا", maxBytes: 5 }]);
    expect(res.some(r => r.rule === "byte_over")).toBe(true);
  });

  it("detects question mark mismatch", () => {
    const res = scanAllLocally([{ key: "a:1", original: "Are you sure?", translation: "هل أنت متأكد." }]);
    expect(res.some(r => r.rule === "missing_question_mark")).toBe(true);
  });

  it("detects diacritics", () => {
    const res = scanAllLocally([{ key: "a:1", original: "Hi", translation: "مَرْحَباً بِكَ" }]);
    expect(res.some(r => r.rule === "diacritics")).toBe(true);
  });

  it("detects common hamza errors", () => {
    const res = scanAllLocally([{ key: "a:1", original: "This", translation: "هاذا الكتاب" }]);
    expect(res.some(r => r.rule === "hamza_pattern")).toBe(true);
  });

  it("detects common untranslated game words", () => {
    const res = scanAllLocally([{ key: "a:1", original: "Save the game", translation: "Save اللعبة" }]);
    expect(res.some(r => r.rule === "common_untranslated")).toBe(true);
  });

  it("detects original verbatim copied into translation", () => {
    const res = scanAllLocally([
      { key: "a:1", original: "Welcome to Hyrule", translation: "Welcome to Hyrule مرحبا" },
    ]);
    expect(res.some(r => r.rule === "verbatim_copy")).toBe(true);
  });

  it("provides a non-empty reason for every issue", () => {
    const res = scanAllLocally([{ key: "a:1", original: "X", translation: "مرحبا  بك ." }]);
    for (const r of res) {
      expect(r.reason.length).toBeGreaterThan(10);
      expect(r.issue.length).toBeGreaterThan(0);
    }
  });

  it("builds a consistency map for capitalised terms", () => {
    const map = buildConsistencyMap([
      { original: "Sword", translation: "سيف" },
      { original: "Sword", translation: "سيف" },
      { original: "Sword", translation: "حسام" },
      { original: "Shield", translation: "درع" },
    ]);
    expect(map.get("Sword")).toBe("سيف");
  });

  it("flags entries that disagree with the dominant translation", () => {
    const inputs = [
      { key: "a:1", original: "Sword", translation: "سيف" },
      { key: "a:2", original: "Sword", translation: "سيف" },
      { key: "a:3", original: "Sword", translation: "حسام" },
    ];
    const res = scanAllLocally(inputs);
    expect(res.some(r => r.rule === "term_consistency" && r.key === "a:3")).toBe(true);
  });
});
