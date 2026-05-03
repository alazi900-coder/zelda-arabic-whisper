// Extra offline rules for the Quality Lab — fixes that don't need a curated
// dictionary. Each function takes a single input and returns LocalIssue[].

import type { LocalIssue } from "@/lib/local-enhance-scanner";

export interface ExtraInput {
  key: string;
  original: string;
  translation: string;
}

const TATWEEL = /\u0640+/g;
const ARABIC_DIGITS = /[\u0660-\u0669]/g;
const LATIN_DIGITS = /[0-9]/g;
const NON_BREAK_SPACE = /\u00A0/g;
const ELLIPSIS = "\u2026";
const ARABIC_LETTER = /[\u0600-\u06FF]/;

const stripTagsAndPlaceholders = (s: string): string =>
  s
    .replace(/<[^>]+>/g, "") // HTML/XML tags
    .replace(/\{[^}]+\}/g, "") // {placeholders}
    .replace(/%[a-zA-Z0-9._-]+/g, "") // %vars
    .replace(/\[[A-Z][^\]]*\]/g, ""); // [TAGS]

/** Tatweel/kashida used inside text — usually a typographic mistake in plain UI strings. */
export function ruleTatweel(input: ExtraInput): LocalIssue | null {
  const matches = input.translation.match(TATWEEL);
  if (!matches) return null;
  const fix = input.translation.replace(TATWEEL, "");
  if (fix === input.translation) return null;
  return {
    key: input.key,
    original: input.original,
    translation: input.translation,
    suggestion: fix,
    issue: "محرف الكشيدة (تطويل) داخل النص",
    reason:
      `يحتوي النص على ${matches.length} محرف كشيدة (ـ) وهو تطويل ` +
      `زخرفي يعطّل البحث ويُكسر الالتزام بالشكل القياسي. الإصلاح يحذف ` +
      `كلّ محارف الكشيدة دون المسّ بحروف الكلمة.`,
    severity: "low",
    type: "punctuation",
    rule: "tatweel",
  };
}

/** Translation mixes Arabic-Indic digits (٠١٢) with Latin digits (012). */
export function ruleMixedDigits(input: ExtraInput): LocalIssue | null {
  const ar = input.translation.match(ARABIC_DIGITS) || [];
  const la = input.translation.match(LATIN_DIGITS) || [];
  if (ar.length === 0 || la.length === 0) return null;
  // If original uses Latin digits, suggest converting the Arabic-Indic ones to Latin.
  const origLatin = (input.original.match(LATIN_DIGITS) || []).length;
  const origArabic = (input.original.match(ARABIC_DIGITS) || []).length;
  let suggestion = input.translation;
  if (origLatin >= origArabic) {
    suggestion = input.translation.replace(ARABIC_DIGITS, (d) =>
      String.fromCharCode(d.charCodeAt(0) - 0x0660 + 0x30),
    );
  } else {
    suggestion = input.translation.replace(LATIN_DIGITS, (d) =>
      String.fromCharCode(d.charCodeAt(0) - 0x30 + 0x0660),
    );
  }
  return {
    key: input.key,
    original: input.original,
    translation: input.translation,
    suggestion,
    issue: "خلط بين الأرقام العربية والهنديّة",
    reason:
      `الترجمة تحوي ${ar.length} رقماً هنديّاً (٠–٩) و ${la.length} رقماً ` +
      `عربيّاً (0–9). ينبغي اعتماد نظام واحد عبر اللعبة كلّها. ` +
      `الاقتراح يوحّد الأرقام تبعاً لما اعتمده النصّ الأصليّ.`,
    severity: "medium",
    type: "consistency",
    rule: "mixed_digits",
  };
}

/** Original ends with `?` but translation does not have an Arabic question mark `؟`. */
export function ruleMissingArabicQuestion(input: ExtraInput): LocalIssue | null {
  const origStripped = stripTagsAndPlaceholders(input.original).trim();
  const tStripped = stripTagsAndPlaceholders(input.translation).trim();
  if (!origStripped.endsWith("?")) return null;
  if (!tStripped) return null;
  if (tStripped.endsWith("؟")) return null;
  // If the translation contains no Arabic letters, skip — likely English.
  if (!ARABIC_LETTER.test(tStripped)) return null;
  // Build a suggestion by replacing trailing `?` (or appending) with `؟`.
  let fix = input.translation;
  if (/\?\s*$/.test(fix)) {
    fix = fix.replace(/\?\s*$/, "؟");
  } else {
    fix = `${fix.replace(/\s+$/, "")}؟`;
  }
  return {
    key: input.key,
    original: input.original,
    translation: input.translation,
    suggestion: fix,
    issue: "علامة الاستفهام العربية مفقودة",
    reason:
      "النص الأصلي ينتهي بعلامة استفهام (؟) لكن الترجمة لا تنتهي بـ «؟». " +
      "في النصوص العربية الموجَّهة للقارئ تُستخدم علامة الاستفهام العربية «؟» وليس الإنجليزية «?».",
    severity: "low",
    type: "punctuation",
    rule: "missing_arabic_question",
  };
}

/** Three dots `...` used instead of the proper ellipsis character `…`. */
export function ruleEllipsis(input: ExtraInput): LocalIssue | null {
  if (!/\.\.\./.test(input.translation)) return null;
  const fix = input.translation.replace(/\.{3,}/g, ELLIPSIS);
  if (fix === input.translation) return null;
  return {
    key: input.key,
    original: input.original,
    translation: input.translation,
    suggestion: fix,
    issue: "ثلاث نقاط «...» بدل علامة الحذف «…»",
    reason:
      "ينبغي استخدام محرف علامة الحذف الواحد (…) بدل ثلاث نقاط متتالية. " +
      "هذا يحافظ على الشكل الصحيح ولا يُكسر السطر بين النقاط في بعض الخطوط.",
    severity: "low",
    type: "punctuation",
    rule: "ellipsis_chars",
  };
}

/** Non-breaking spaces inside the translation that aren't in the original. */
export function ruleNbsp(input: ExtraInput): LocalIssue | null {
  if (!NON_BREAK_SPACE.test(input.translation)) return null;
  const origCount = (input.original.match(NON_BREAK_SPACE) || []).length;
  const trCount = (input.translation.match(NON_BREAK_SPACE) || []).length;
  if (trCount <= origCount) return null;
  const fix = input.translation.replace(NON_BREAK_SPACE, " ");
  return {
    key: input.key,
    original: input.original,
    translation: input.translation,
    suggestion: fix,
    issue: "مسافات غير قابلة للكسر (U+00A0)",
    reason:
      `الترجمة تحوي مسافات غير قابلة للكسر (\u00A0) أكثر من الأصل ` +
      `(${trCount} مقابل ${origCount}). هذا يحدث عند النسخ من Word/Web. ` +
      `الإصلاح يستبدلها بمسافات عادية.`,
    severity: "low",
    type: "punctuation",
    rule: "nbsp",
  };
}

/**
 * Length anomaly: if the translation length (after stripping tags) is more
 * than 3x or less than 1/3 of the original length, flag it. This usually
 * indicates either a missing translation or accidental duplication.
 */
export function ruleLengthAnomaly(input: ExtraInput): LocalIssue | null {
  const o = stripTagsAndPlaceholders(input.original).trim();
  const t = stripTagsAndPlaceholders(input.translation).trim();
  if (o.length < 1 || t.length < 1) return null;
  const ratio = t.length / Math.max(o.length, 1);
  if (o.length >= 12 && ratio < 0.33) {
    return {
      key: input.key,
      original: input.original,
      translation: input.translation,
      suggestion: input.translation,
      issue: "الترجمة قصيرة بشكل غير طبيعي",
      reason:
        `طول الترجمة بعد تنظيف الوسوم ${t.length} حرف مقابل ${o.length} في ` +
        `الأصل (نسبة ${ratio.toFixed(2)}x). من المتوقّع أن تكون العربية ` +
        `أطول قليلاً من الإنجليزية، فجملة بهذا القصر قد تكون ناقصة المعنى.`,
      severity: "high",
      type: "accuracy",
      rule: "length_anomaly",
    };
  }
  if (ratio > 3.5 && t.length >= 30) {
    return {
      key: input.key,
      original: input.original,
      translation: input.translation,
      suggestion: input.translation,
      issue: "الترجمة طويلة بشكل غير طبيعي",
      reason:
        `طول الترجمة ${t.length} حرف مقابل ${o.length} في الأصل (نسبة ${ratio.toFixed(
          2,
        )}x). قد تكون مضاعفة بالخطأ، أو تحتوي تكراراً، أو شرحاً زائداً ` +
        `بدل الترجمة الحرفيّة.`,
      severity: "medium",
      type: "accuracy",
      rule: "length_anomaly",
    };
  }
  return null;
}

const RULES: Array<(i: ExtraInput) => LocalIssue | null> = [
  ruleTatweel,
  ruleMixedDigits,
  ruleMissingArabicQuestion,
  ruleEllipsis,
  ruleNbsp,
  ruleLengthAnomaly,
];

export function scanExtraRules(input: ExtraInput): LocalIssue[] {
  const out: LocalIssue[] = [];
  for (const rule of RULES) {
    const r = rule(input);
    if (r) out.push(r);
  }
  return out;
}

export function scanAllExtraRules(inputs: ExtraInput[]): LocalIssue[] {
  const out: LocalIssue[] = [];
  for (const input of inputs) out.push(...scanExtraRules(input));
  return out;
}
