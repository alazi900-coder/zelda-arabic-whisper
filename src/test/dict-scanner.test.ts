import { describe, it, expect } from "vitest";
import { scanWithDictionaries, scanAllWithDictionaries } from "@/lib/dict-scanner";

describe("dict-scanner — hamza", () => {
  it("detects هاذا and suggests هذا", () => {
    const issues = scanWithDictionaries({
      key: "k1",
      original: "this thing",
      translation: "هاذا الشيء",
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].rule).toBe("dict_hamza");
    expect(issues[0].suggestion).toContain("هذا");
  });

  it("detects multiple hamza errors and lists count", () => {
    const issues = scanWithDictionaries({
      key: "k2",
      original: "x",
      translation: "هاذا فى ذالك",
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain("(3)");
    expect(issues[0].suggestion).toContain("هذا");
    expect(issues[0].suggestion).toContain("في");
    expect(issues[0].suggestion).toContain("ذلك");
  });

  it("does not flag correctly spelled words", () => {
    const issues = scanWithDictionaries({
      key: "k3",
      original: "x",
      translation: "هذا في ذلك",
    });
    expect(issues).toHaveLength(0);
  });

  it("does not flag the wrong form when it is a substring of a longer word", () => {
    // "إلي" is a wrong form for "إلى", but the substring "إلي" inside
    // "إليك" is part of a different word and must NOT be flagged.
    const issues = scanWithDictionaries({
      key: "k4",
      original: "x",
      translation: "إليك الكتاب",
    });
    expect(issues).toHaveLength(0);
  });
});

describe("dict-scanner — taa marbutah", () => {
  it("detects نهايه and suggests نهاية", () => {
    const issues = scanWithDictionaries({
      key: "k1",
      original: "the end",
      translation: "وصلنا نهايه الطريق",
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].rule).toBe("dict_ta_marbutah");
    expect(issues[0].suggestion).toContain("نهاية");
  });

  it("detects النهايه (with ال prefix) and preserves the prefix", () => {
    const issues = scanWithDictionaries({
      key: "k1b",
      original: "the end",
      translation: "هذه هي النهايه",
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].rule).toBe("dict_ta_marbutah");
    expect(issues[0].suggestion).toContain("النهاية");
  });

  it("does not flag normal words", () => {
    const issues = scanWithDictionaries({
      key: "k2",
      original: "x",
      translation: "هذه نهاية الرحلة",
    });
    expect(issues).toHaveLength(0);
  });
});

describe("dict-scanner — empty / batch", () => {
  it("returns no issues for empty translation", () => {
    const issues = scanWithDictionaries({
      key: "k1",
      original: "x",
      translation: "",
    });
    expect(issues).toHaveLength(0);
  });

  it("scanAllWithDictionaries aggregates across inputs", () => {
    const all = scanAllWithDictionaries([
      { key: "a", original: "x", translation: "هاذا اختبار" },
      { key: "b", original: "x", translation: "هذه نهايه" },
      { key: "c", original: "x", translation: "نظيف" },
    ]);
    expect(all.length).toBe(2);
    expect(all.find((i) => i.key === "a")?.rule).toBe("dict_hamza");
    expect(all.find((i) => i.key === "b")?.rule).toBe("dict_ta_marbutah");
  });
});
