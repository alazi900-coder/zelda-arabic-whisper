import { describe, it, expect } from "vitest";
import {
  restoreTagsAndLineBreaks,
  collectRestoreIssueKeys,
  getDetailedRestoreIssues,
} from "@/lib/tag-restore";
import { isOnlyTechnicalTags, isTechnicalText } from "@/components/editor/types";

/**
 * هذا الاختبار يعيد إنتاج حالة ظهور "??" داخل اللعبة الناتجة عن:
 *  1) فقدان رموز PUA (0x0E / U+E0XX) من ترجمة الذكاء الاصطناعي.
 *  2) إزاحة الرموز عن موضعها الملاصق للكلمة (مثل قائمة الجرد).
 *  3) فواصل الأسطر المحوّلة إلى "\n" حرفي أو <br>.
 *  4) إرسال نصّ مكوّن من رموز تقنية فقط للترجمة (يجب منعه).
 *
 * عيّنات MSBT المُختصَرة مأخوذة من بنية ملفات TotK الحقيقية.
 */

const SAMPLES = [
  // 1) قائمة جرد: كلمة + رمز PUA يجب أن يبقى ملاصقاً.
  {
    file: "Inventory.msbt",
    index: 0,
    original: "جديد\uE020",
    aiOutput: "جديد \uE020", // الـ AI أضاف مسافة → سيظهر ??
  },
  // 2) رمز PUA حُذف بالكامل من الترجمة.
  {
    file: "Menu.msbt",
    index: 1,
    original: "فرز\uE021 العناصر",
    aiOutput: "فرز العناصر",
  },
  // 3) ترتيب الرموز انعكس بسبب BiDi.
  {
    file: "Dialog.msbt",
    index: 2,
    original: "اضغط \uE000\uE001 للمتابعة",
    aiOutput: "اضغط \uE001\uE000 للمتابعة",
  },
  // 4) فاصل سطر حُوّل إلى <br>.
  {
    file: "Tips.msbt",
    index: 3,
    original: "السطر الأول\nالسطر الثاني",
    aiOutput: "السطر الأول<br>السطر الثاني",
  },
  // 5) رمز PUA انحشر داخل كلمة.
  {
    file: "Quest.msbt",
    index: 4,
    original: "اجمع \uE010 تفاحات",
    aiOutput: "اجم\uE010ع تفاحات",
  },
];

describe("regression: ?? symbols caused by lost/shifted PUA tags", () => {
  it("ينتج عن المشاكل الخام عدد إصلاحات > 0 قبل المعالجة", () => {
    const entries = SAMPLES.map(s => ({
      msbtFile: s.file,
      index: s.index,
      original: s.original,
    }));
    const translations: Record<string, string> = {};
    for (const s of SAMPLES) translations[`${s.file}:${s.index}`] = s.aiOutput;

    const issuesBefore = collectRestoreIssueKeys(entries as any, translations);
    expect(issuesBefore.size).toBe(SAMPLES.length);

    const detailed = getDetailedRestoreIssues(entries as any, translations);
    expect(detailed.length).toBe(SAMPLES.length);
  });

  it("بعد restoreTagsAndLineBreaks تنخفض المشاكل إلى صفر (أو قريباً منه)", () => {
    const entries = SAMPLES.map(s => ({
      msbtFile: s.file,
      index: s.index,
      original: s.original,
    }));
    const fixed: Record<string, string> = {};
    for (const s of SAMPLES) {
      fixed[`${s.file}:${s.index}`] = restoreTagsAndLineBreaks(s.original, s.aiOutput);
    }

    const issuesAfter = collectRestoreIssueKeys(entries as any, fixed);
    expect(issuesAfter.size).toBeLessThanOrEqual(1);
  });

  it("كلّ ناتج مُصلَح يحوي نفس عدد رموز PUA كالأصل", () => {
    const TAG = /[\uE000-\uE0FF\uFFF9-\uFFFC]/g;
    for (const s of SAMPLES) {
      const fixed = restoreTagsAndLineBreaks(s.original, s.aiOutput);
      const origCount = (s.original.match(TAG) || []).length;
      const fixedCount = (fixed.match(TAG) || []).length;
      expect(fixedCount).toBe(origCount);
    }
  });
});

describe("protection: نصوص الرموز التقنية فقط لا تُرسَل للذكاء الاصطناعي", () => {
  const onlyTagSamples = [
    "\uE020",
    "\uE000\uE001\uE002",
    " \uE010  \uE011 ",
    "\uFFF9\uFFFB",
  ];
  const mixedSamples = [
    "جديد\uE020",
    "Hello \uE000",
    "اضغط زر",
  ];

  it("isOnlyTechnicalTags=true للنصوص التقنية البحتة", () => {
    for (const t of onlyTagSamples) {
      expect(isOnlyTechnicalTags(t)).toBe(true);
      expect(isTechnicalText(t)).toBe(true);
    }
  });

  it("isOnlyTechnicalTags=false للنصوص المختلطة أو العادية", () => {
    for (const t of mixedSamples) {
      expect(isOnlyTechnicalTags(t)).toBe(false);
    }
  });
});
