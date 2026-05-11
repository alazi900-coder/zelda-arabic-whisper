import { describe, it, expect } from "vitest";
import {
  visualize,
  shortDiff,
  classifyBlockReason,
  summarizeRow,
  summarizeReport,
} from "@/lib/tag-report-format";

describe("tag-report-format snapshot", () => {
  it("visualize ثابت لمختلف المحارف غير المرئية", () => {
    const sample =
      "كلمة\uE020 + \uFFF9tag\uFFFB \u200Fنصّ\u200E \u202Bbidi\u202C \u200D\u00A0\nسطر";
    expect(visualize(sample)).toMatchInlineSnapshot(
      `"كلمة<PUA:E020> + <FFF9>tag<FFFB> <RLM>نصّ<LRM> <RLE>bidi<PDF> <ZWJ><NBSP>\\nسطر"`,
    );
  });

  it("shortDiff يكشف موضع الاختلاف الأوّل", () => {
    expect(shortDiff("abcdef", "abXdef")).toMatchInlineSnapshot(
      `"Δ@2: «abcdef» → «abXdef»"`,
    );
    expect(shortDiff("same", "same")).toBe("(لا تغيير)");
  });

  it("classifyBlockReason يصنّف بدقة", () => {
    expect(classifyBlockReason("\uE020")).toBe("pua-only");
    expect(classifyBlockReason("\uFFF9\uFFFB")).toBe("format-only");
    expect(classifyBlockReason("\u200F\u200E")).toBe("bidi-only");
    expect(classifyBlockReason("\uE020\u200F")).toBe("mixed-format-only");
  });

  it("summarizeRow ثابت", () => {
    const row = {
      msbtFile: "Inv.msbt",
      index: 0,
      causes: ["misplaced"],
      original: "جديد\uE020",
      translation: "جديد \uE020",
      fixed: "جديد\uE020",
    };
    expect(summarizeRow(row)).toMatchInlineSnapshot(`
      "• Inv.msbt#0
        causes: misplaced
        orig  : جديد<PUA:E020>
        trans : جديد <PUA:E020>
        fixed : جديد<PUA:E020>
        diff  : Δ@4: «جديد <PUA:E020>» → «جديد<PUA:E020>»"
    `);
  });

  it("summarizeReport متعدّد الصفوف ثابت", () => {
    const rows = [
      {
        msbtFile: "A.msbt", index: 0, causes: ["missing-tag"],
        original: "x\uE000y", translation: "xy", fixed: "x\uE000y",
      },
      {
        msbtFile: "B.msbt", index: 7, causes: ["wrong-order"],
        original: "\uE000\uE001", translation: "\uE001\uE000", fixed: "\uE000\uE001",
      },
    ];
    expect(summarizeReport(rows)).toMatchInlineSnapshot(`
      "• A.msbt#0
        causes: missing-tag
        orig  : x<PUA:E000>y
        trans : xy
        fixed : x<PUA:E000>y
        diff  : Δ@1: «xy» → «x<PUA:E000>y»
      • B.msbt#7
        causes: wrong-order
        orig  : <PUA:E000><PUA:E001>
        trans : <PUA:E001><PUA:E000>
        fixed : <PUA:E000><PUA:E001>
        diff  : Δ@0: «<PUA:E001><PUA:E000>» → «<PUA:E000><PUA:E001>»"
    `);
  });
});
