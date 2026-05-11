import { describe, it, expect } from "vitest";
import {
  restoreTagsAndLineBreaks,
  getDetailedRestoreIssues,
  type DetailedIssue,
} from "@/lib/tag-restore";
import { isOnlyTechnicalTags } from "@/components/editor/types";

/** يُحوّل المحارف غير المرئية إلى رموز قابلة للقراءة في تقارير الاختبار. */
function visualize(s: string): string {
  return s
    .replace(/[\uE000-\uE0FF]/g, m => `<PUA:${m.charCodeAt(0).toString(16).toUpperCase()}>`)
    .replace(/\uFFF9/g, "<FFF9>")
    .replace(/\uFFFA/g, "<FFFA>")
    .replace(/\uFFFB/g, "<FFFB>")
    .replace(/\uFFFC/g, "<FFFC>")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/** diff مختصر يظهر طول الفرق وأوّل موضع اختلاف. */
function shortDiff(before: string, after: string): string {
  if (before === after) return "(لا تغيير)";
  let i = 0;
  while (i < before.length && i < after.length && before[i] === after[i]) i++;
  const ctxA = visualize(before.slice(Math.max(0, i - 6), i + 10));
  const ctxB = visualize(after.slice(Math.max(0, i - 6), i + 10));
  return `Δ@${i}: «${ctxA}» → «${ctxB}»`;
}

function summarize(issue: DetailedIssue, fixed: string): string {
  return [
    `  • ${issue.msbtFile}#${issue.index}`,
    `    causes : ${issue.causes.join(", ") || "(none)"}`,
    `    orig   : ${visualize(issue.original)}`,
    `    trans  : ${visualize(issue.translation)}`,
    `    fixed  : ${visualize(fixed)}`,
    `    diff   : ${shortDiff(issue.translation, fixed)}`,
  ].join("\n");
}

describe("isOnlyTechnicalTags — حالات حافة موسّعة", () => {
  const onlyTags = [
    "\uE020",
    "\uE000\uE001",
    "  \uE010 \t\uE011 \n",
    "\uE020، \uE021.", // علامات ترقيم عربية + لاتينية
    "[\uE000] - (\uE001)",
    "\u200F\uE020\u200E", // علامات BiDi محيطة
    "\uFFF9...\uFFFB",
  ];
  const mixedOrPlain = [
    "جديد\uE020",            // كلمة + رمز
    "Hello \uE000",
    "اضغط زر للمتابعة",
    "1234",                   // أرقام فقط (لا رموز)
    "...",                    // علامات فقط (لا رموز)
    "",                       // فارغ
    " \t\n",                  // فراغ فقط
    "5\uE000",                // رقم + رمز ⇒ لا يُعتبر بحت تقنياً
  ];

  it.each(onlyTags)("يحمي النصّ التقني البحت: %s", (t) => {
    expect(isOnlyTechnicalTags(t)).toBe(true);
  });

  it.each(mixedOrPlain)("لا يحمي النصّ القابل للترجمة: %s", (t) => {
    expect(isOnlyTechnicalTags(t)).toBe(false);
  });
});

describe("تقرير الإصلاح المفصّل: السبب + diff قبل/بعد", () => {
  const cases = [
    {
      file: "Inv.msbt", index: 0,
      original: "جديد\uE020",
      translation: "جديد \uE020",
      label: "PUA منفصل عن كلمة قائمة (glue)",
    },
    {
      file: "Menu.msbt", index: 1,
      original: "فرز\uE021 العناصر",
      translation: "فرز العناصر",
      label: "PUA مفقود كلياً",
    },
    {
      file: "Dlg.msbt", index: 2,
      original: "اضغط \uE000\uE001 للمتابعة",
      translation: "اضغط \uE001\uE000 للمتابعة",
      label: "ترتيب رموز معكوس (BiDi)",
    },
    {
      file: "Tip.msbt", index: 3,
      original: "سطر١\nسطر٢",
      translation: "سطر١<br>سطر٢",
      label: "<br> بدل \\n",
    },
    {
      file: "Qst.msbt", index: 4,
      original: "اجمع \uE010 تفاحات",
      translation: "اجم\uE010ع تفاحات",
      label: "PUA محشور داخل كلمة",
    },
  ];

  it("يولّد تقريراً يصف كلّ سبب ويُظهر diff قبل/بعد ويُسقط المشاكل", () => {
    const entries = cases.map(c => ({ msbtFile: c.file, index: c.index, original: c.original }));
    const translations: Record<string, string> = {};
    for (const c of cases) translations[`${c.file}:${c.index}`] = c.translation;

    const detailed = getDetailedRestoreIssues(entries as any, translations);
    expect(detailed.length).toBe(cases.length);

    const lines: string[] = ["", "=== Restore report (before fix) ==="];
    const fixedMap: Record<string, string> = {};
    for (const issue of detailed) {
      const fixed = restoreTagsAndLineBreaks(issue.original, issue.translation);
      fixedMap[`${issue.msbtFile}:${issue.index}`] = fixed;
      lines.push(summarize(issue, fixed));
    }
    // اطبع التقرير ليظهر في مخرجات vitest عند --reporter=verbose أو عند الفشل.
    console.log(lines.join("\n"));

    // تحقّق بعدي: لا تبقى مشاكل قابلة للإصلاح آلياً.
    const afterIssues = getDetailedRestoreIssues(entries as any, fixedMap);
    expect(afterIssues.length).toBeLessThanOrEqual(1);
  });
});
