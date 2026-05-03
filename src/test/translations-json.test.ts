import { describe, it, expect } from "vitest";
import {
  parseTranslationsJSON,
  buildEditorDictJSON,
} from "@/lib/translations-json";

describe("parseTranslationsJSON", () => {
  it("parses the editor's dictionary format and preserves key order", () => {
    const text = JSON.stringify({
      "EventFlowMsg/Npc_RitoHatago004.msbt:12": "جريدة محظوظ البرسيم؟",
      "StaticMsg/Buff.msbt:0": "مقاومة الحرارة",
      "LayoutMsg/Title.msbt:0": "ابدأ اللعبة",
    });
    const r = parseTranslationsJSON(text);
    expect(r.sourceFormat).toBe("dict-json");
    expect(r.entries.map((e) => e.key)).toEqual([
      "EventFlowMsg/Npc_RitoHatago004.msbt:12",
      "StaticMsg/Buff.msbt:0",
      "LayoutMsg/Title.msbt:0",
    ]);
    expect(r.entries[0].translation).toBe("جريدة محظوظ البرسيم؟");
    expect(r.entries[0].original).toBe("");
    expect(r.sourceKeys).toEqual(r.entries.map((e) => e.key));
  });

  it("parses an array form of {key, original, translation}", () => {
    const text = JSON.stringify([
      { key: "a:1", original: "Hi", translation: "مرحبا" },
      { key: "a:2", original: "Bye", translation: "وداعاً" },
    ]);
    const r = parseTranslationsJSON(text);
    expect(r.sourceFormat).toBe("array-json");
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0].original).toBe("Hi");
    expect(r.entries[0].translation).toBe("مرحبا");
  });

  it("accepts a {translations: [...]} envelope", () => {
    const text = JSON.stringify({
      translations: [
        { key: "x", original: "Hi", translation: "مرحبا" },
      ],
    });
    const r = parseTranslationsJSON(text);
    expect(r.sourceFormat).toBe("array-json");
    expect(r.entries[0].key).toBe("x");
  });

  it("falls back to dict mode for any string-valued object", () => {
    const text = JSON.stringify({ k1: "v1", k2: "v2" });
    const r = parseTranslationsJSON(text);
    expect(r.sourceFormat).toBe("dict-json");
    expect(r.entries.map((e) => e.translation)).toEqual(["v1", "v2"]);
  });

  it("rejects non-object/non-array roots", () => {
    expect(() => parseTranslationsJSON('"hello"')).toThrow();
    expect(() => parseTranslationsJSON("42")).toThrow();
  });
});

describe("buildEditorDictJSON", () => {
  it("round-trips a parsed dict in the original key order", () => {
    const sourceText = JSON.stringify(
      {
        "EventFlowMsg/Npc_RitoHatago004.msbt:12": "جريدة محظوظ البرسيم؟",
        "StaticMsg/Buff.msbt:0": "مقاومة الحرارة",
        "LayoutMsg/Title.msbt:0": "ابدأ اللعبة",
      },
      null,
      2,
    );
    const parsed = parseTranslationsJSON(sourceText);
    const exported = buildEditorDictJSON(
      parsed.entries.map((e) => ({ key: e.key, translation: e.translation })),
      parsed.sourceKeys,
    );
    expect(exported).toBe(sourceText);
  });

  it("applies edits without touching key ordering or untouched values", () => {
    const sourceText = JSON.stringify(
      {
        "a:1": "ألف",
        "a:2": "إلي",
        "a:3": "متن",
      },
      null,
      2,
    );
    const parsed = parseTranslationsJSON(sourceText);
    const edited = parsed.entries.map((e) =>
      e.key === "a:2" ? { key: e.key, translation: "إلى" } : { key: e.key, translation: e.translation },
    );
    const exported = buildEditorDictJSON(edited, parsed.sourceKeys);
    const reparsed = JSON.parse(exported) as Record<string, string>;
    expect(Object.keys(reparsed)).toEqual(["a:1", "a:2", "a:3"]);
    expect(reparsed["a:2"]).toBe("إلى");
    expect(reparsed["a:1"]).toBe("ألف");
    expect(reparsed["a:3"]).toBe("متن");
  });

  it("appends new keys at the end when they aren't in the preferred order", () => {
    const exported = buildEditorDictJSON(
      [
        { key: "a:1", translation: "x" },
        { key: "a:2", translation: "y" },
      ],
      ["a:1"],
    );
    const reparsed = JSON.parse(exported) as Record<string, string>;
    expect(Object.keys(reparsed)).toEqual(["a:1", "a:2"]);
  });
});
