// Most common Arabic spelling typos seen in fan/community translations.
// (wrong → right). Whole-word match. False positives are very low because
// the wrong forms here are unambiguously misspellings.

export const COMMON_TYPOS_DICT: ReadonlyArray<readonly [wrong: string, right: string]> = [
  // Particles / connectives
  ["لاكن", "لكن"],
  ["لاكنه", "لكنه"],
  ["لاكنها", "لكنها"],
  ["لاكنني", "لكنني"],
  ["لاكنك", "لكنك"],
  ["إلاء", "إلا"],
  ["إنشاء الله", "إن شاء الله"],
  ["إنشاالله", "إن شاء الله"],
  ["انشاالله", "إن شاء الله"],
  ["انشاءالله", "إن شاء الله"],
  ["مشاالله", "ما شاء الله"],
  ["ماشاءالله", "ما شاء الله"],
  ["جزاكالله", "جزاك الله"],
  // Verbs / conjugations
  ["استعمل", "استعمل"], // intentional skip if identical
  ["اخذت", "أخذت"],
  ["اخذتها", "أخذتها"],
  ["اعطاني", "أعطاني"],
  ["اعطيتك", "أعطيتك"],
  ["اعتقد", "أعتقد"],
  ["اظن", "أظن"],
  ["اعرف", "أعرف"],
  ["اشعر", "أشعر"],
  ["اريد", "أريد"],
  ["استطيع", "أستطيع"],
  ["استمر", "استمر"], // skip
  // Common words misspelled
  ["مساءاً", "مساءً"],
  ["صباحاً جميلاً", "صباحاً جميلاً"], // skip
  ["تاءخر", "تأخر"],
  ["ساءلني", "سألني"],
  ["سءال", "سؤال"],
  ["مسءول", "مسؤول"],
  ["مسءولية", "مسؤولية"],
  ["متفاءل", "متفائل"],
  ["متشاءم", "متشائم"],
  ["دائرئ", "دائري"],
  ["نهاءى", "نهائي"],
  ["فاءدة", "فائدة"],
  ["جاءز", "جائز"],
  ["جاءزة", "جائزة"],
  ["شاءب", "شائب"],
  ["شاءع", "شائع"],
  ["زاءد", "زائد"],
  ["زاءر", "زائر"],
  // Common compound mistakes
  ["كثيرا ما", "كثيراً ما"],
  ["لاول مرة", "لأول مرة"],
  ["انضماما", "انضماماً"],
  // Final hamza on alef
  ["جزء", "جزء"], // skip — already correct
  ["دفء", "دفء"], // skip
  ["ضوء", "ضوء"], // skip
  // Common technical terms (gaming)
  ["الاسلحة", "الأسلحة"],
  ["الاطفال", "الأطفال"],
  ["الاسماء", "الأسماء"],
  ["الادوات", "الأدوات"],
  ["الازياء", "الأزياء"],
  ["الافعال", "الأفعال"],
  ["الاصول", "الأصول"],
  ["الاحجار", "الأحجار"],
  ["الاهداف", "الأهداف"],
  ["الاحرف", "الأحرف"],
  ["الانماط", "الأنماط"],
  ["الانواع", "الأنواع"],
  ["الاوامر", "الأوامر"],
  ["الاحداث", "الأحداث"],
  ["الاشخاص", "الأشخاص"],
  ["الاماكن", "الأماكن"],
  ["الاعداء", "الأعداء"],
  ["الابطال", "الأبطال"],
  ["الاوقات", "الأوقات"],
  ["الاجزاء", "الأجزاء"],
  ["الالوان", "الألوان"],
  ["الاصوات", "الأصوات"],
  ["الاجهزة", "الأجهزة"],
  ["الالعاب", "الألعاب"],
  ["الاعمال", "الأعمال"],
  ["الاحوال", "الأحوال"],
  // Verb starts
  ["استرد", "استرد"], // skip
  ["اضرب", "اضرب"], // skip
  ["اقبل", "اقبل"], // skip
  ["اقرأ", "اقرأ"], // skip
  ["اكتشف", "اكتشف"], // skip
  // Common mistranslations / colloquialisms
  ["شكر لك", "شكراً لك"],
  ["شكر", "شكراً"],
  ["مرحبا", "مرحباً"],
  ["اهلا", "أهلاً"],
  ["اهلا وسهلا", "أهلاً وسهلاً"],
  ["وداعا", "وداعاً"],
  ["وداع", "وداعاً"],
  ["عفوا", "عفواً"],
  ["معذرة", "المعذرة"],
  ["لاحقا", "لاحقاً"],
  ["مبكرا", "مبكراً"],
  ["متأخرا", "متأخراً"],
  ["دائما", "دائماً"],
  ["احيانا", "أحياناً"],
  ["تماما", "تماماً"],
  ["جدا", "جداً"],
  ["ابدا", "أبداً"],
  ["معا", "معاً"],
  ["نهائيا", "نهائياً"],
  ["تقريبا", "تقريباً"],
  ["شيئا", "شيئاً"],
  ["مرة اخرى", "مرة أخرى"],
  ["مرة ثانية", "مرة ثانية"], // skip
  ["مرة اولى", "مرة أولى"],
  // Tatweel inside words (will be detected by separate rule, but
  // include common forms for explicit fix)
  ["مــرحــبــا", "مرحباً"],
  ["شــكــرا", "شكراً"],
];

const PREFIX_RANGE = "\\u0621-\\u064A";
const BOUNDARY_CLASS = "\\s.,،؛:!؟?\\[\\](){}«»\"'";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findCommonTypos(text: string): {
  matches: Array<{ wrong: string; right: string }>;
  fix: string;
} {
  const matches: Array<{ wrong: string; right: string }> = [];
  let fix = text;
  const seen = new Set<string>();
  for (const [wrong, right] of COMMON_TYPOS_DICT) {
    if (wrong === right) continue;
    const isMulti = /\s/.test(wrong);
    const pattern = isMulti
      ? escapeRegExp(wrong)
      : `(^|[${BOUNDARY_CLASS}])([${PREFIX_RANGE}]{0,3}?)${escapeRegExp(wrong)}(?=$|[${BOUNDARY_CLASS}])`;
    const re = new RegExp(pattern, "gu");
    if (re.test(fix)) {
      if (!seen.has(wrong)) {
        matches.push({ wrong, right });
        seen.add(wrong);
      }
      fix = isMulti ? fix.replace(re, right) : fix.replace(re, `$1$2${right}`);
    }
  }
  return { matches, fix };
}
