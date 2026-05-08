import { describe, it, expect } from "vitest";
import { parseEnglishOnlyTxt } from "@/lib/english-only-txt";

const SEP = "═".repeat(60);
const RULE = "─".repeat(60);
const HEADER = "=".repeat(60);

function buildSampleTxt(translatedTexts: Record<string, string>): string {
  const lines: string[] = [];
  lines.push(HEADER);
  lines.push("  English Texts for Translation — 2026-05-07");
  lines.push("  Total: 3 texts");
  lines.push(HEADER);
  lines.push("");
  lines.push(RULE);
  lines.push("📁 UI/MainMenu.msbt");
  lines.push(RULE);
  lines.push("");
  lines.push("[1] (UI/MainMenu.msbt:0)");
  lines.push("Label: start");
  lines.push("");
  lines.push("Start Game");
  lines.push("");
  lines.push("▶ Translation:");
  lines.push("");
  if (translatedTexts["UI/MainMenu.msbt:0"] !== undefined) {
    lines.push(translatedTexts["UI/MainMenu.msbt:0"]);
    lines.push("");
  }
  lines.push(SEP);
  lines.push("");
  lines.push("[2] (UI/MainMenu.msbt:1)");
  lines.push("Label: settings");
  lines.push("");
  lines.push("Settings");
  lines.push("");
  lines.push("▶ Translation:");
  lines.push("");
  if (translatedTexts["UI/MainMenu.msbt:1"] !== undefined) {
    lines.push(translatedTexts["UI/MainMenu.msbt:1"]);
    lines.push("");
  }
  lines.push(SEP);
  lines.push("");
  lines.push(RULE);
  lines.push("📁 Dialog/NPC.msbt");
  lines.push(RULE);
  lines.push("");
  lines.push("[3] (Dialog/NPC.msbt:0)");
  lines.push("Label: greeting");
  lines.push("");
  lines.push("Hello traveler!");
  lines.push("");
  lines.push("▶ Translation:");
  lines.push("");
  if (translatedTexts["Dialog/NPC.msbt:0"] !== undefined) {
    lines.push(translatedTexts["Dialog/NPC.msbt:0"]);
    lines.push("");
  }
  lines.push(SEP);
  return lines.join("\n");
}

describe("parseEnglishOnlyTxt", () => {
  it("extracts keys and translations from a complete file", () => {
    const txt = buildSampleTxt({
      "UI/MainMenu.msbt:0": "ابدأ اللعبة",
      "UI/MainMenu.msbt:1": "الإعدادات",
      "Dialog/NPC.msbt:0": "مرحباً أيها المسافر!",
    });
    const { translations, emptyCount } = parseEnglishOnlyTxt(txt);
    expect(translations).toEqual({
      "UI/MainMenu.msbt:0": "ابدأ اللعبة",
      "UI/MainMenu.msbt:1": "الإعدادات",
      "Dialog/NPC.msbt:0": "مرحباً أيها المسافر!",
    });
    expect(emptyCount).toBe(0);
  });

  it("skips entries whose translation block is empty", () => {
    const txt = buildSampleTxt({
      "UI/MainMenu.msbt:0": "ابدأ اللعبة",
      "Dialog/NPC.msbt:0": "مرحباً!",
    });
    const { translations, emptyCount } = parseEnglishOnlyTxt(txt);
    expect(translations).toEqual({
      "UI/MainMenu.msbt:0": "ابدأ اللعبة",
      "Dialog/NPC.msbt:0": "مرحباً!",
    });
    expect(emptyCount).toBe(1);
    expect(translations["UI/MainMenu.msbt:1"]).toBeUndefined();
  });

  it("preserves multi-line translations", () => {
    const txt = buildSampleTxt({
      "UI/MainMenu.msbt:0": "السطر الأول\nالسطر الثاني\nالسطر الثالث",
    });
    const { translations } = parseEnglishOnlyTxt(txt);
    expect(translations["UI/MainMenu.msbt:0"]).toBe(
      "السطر الأول\nالسطر الثاني\nالسطر الثالث",
    );
  });

  it("ignores header / file-banner / blank lines", () => {
    const txt = buildSampleTxt({
      "UI/MainMenu.msbt:0": "ابدأ",
    });
    const { translations } = parseEnglishOnlyTxt(txt);
    expect(translations["UI/MainMenu.msbt:0"]).toBe("ابدأ");
    expect(Object.keys(translations)).toHaveLength(1);
  });

  it("handles CRLF line endings", () => {
    const txt = buildSampleTxt({ "UI/MainMenu.msbt:0": "ابدأ" }).replace(
      /\n/g,
      "\r\n",
    );
    const { translations } = parseEnglishOnlyTxt(txt);
    expect(translations["UI/MainMenu.msbt:0"]).toBe("ابدأ");
  });

  it("returns empty result for unrelated text", () => {
    const txt = "this is not an english-only export";
    const { translations, emptyCount } = parseEnglishOnlyTxt(txt);
    expect(translations).toEqual({});
    expect(emptyCount).toBe(0);
  });

  it("stops a translation block at the next entry header even without a separator", () => {
    const lines = [
      "[1] (UI/X.msbt:0)",
      "",
      "Original A",
      "",
      "▶ Translation:",
      "",
      "ترجمة-أ",
      "[2] (UI/X.msbt:1)",
      "",
      "Original B",
      "",
      "▶ Translation:",
      "",
      "ترجمة-ب",
      SEP,
    ];
    const { translations } = parseEnglishOnlyTxt(lines.join("\n"));
    expect(translations).toEqual({
      "UI/X.msbt:0": "ترجمة-أ",
      "UI/X.msbt:1": "ترجمة-ب",
    });
  });
});
