// إصلاح الرموز التقنية وفواصل السطور.
// 1) يعيد ترميز PUA (U+E000..U+E0FF) و FFF9..FFFC التي يحذفها/يشوّهها مترجِم AI.
// 2) يعيد فواصل الأسطر (\n) عندما يدمج المترجِم الأسطر في سطر واحد، أو
//    يحوّل \\n الحرفية و <br> إلى أسطر حقيقية.
//
// كلّ مسار ترجمة / بناء يجب أن يمرّ عبر `restoreTagsAndLineBreaks` كحارس أخير.

import { restoreTagsLocally } from "@/components/editor/types";

const TAG_REGEX_G = /[\uFFF9-\uFFFC\uE000-\uE0FF]/g;

/** علامات الترقيم العربية والإنجليزية التي يُفضَّل القطع عندها لإعادة بناء سطر مدموج. */
const NATURAL_BREAKS = new Set([
  "،", ",", ".", "؟", "?", "!", "؛", ";", ":", "…",
]);

/** يحوّل تمثيلات الـ AI الشائعة للأسطر إلى \n حقيقي قبل أيّ معالجة. */
export function normalizeLineBreakRepresentations(text: string): string {
  if (!text) return text;
  let out = text;
  // <br>, <br/>, <br /> → \n
  out = out.replace(/<br\s*\/?>/gi, "\n");
  // \r\n / \r → \n
  out = out.replace(/\r\n?/g, "\n");
  // backslash-n الحرفي (مثل النصّ "\n") → \n
  // مهم: لا نلمس \\n المكتوب فعلاً (الباك‑سلاش ثم n حقيقيّاً ضمن النصّ يأتي عبر AI).
  out = out.replace(/\\n/g, "\n");
  return out;
}

/**
 * يعيد فواصل الأسطر (\n) المفقودة من الترجمة بناءً على الأصل.
 * - يحافظ على الترجمة كما هي لو عدد الأسطر متطابق.
 * - يحوّل التمثيلات الحرفية (\\n, <br>, CR) إلى \n حقيقي.
 * - إن كان الأصل بأكثر من سطر والترجمة سطر واحد، يقسّم الترجمة عند أقرب
 *   نقطة طبيعية (علامة ترقيم) لمواقع متناسبة مع طول كلّ سطر في الأصل.
 * - لا يلمس الترجمة لو كانت مقسّمة جزئياً (لتجنّب تخمين خاطئ).
 */
export function restoreLineBreaks(original: string, translation: string): string {
  if (!original || !translation) return translation;

  const work = normalizeLineBreakRepresentations(translation);

  const origLines = original.split("\n");
  if (origLines.length <= 1) return work;

  const workLines = work.split("\n");
  if (workLines.length === origLines.length) return work;
  // الترجمة مقسّمة جزئياً — لا نخمّن.
  if (workLines.length > 1) return work;

  // الأصل > 1 سطر، الترجمة سطر واحد: نعيد التقسيم.
  const text = work;
  const totalOrigLen = origLines.reduce((s, l) => s + l.length, 0) || 1;
  const targets: number[] = [];
  let cum = 0;
  for (let i = 0; i < origLines.length - 1; i++) {
    cum += origLines[i].length;
    targets.push(cum / totalOrigLen);
  }

  const result: string[] = [];
  let pos = 0;
  const SEARCH_WINDOW = 12;

  for (const t of targets) {
    if (pos >= text.length) {
      result.push("");
      continue;
    }
    const idealEnd = Math.max(pos + 1, Math.round(text.length * t));

    // ابحث عن أقرب علامة ترقيم طبيعية حول النقطة المثاليّة.
    let best = -1;
    for (let d = 0; d <= SEARCH_WINDOW; d++) {
      const left = idealEnd - d;
      const right = idealEnd + d;
      if (left > pos && left < text.length && NATURAL_BREAKS.has(text[left])) { best = left + 1; break; }
      if (right > pos && right < text.length && NATURAL_BREAKS.has(text[right])) { best = right + 1; break; }
    }
    // ثم بأقرب مسافة.
    if (best === -1) {
      for (let d = 0; d <= SEARCH_WINDOW; d++) {
        const left = idealEnd - d;
        const right = idealEnd + d;
        if (left > pos && left < text.length && text[left] === " ") { best = left; break; }
        if (right > pos && right < text.length && text[right] === " ") { best = right; break; }
      }
    }
    if (best === -1 || best <= pos) best = Math.min(idealEnd, text.length);

    const segment = text.slice(pos, best).replace(/\s+$/, "");
    result.push(segment);
    pos = best;
    while (pos < text.length && text[pos] === " ") pos++;
  }

  result.push(text.slice(pos));
  return result.join("\n");
}

/**
 * إصلاح موحَّد: يطبّق إعادة الرموز ثم إعادة فواصل الأسطر بهذا الترتيب.
 * - الرموز أوّلاً لأنها قد تنتقل بين الأسطر بعد التقسيم.
 * - يضمن أنّ كلّ ما يخرج من أيّ مترجِم يمرّ عبر هذا قبل الحفظ والبناء.
 */
export function restoreTagsAndLineBreaks(original: string, translation: string): string {
  if (!translation) return translation;
  const afterLineBreaks = restoreLineBreaks(original, translation);
  return restoreTagsLocally(original, afterLineBreaks);
}

export interface RestoreIssue {
  key: string;
  msbtFile: string;
  label: string;
  original: string;
  before: string;
  after: string;
  missingTags: number;
  missingLineBreaks: number;
}

export interface RestoreReport {
  scanned: number;
  fixable: number;
  byFile: Record<string, number>;
  examples: RestoreIssue[];
}

/** يحسب عدد الرموز التقنية في نصّ. */
function countTags(text: string): number {
  return (text.match(TAG_REGEX_G) || []).length;
}

/** يحسب عدد فواصل الأسطر في نصّ. */
function countLineBreaks(text: string): number {
  if (!text) return 0;
  let n = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") n++;
  return n;
}

/**
 * يفحص كلّ الترجمات ويُرجع تقريراً عن الإدخالات التي ينقصها رموز و/أو فواصل أسطر،
 * مع معاينة "قبل/بعد" بدون تطبيق. يستعمل قبل عرض شاشة التأكيد.
 */
export function scanTranslationsForRestore(
  entries: { msbtFile: string; index: number; label: string; original: string }[],
  translations: Record<string, string>,
  maxExamples = 5,
): RestoreReport {
  const byFile: Record<string, number> = {};
  const examples: RestoreIssue[] = [];
  let scanned = 0;
  let fixable = 0;

  for (const entry of entries) {
    const key = `${entry.msbtFile}:${entry.index}`;
    const trans = translations[key];
    if (!trans || !trans.trim()) continue;
    scanned++;

    const origTags = countTags(entry.original);
    const origBreaks = countLineBreaks(entry.original);
    const transTags = countTags(trans);
    const transBreaks = countLineBreaks(normalizeLineBreakRepresentations(trans));

    const needsTags = origTags > transTags;
    const needsBreaks = origBreaks > transBreaks || trans !== normalizeLineBreakRepresentations(trans);
    if (!needsTags && !needsBreaks) continue;

    const after = restoreTagsAndLineBreaks(entry.original, trans);
    if (after === trans) continue;

    fixable++;
    byFile[entry.msbtFile] = (byFile[entry.msbtFile] || 0) + 1;
    if (examples.length < maxExamples) {
      examples.push({
        key, msbtFile: entry.msbtFile, label: entry.label,
        original: entry.original, before: trans, after,
        missingTags: Math.max(0, origTags - transTags),
        missingLineBreaks: Math.max(0, origBreaks - transBreaks),
      });
    }
  }

  return { scanned, fixable, byFile, examples };
}

/**
 * يحسب التحديثات الفعليّة لتطبيق الإصلاح على كلّ الترجمات.
 * يُرجع `updates` (المفاتيح والقيم الجديدة فقط) و`previous` (لاسترجاع التراجع).
 */
export function buildRestoreUpdates(
  entries: { msbtFile: string; index: number; original: string }[],
  translations: Record<string, string>,
): { updates: Record<string, string>; previous: Record<string, string> } {
  const updates: Record<string, string> = {};
  const previous: Record<string, string> = {};
  for (const entry of entries) {
    const key = `${entry.msbtFile}:${entry.index}`;
    const trans = translations[key];
    if (!trans || !trans.trim()) continue;
    const after = restoreTagsAndLineBreaks(entry.original, trans);
    if (after !== trans) {
      updates[key] = after;
      previous[key] = trans;
    }
  }
  return { updates, previous };
}
