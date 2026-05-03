import { describe, it, expect } from "vitest";
import { findAlifMaksuraErrors } from "@/data/quality-dicts/alif-maksura-dict";
import { findCommonTypos } from "@/data/quality-dicts/common-typos";
import {
  ruleTatweel,
  ruleMixedDigits,
  ruleMissingArabicQuestion,
  ruleEllipsis,
  ruleNbsp,
  ruleLengthAnomaly,
  scanExtraRules,
} from "@/lib/extra-rules";
import { diffWords } from "@/lib/diff-words";

const inp = (translation: string, original = "Hello") => ({
  key: "k",
  original,
  translation,
});

describe("Alif-maksura dictionary", () => {
  it("flags الذى → الذي", () => {
    const r = findAlifMaksuraErrors("هذا الكتاب الذى أحبّه");
    expect(r.matches.length).toBeGreaterThan(0);
    expect(r.fix).toContain("الذي");
    expect(r.fix).not.toContain("الذى");
  });
  it("flags multiple words in one pass", () => {
    const r = findAlifMaksuraErrors("علي حتي متي");
    expect(r.matches.length).toBe(3);
    expect(r.fix).toBe("على حتى متى");
  });
  it("does not touch already-correct words", () => {
    const r = findAlifMaksuraErrors("على حتى متى");
    expect(r.matches.length).toBe(0);
    expect(r.fix).toBe("على حتى متى");
  });
});

describe("Common typos dictionary", () => {
  it("fixes لاكن → لكن", () => {
    const r = findCommonTypos("لاكن لم أفعل ذلك");
    expect(r.matches.length).toBeGreaterThan(0);
    expect(r.fix).toContain("لكن");
  });
  it("fixes multi-word إنشاء الله variants", () => {
    const r = findCommonTypos("إنشاء الله سنذهب");
    expect(r.fix).toContain("إن شاء الله");
  });
});

describe("Tatweel rule", () => {
  it("flags kashida and produces a clean fix", () => {
    const i = ruleTatweel(inp("مــرحــبــا"));
    expect(i).not.toBeNull();
    expect(i?.suggestion).toBe("مرحبا");
    expect(i?.rule).toBe("tatweel");
  });
  it("returns null when no kashida present", () => {
    expect(ruleTatweel(inp("مرحبا"))).toBeNull();
  });
});

describe("Mixed digits rule", () => {
  it("flags Arabic + Latin digit mix and unifies to Latin when original uses Latin", () => {
    const i = ruleMixedDigits({
      key: "k",
      original: "Page 5 of 10",
      translation: "صفحة ٥ من 10",
    });
    expect(i).not.toBeNull();
    expect(i?.suggestion).toBe("صفحة 5 من 10");
  });
  it("ignores translations using only one digit system", () => {
    expect(
      ruleMixedDigits({
        key: "k",
        original: "Page 5",
        translation: "صفحة 5",
      }),
    ).toBeNull();
  });
});

describe("Missing Arabic question mark rule", () => {
  it("flags a translation ending without ؟ when original ends with ?", () => {
    const i = ruleMissingArabicQuestion({
      key: "k",
      original: "Are you ready?",
      translation: "هل أنت جاهز",
    });
    expect(i).not.toBeNull();
    expect(i?.suggestion?.endsWith("؟")).toBe(true);
  });
  it("replaces a trailing Latin ? with ؟", () => {
    const i = ruleMissingArabicQuestion({
      key: "k",
      original: "Are you ready?",
      translation: "هل أنت جاهز?",
    });
    expect(i?.suggestion).toBe("هل أنت جاهز؟");
  });
  it("does not flag if already ends with ؟", () => {
    expect(
      ruleMissingArabicQuestion({
        key: "k",
        original: "Are you ready?",
        translation: "هل أنت جاهز؟",
      }),
    ).toBeNull();
  });
});

describe("Ellipsis rule", () => {
  it("converts ... to …", () => {
    const i = ruleEllipsis(inp("انتظر..."));
    expect(i?.suggestion).toBe("انتظر…");
  });
});

describe("Nbsp rule", () => {
  it("flags non-breaking spaces not present in the original", () => {
    const i = ruleNbsp({
      key: "k",
      original: "Hello world",
      translation: "مرحبا\u00A0بالعالم",
    });
    expect(i?.suggestion).toBe("مرحبا بالعالم");
  });
});

describe("Length anomaly rule", () => {
  it("flags translations that are way too short", () => {
    const i = ruleLengthAnomaly({
      key: "k",
      original:
        "This is a long English sentence that should produce a comparable Arabic translation",
      translation: "نعم.",
    });
    expect(i).not.toBeNull();
    expect(i?.severity).toBe("high");
  });
  it("flags translations that are way too long", () => {
    const i = ruleLengthAnomaly({
      key: "k",
      original: "Yes",
      translation:
        "نعم وأكثر من ذلك بكثير وأكثر وأكثر وأكثر فعلاً جداً جداً نعم نعم نعم نعم نعم",
    });
    expect(i).not.toBeNull();
  });
  it("does not flag normal-length translations", () => {
    expect(
      ruleLengthAnomaly({
        key: "k",
        original: "Hello there friend",
        translation: "مرحبًا أيها الصديق",
      }),
    ).toBeNull();
  });
});

describe("scanExtraRules combines rules", () => {
  it("returns multiple issues from a single input", () => {
    const issues = scanExtraRules({
      key: "k",
      original: "Are you ready?",
      translation: "هل أنت جاهز...\u00A0بالكامل",
    });
    const rules = issues.map((i) => i.rule);
    expect(rules).toContain("ellipsis_chars");
    expect(rules).toContain("nbsp");
    expect(rules).toContain("missing_arabic_question");
  });
});

describe("DiffView diffWords helper", () => {
  it("identifies replaced words", () => {
    const parts = diffWords("هذا الكتاب الذى رأيته", "هذا الكتاب الذي رأيته");
    expect(parts.some((p) => p.type === "del" && p.text === "الذى")).toBe(true);
    expect(parts.some((p) => p.type === "add" && p.text === "الذي")).toBe(true);
  });
  it("returns all-same when texts equal", () => {
    const parts = diffWords("مرحبا", "مرحبا");
    expect(parts.every((p) => p.type === "same")).toBe(true);
  });
});
