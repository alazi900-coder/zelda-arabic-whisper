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

describe("dict-scanner — gaming glossary", () => {
  it("flags an English gaming term inside an Arabic translation", () => {
    const issues = scanWithDictionaries({
      key: "k1",
      original: "Press to start a quest.",
      translation: "اضغط لبدء quest جديدة.",
    });
    const issue = issues.find((i) => i.rule === "dict_gaming_term");
    expect(issue).toBeTruthy();
    expect(issue?.issue).toContain("(1)");
    expect(issue?.reason).toContain("quest");
  });

  it("does not flag if translation is fully English (no Arabic context)", () => {
    const issues = scanWithDictionaries({
      key: "k2",
      original: "Open the menu.",
      translation: "Open the menu.",
    });
    expect(issues.find((i) => i.rule === "dict_gaming_term")).toBeFalsy();
  });

  it("does not flag if every gaming term is already in Arabic", () => {
    const issues = scanWithDictionaries({
      key: "k3",
      original: "Open the menu and start a quest.",
      translation: "افتح القائمة وابدأ مهمّة.",
    });
    expect(issues.find((i) => i.rule === "dict_gaming_term")).toBeFalsy();
  });
});

describe("dict-scanner — proper nouns", () => {
  it("flags when a known proper noun in the original is missing from the translation", () => {
    const issues = scanWithDictionaries({
      key: "k1",
      original: "Hyrule is in danger.",
      translation: "البلاد في خطر.",
    });
    const issue = issues.find((i) => i.rule === "dict_proper_noun");
    expect(issue).toBeTruthy();
    expect(issue?.issue).toContain("Hyrule");
    expect(issue?.severity).toBe("high");
  });

  it("does not flag if the translation contains an accepted Arabic rendering", () => {
    const issues = scanWithDictionaries({
      key: "k2",
      original: "Hyrule is in danger.",
      translation: "هايرول في خطر.",
    });
    expect(issues.find((i) => i.rule === "dict_proper_noun")).toBeFalsy();
  });

  it("does not flag if the translation keeps the English form", () => {
    const issues = scanWithDictionaries({
      key: "k3",
      original: "Hyrule is in danger.",
      translation: "Hyrule في خطر.",
    });
    expect(issues.find((i) => i.rule === "dict_proper_noun")).toBeFalsy();
  });
});

describe("dict-scanner — digit consistency", () => {
  it("flags when digit set differs between original and translation", () => {
    const issues = scanWithDictionaries({
      key: "k1",
      original: "Collect 5 hearts.",
      translation: "اجمع 3 قلوب.",
    });
    const issue = issues.find((i) => i.rule === "digit_mismatch");
    expect(issue).toBeTruthy();
    expect(issue?.severity).toBe("high");
  });

  it("does not flag when digit sets are identical (any order)", () => {
    const issues = scanWithDictionaries({
      key: "k2",
      original: "5 of 12 quests done.",
      translation: "أنهيت 5 من 12 مهمّة.",
    });
    expect(issues.find((i) => i.rule === "digit_mismatch")).toBeFalsy();
  });

  it("does not flag when original has no digits", () => {
    const issues = scanWithDictionaries({
      key: "k3",
      original: "Open the door.",
      translation: "افتح الباب 1.",
    });
    expect(issues.find((i) => i.rule === "digit_mismatch")).toBeFalsy();
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
