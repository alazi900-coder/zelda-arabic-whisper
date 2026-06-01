// Dictionary of common Arabic hamza/spelling errors with their corrections.
// Each entry maps a wrong form to the correct form.
//
// Categories covered:
//  - Hamza on alif (إ/أ/ا)
//  - Hamza on waaw (ؤ)
//  - Hamza on yaa (ئ)
//  - Standalone hamza (ء)
//  - Common confusions: إن شاء الله, هذا, هذه, etc.
//  - Long-vowel mistakes (ي vs ى, و vs ؤ)

export const HAMZA_DICT: ReadonlyArray<readonly [wrong: string, right: string]> = [
  // إن شاء الله variants
  ["إنشالله", "إن شاء الله"],
  ["انشاءالله", "إن شاء الله"],
  ["انشالله", "إن شاء الله"],
  ["إنشاءالله", "إن شاء الله"],
  ["انشاء الله", "إن شاء الله"],
  ["إنشاء الله", "إن شاء الله"],
  ["ان شاء الله", "إن شاء الله"],
  ["ماشاءالله", "ما شاء الله"],
  ["ماشاالله", "ما شاء الله"],
  ["ماشالله", "ما شاء الله"],
  ["ما شاءالله", "ما شاء الله"],
  ["بأذن الله", "بإذن الله"],
  ["بإذنالله", "بإذن الله"],

  // Common demonstratives
  ["هاذا", "هذا"],
  ["هاذة", "هذه"],
  ["هاذه", "هذه"],
  ["هاذي", "هذه"],
  ["هاذيك", "تلك"],
  ["هاذاك", "ذاك"],
  ["هاذولاء", "هؤلاء"],
  ["هاولاء", "هؤلاء"],
  ["لاكن", "لكن"],
  ["لاكنّ", "لكنّ"],
  ["لاكني", "لكنّي"],
  ["ذالك", "ذلك"],
  ["ذلكا", "ذلك"],

  // Common alif maksura confusion (ى vs ي) — تفصيلات الأفعال في
  // alif-maksura-dict.ts. هنا فقط التصحيحات البسيطة غير المتداخلة:
  ["الذيي", "الذي"],
  ["فى", "في"],
  // مستبعد لتجنّب تحوّل «أنّى» الاستفهاميّة (صحيحة بـى) إلى أني
  // ولتجنّب تحوّل «لدي» (عندي بضمير المتكلّم) إلى لديّ
  // ولتجنّب تحوّل علي (اسم علم) إلى على الجرّ
  // لو أردت تصحيحها، تغطّيها alif-maksura-dict بأنماط أدقّ

  // Hamza confusion at start — مستبعد الأنماط الغامضة التي تصلحهمزتين في
  // سياقات مختلفة (إنّه/أنّه، إنّها/أنّها، إنّك/أنّك، إنّي/أنّي):
  ["اذا", "إذا"],
  ["اذن", "إذن"],
  ["انا", "أنا"],
  ["انت", "أنت"],
  ["اكثر", "أكثر"],
  ["اقل", "أقل"],
  ["اكبر", "أكبر"],
  ["اصغر", "أصغر"],
  ["اخر", "آخر"],
  ["اوّل", "أوّل"],
  ["احد", "أحد"],
  ["امام", "أمام"],
  ["اخير", "أخير"],

  // Hamza on yaa (ئ)
  ["مسئول", "مسؤول"],
  ["مسأله", "مسألة"],
  ["مسالة", "مسألة"],
  ["شيئ", "شيء"],
  ["جزئ", "جزء"],
  ["جزىء", "جزء"],
  ["لان", "لأن"],
  ["لانه", "لأنه"],
  ["لانها", "لأنها"],

  // Hamza on waaw (ؤ)
  ["رؤيه", "رؤية"],
  ["روؤس", "رؤوس"],
  ["مؤامره", "مؤامرة"],

  // Common typo: alif at end — إضافة التنوين أسلوبيّة وليست خطأً إملائيّاً.
  // أبقينا فقط الأنماط التي تجمع تصحيح همزة + تنوين (أولويّة عالية):
  ["اهلا", "أهلاً"],
  ["اطلاقا", "إطلاقاً"],
  ["ابدا", "أبداً"],

  // Common verb hamza errors — أبقينا إصلاحات «إ» فقط (أفعال بحروف وصلٍ تأتي بـ«ا»).
  // مستبعد «أ» لأنّ صيغة المتكلّم (أستخدم، أنتظر، أكتشف، أختار، أنطلق)
  // صحيحة بهمزة القطع وستسبّب إيجابيّات خاطئة في حوارات الألعاب.
  ["إستخدم", "استخدم"],
  ["ابدا ", "ابدأ "],
  ["ابداً ", "ابدأ "],
  ["إنتظر", "انتظر"],
  ["إنتهى", "انتهى"],
  ["إكتشف", "اكتشف"],
  ["إختار", "اختار"],
  ["إنطلق", "انطلق"],

  // Common nouns hamza errors
  ["ابتسامه", "ابتسامة"],
  ["استراتيجيه", "استراتيجية"],
  ["استمراريه", "استمرارية"],
  ["إرشيف", "أرشيف"],
  ["ارشيف", "أرشيف"],
  ["ارجوك", "أرجوك"],
  ["إرجوك", "أرجوك"],
  // مستبعد «أسف / إسف» — الأول صيغة فعل («أحزن»)، والثاني ليس له
  // ورود فصيح واضح. التحويل إلى «آسف» ليس دائماً صحيحاً، فأبقينا فقط «اسف».
  ["اسف", "آسف"],

  // Wala/balaa confusion
  ["ولاكن", "ولكن"],
  ["وإلاكن", "ولكن"],
  ["الا", "إلا"],
];

const HAMZA_LOOKUP = (() => {
  const m = new Map<string, string>();
  for (const [w, r] of HAMZA_DICT) {
    if (w !== r) m.set(w.trim(), r);
  }
  return m;
})();

/**
 * Find hamza/spelling errors in text by matching whole-word tokens against the
 * dictionary. Returns the list of matches and a "fixed" version of the text.
 */
// Arabic letters range, used to allow optional prefix letters (ال, ب, ل, و, ف, ك, س, …)
// before a wrong-form lookup, so words like "النهايه" still match the entry "نهايه".
// We cap the prefix at 3 letters to limit ambiguity; common Arabic prefixes fit within that.
const PREFIX_RANGE = "\\u0621-\\u064A";
const BOUNDARY_CLASS = "\\s.,،؛:!؟?\\[\\](){}«»\"'";

export function findHamzaErrors(text: string): {
  matches: Array<{ wrong: string; right: string }>;
  fix: string;
} {
  const matches: Array<{ wrong: string; right: string }> = [];
  let fix = text;
  // Token-level replacement using boundary chars or string start/end.
  // We allow up to 3 Arabic prefix letters (lazy) to capture the common cases
  // ال / لل / ب / ل / و / ف / ك / س (and combinations) without breaking
  // unrelated longer words.
  const seen = new Set<string>();
  for (const [wrong, right] of HAMZA_DICT) {
    if (wrong === right) continue;
    const re = new RegExp(
      `(^|[${BOUNDARY_CLASS}])([${PREFIX_RANGE}]{0,3}?)${escapeRegExp(wrong)}(?=$|[${BOUNDARY_CLASS}])`,
      "gu",
    );
    if (re.test(fix)) {
      if (!seen.has(wrong)) {
        matches.push({ wrong, right });
        seen.add(wrong);
      }
      fix = fix.replace(re, `$1$2${right}`);
    }
  }
  return { matches, fix };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function lookupHamza(token: string): string | null {
  return HAMZA_LOOKUP.get(token.trim()) ?? null;
}
