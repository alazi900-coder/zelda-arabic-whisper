// =============================================================================
// فحص جودة تقسيم الأسطر للترجمة العربية مقارنةً بالنصّ الإنجليزي الأصلي.
// محلّي بالكامل، بدون شبكة. يُعطي «درجة سوء» 0..100 + أسباب + اقتراح تقسيم أفضل.
// =============================================================================

const TAG_REGEX = /[\uFFF9-\uFFFC\uE000-\uE0FF]/g;

/** كلمات/حروف لا يصحّ أن يبدأ بها سطر جديد في العربية. */
const NO_START_TOKENS = new Set([
  "و", "ف", "ل", "ب", "ك",
  "في", "من", "إلى", "الى", "على", "عن", "مع", "حتى", "لكن", "لكنّ", "أو", "أم",
  "ثم", "ثمّ", "إذ", "إذا", "كي", "بل", "لا", "ما", "لم", "لن", "قد",
  "هذا", "هذه", "هؤلاء", "ذلك", "تلك",
]);

/** علامات ترقيم تنتهي بها الجمل عادةً (نهاية فكرة منطقية). */
const SENTENCE_END = /[.!?؟،,;:؛…]/;

const stripTags = (s: string): string => (s || "").replace(TAG_REGEX, "");

const splitLines = (s: string): string[] => (s || "").split(/\r?\n/);

const wordCount = (s: string): number => {
  const t = stripTags(s).trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
};

/** نسبة موقع كل `\n` داخل النصّ (تجاهل الرموز التقنية لتقدير الموقع المعنوي). */
function lineBreakRatios(s: string): number[] {
  const stripped = stripTags(s);
  const total = stripped.length;
  if (!total) return [];
  const out: number[] = [];
  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] === "\n") out.push(i / total);
  }
  return out;
}

export type LineSplitCause =
  | "line-count-mismatch"
  | "very-short-line"
  | "very-unbalanced"
  | "broken-phrase"
  | "drift-from-original-positions";

export interface LineSplitDiagnosis {
  score: number; // 0..100 — كلّما زادت زادت السوء
  causes: LineSplitCause[];
  reasons: string[];
  origLineCount: number;
  trLineCount: number;
}

/** يحلّل تقسيم سطر واحد. */
export function diagnoseLineSplit(originalEn: string, translation: string): LineSplitDiagnosis {
  const oLines = splitLines(originalEn).filter(l => l.trim().length > 0);
  const tLines = splitLines(translation).filter(l => l.trim().length > 0);
  const causes: LineSplitCause[] = [];
  const reasons: string[] = [];
  let score = 0;

  // (1) اختلاف عدد الأسطر — يطبَّق فقط حين يكون الأصل متعدّد الأسطر.
  if (oLines.length > 1 && tLines.length !== oLines.length) {
    causes.push("line-count-mismatch");
    const diff = Math.abs(tLines.length - oLines.length);
    score += Math.min(40, diff * 18);
    reasons.push(`عدد الأسطر مختلف عن الأصل (${tLines.length} مقابل ${oLines.length})`);
  }

  // (2) أسطر قصيرة جداً مقارنةً بنظيرها في الأصل.
  if (tLines.length > 1) {
    let veryShort = 0;
    for (let i = 0; i < tLines.length; i++) {
      const tw = wordCount(tLines[i]);
      const ow = wordCount(oLines[i] ?? "");
      if (tw > 0 && tw <= 2 && ow >= 4) veryShort++;
      else if (tw === 1 && tLines.length > 2) veryShort++;
    }
    if (veryShort > 0) {
      causes.push("very-short-line");
      score += Math.min(30, veryShort * 14);
      reasons.push(`${veryShort} سطر قصير جداً (كلمة أو اثنتان)`);
    }
  }

  // (3) عدم توازن طول الأسطر مقارنةً بمتوسّط الأصل.
  if (tLines.length > 1 && oLines.length > 0) {
    const oLens = oLines.map(l => stripTags(l).trim().length);
    const oAvg = oLens.reduce((a, b) => a + b, 0) / oLens.length || 1;
    let imbalanced = 0;
    for (const tl of tLines) {
      const tlen = stripTags(tl).trim().length;
      const ratio = tlen / oAvg;
      if (ratio < 0.35 || ratio > 2.2) imbalanced++;
    }
    if (imbalanced > 0) {
      causes.push("very-unbalanced");
      score += Math.min(25, imbalanced * 10);
      reasons.push(`أطوال الأسطر غير متوازنة (${imbalanced} سطر)`);
    }
  }

  // (4) قطع في منتصف عبارة مترابطة: السطر التالي يبدأ بحرف عطف/جر/ضمير،
  //     أو السطر السابق لا ينتهي بعلامة ترقيم.
  if (tLines.length > 1) {
    let broken = 0;
    for (let i = 1; i < tLines.length; i++) {
      const prev = tLines[i - 1].trim();
      const cur = tLines[i].trim();
      if (!cur) continue;
      const firstWord = cur.split(/\s+/)[0]?.replace(/^[«»"'(]+/, "") || "";
      const startsBad = NO_START_TOKENS.has(firstWord);
      const lastChar = stripTags(prev).trim().slice(-1);
      const prevEndsCleanly = SENTENCE_END.test(lastChar);
      if (startsBad && !prevEndsCleanly) broken++;
      else if (!prevEndsCleanly && wordCount(prev) >= 6 && wordCount(cur) <= 3) broken++;
    }
    if (broken > 0) {
      causes.push("broken-phrase");
      score += Math.min(35, broken * 18);
      reasons.push(`قطع في منتصف عبارة مترابطة (${broken} موضع)`);
    }
  }

  // (5) انحراف نسبيّ عن مواقع فواصل الأصل (حين يتطابق العدد).
  if (oLines.length > 1 && tLines.length === oLines.length) {
    const oRatios = lineBreakRatios(originalEn);
    const tRatios = lineBreakRatios(translation);
    if (oRatios.length === tRatios.length && oRatios.length > 0) {
      let drift = 0;
      for (let i = 0; i < oRatios.length; i++) {
        if (Math.abs(oRatios[i] - tRatios[i]) > 0.18) drift++;
      }
      if (drift > 0) {
        causes.push("drift-from-original-positions");
        score += Math.min(20, drift * 10);
        reasons.push(`مواقع الفواصل بعيدة عن مواقع الأصل (${drift})`);
      }
    }
  }

  return {
    score: Math.min(100, Math.round(score)),
    causes,
    reasons,
    origLineCount: oLines.length,
    trLineCount: tLines.length,
  };
}

// -----------------------------------------------------------------------------
// اقتراح تقسيم محلّي
// -----------------------------------------------------------------------------

/** هل يصحّ كسر السطر بعد المسافة في الموضع `pos` داخل النصّ؟ */
function canBreakAt(stripped: string, pos: number): boolean {
  if (pos <= 0 || pos >= stripped.length) return false;
  const before = stripped.slice(0, pos).trim();
  const after = stripped.slice(pos).trim();
  if (!before || !after) return false;
  const nextWord = after.split(/\s+/)[0]?.replace(/^[«»"'(]+/, "") || "";
  if (NO_START_TOKENS.has(nextWord)) return false;
  return true;
}

/** يقترح تقسيمًا أفضل بناءً على نسب فواصل الأصل ومنع كسر العبارات. */
export function proposeBetterSplit(originalEn: string, translation: string): string {
  if (!translation?.trim()) return translation;
  const oLines = splitLines(originalEn);
  const oContentLines = oLines.filter(l => l.trim().length > 0);
  if (oContentLines.length <= 1) {
    // الأصل سطر واحد — لا نُدخل فواصل.
    return translation.replace(/\s*\n\s*/g, " ").trim();
  }

  // ابدأ من نصّ الترجمة الموحَّد بسطر واحد (مع الحفاظ على الرموز).
  // لا نُسقط الرموز لأنّها جزء من النصّ — نتعامل معها كحروف ع