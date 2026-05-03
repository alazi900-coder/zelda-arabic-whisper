import { describe, it, expect } from "vitest";
import { scanWithCustomDicts } from "@/lib/custom-dict-scanner";
import { EMPTY_DICTS, type CustomDicts, type Pair } from "@/lib/glossary-store";

const baseDicts = (): CustomDicts => ({
  hamza: [],
  taMarbutah: [],
  gaming: [],
  properNouns: [],
});

describe("custom-dict-scanner — hamza", () => {
  it("flags a custom hamza pair", () => {
    const dicts = baseDicts();
    dicts.hamza = [["انت", "أنت"] as Pair];
    const issues = scanWithCustomDicts(
      { key: "k1", original: "you", translation: "انت هنا" },
      dicts,
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].rule).toBe("dict_hamza");
    expect(issues[0].suggestion).toContain("أنت");
  });

  it("does not flag when translation already correct", () => {
    const dicts = baseDicts();
    dicts.hamza = [["انت", "أنت"] as Pair];
    const issues = scanWithCustomDicts(
      { key: "k2", original: "you", translation: "أنت هنا" },
      dicts,
    );
    expect(issues).toHaveLength(0);
  });
});

describe("custom-dict-scanner — taa marbutah", () => {
  it("flags a custom taa marbutah pair", () => {
    const dicts = baseDicts();
    dicts.taMarbutah = [["مكتبه", "مكتبة"] as Pair];
    const issues = scanWithCustomDicts(
      { key: "k1", original: "library", translation: "ادخل مكتبه" },
      dicts,
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].rule).toBe("dict_ta_marbutah");
    expect(issues[0].suggestion).toContain("مكتبة");
  });
});

describe("custom-dict-scanner — gaming glossary", () => {
  it("flags an English term from custom gaming list", () => {
    const dicts = baseDicts();
    dicts.gaming = [["bokoblin", "بوكوبلين"] as Pair];
    const issues = scanWithCustomDicts(
      { key: "k1", original: "Defeat the bokoblin", translation: "اهزم bokoblin هنا" },
      dicts,
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].rule).toBe("dict_gaming_term");
  });

  it("does not flag English-only translation", () => {
    const dicts = baseDicts();
    dicts.gaming = [["bokoblin", "بوكوبلين"] as Pair];
    const issues = scanWithCustomDicts(
      { key: "k2", original: "Defeat the bokoblin", translation: "Defeat the bokoblin" },
      dicts,
    );
    expect(issues).toHaveLength(0);
  });
});

describe("custom-dict-scanner — proper nouns", () => {
  it("flags a custom proper noun missing from translation", () => {
    const dicts = baseDicts();
    dicts.properNouns = [{ en: "Bokoblin", ar: ["بوكوبلين"], category: "race" }];
    const issues = scanWithCustomDicts(
      { key: "k1", original: "A Bokoblin appears.", translation: "ظهر عدوّ." },
      dicts,
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].rule).toBe("dict_proper_noun");
    expect(issues[0].issue).toContain("Bokoblin");
  });

  it("does not flag when translation contains an accepted Arabic form", () => {
    const dicts = baseDicts();
    dicts.properNouns = [{ en: "Bokoblin", ar: ["بوكوبلين", "بوكوبيلين"], category: "race" }];
    const issues = scanWithCustomDicts(
      { key: "k2", original: "A Bokoblin appears.", translation: "ظهر بوكوبيلين." },
      dicts,
    );
    expect(issues).toHaveLength(0);
  });

  it("does not flag when translation keeps the English form", () => {
    const dicts = baseDicts();
    dicts.properNouns = [{ en: "Bokoblin", ar: ["بوكوبلين"], category: "race" }];
    const issues = scanWithCustomDicts(
      { key: "k3", original: "A Bokoblin appears.", translation: "ظهر Bokoblin." },
      dicts,
    );
    expect(issues).toHaveLength(0);
  });
});

describe("custom-dict-scanner — empty", () => {
  it("returns no issues when all dicts are empty", () => {
    const issues = scanWithCustomDicts(
      { key: "k1", original: "x", translation: "هذه ترجمة." },
      EMPTY_DICTS,
    );
    expect(issues).toHaveLength(0);
  });

  it("returns no issues for empty translation", () => {
    const dicts = baseDicts();
    dicts.hamza = [["انت", "أنت"] as Pair];
    const issues = scanWithCustomDicts(
      { key: "k2", original: "x", translation: "" },
      dicts,
    );
    expect(issues).toHaveLength(0);
  });
});
