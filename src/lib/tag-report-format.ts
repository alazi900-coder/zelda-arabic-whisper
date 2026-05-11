/**
 * أدوات عرض موحَّدة لتقارير إصلاح الرموز (`??`).
 * تُستخدم في:
 *  - اختبارات Snapshot لضمان ثبات شكل التقرير.
 *  - الواجهة لعرض تفاصيل النصّ المحظور إرساله للذكاء الاصطناعي.
 */

const PUA_RANGE = /[\uE000-\uE0FF]/g;

/** يحوّل المحارف غير المرئية إلى رموز قابلة للقراءة. */
export function visualize(s: string): string {
  if (!s) return "";
  return s
    .replace(PUA_RANGE, m => `<PUA:${m.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}>`)
    .replace(/\uFFF9/g, "<FFF9>")
    .replace(/\uFFFA/g, "<FFFA>")
    .replace(/\uFFFB/g, "<FFFB>")
    .replace(/\uFFFC/g, "<FFFC>")
    .replace(/\u200E/g, "<LRM>")
    .replace(/\u200F/g, "<RLM>")
    .replace(/\u202A/g, "<LRE>")
    .replace(/\u202B/g, "<RLE>")
    .replace(/\u202C/g, "<PDF>")
    .replace(/\u202D/g, "<LRO>")
    .replace(/\u202E/g, "<RLO>")
    .replace(/\u200B/g, "<ZWSP>")
    .replace(/\u200C/g, "<ZWNJ>")
    .replace(/\u200D/g, "<ZWJ>")
    .replace(/\uFEFF/g, "<BOM>")
    .replace(/\u00A0/g, "<NBSP>")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/** diff مختصر يُظهر أوّل موضع اختلاف وسياقه. */
export function shortDiff(before: string, after: string): string {
  if (before === after) return "(لا تغيير)";
  let i = 0;
  while (i < before.length && i < after.length && before[i] === after[i]) i++;
  const ctxA = visualize(before.slice(Math.max(0, i - 6), i + 10));
  const ctxB = visualize(after.slice(Math.max(0, i - 6), i + 10));
  return `Δ@${i}: «${ctxA}» → «${ctxB}»`;
}

/** سبب حظر إرسال نصّ للذكاء الاصطناعي. */
export type BlockReason = "pua-only" | "format-only" | "bidi-only" | "mixed-format-only";

/** يصنّف سبب اعتبار النصّ مكوّناً من رموز/تنسيق فقط. */
export function classifyBlockReason(text: string): BlockReason {
  const hasPua = /[\uE000-\uE0FF]/.test(text);
  const hasFormat = /[\uFFF9\uFFFA\uFFFB\uFFFC]/.test(text);
  const hasBidi = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/.test(text);
  const flags = [hasPua, hasFormat, hasBidi].filter(Boolean).length;
  if (flags > 1) return "mixed-format-only";
  if (hasPua) return "pua-only";
  if (hasFormat) return "format-only";
  return "bidi-only";
}

export const BLOCK_REASON_LABEL_AR: Record<BlockReason, string> = {
  "pua-only": "رموز PUA فقط (E000–E0FF)",
  "format-only": "علامات تنسيق Unicode فقط (FFF9–FFFC)",
  "bidi-only": "علامات اتجاه نصّ فقط (LRM/RLM/ZWJ…)",
  "mixed-format-only": "خليط من رموز ومحارف تنسيق فقط بدون نصّ قابل للترجمة",
};

export interface ReportRow {
  msbtFile: string;
  index: number;
  causes: string[];
  original: string;
  translation: string;
  fixed: string;
}

/** يُنتج سطر تقرير ثابت الشكل (مناسب للـ snapshot). */
export function summarizeRow(row: ReportRow): string {
  return [
    `• ${row.msbtFile}#${row.index}`,
    `  causes: ${row.causes.join(", ") || "(none)"}`,
    `  orig  : ${visualize(row.original)}`,
    `  trans : ${visualize(row.translation)}`,
    `  fixed : ${visualize(row.fixed)}`,
    `  diff  : ${shortDiff(row.translation, row.fixed)}`,
  ].join("\n");
}

export function summarizeReport(rows: ReportRow[]): string {
  return rows.map(summarizeRow).join("\n");
}
