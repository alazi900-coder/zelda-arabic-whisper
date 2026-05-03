// Common alif-maksura (ى) ↔ yaa (ي) confusions and missing alif endings.
// Each pair is (wrong → right). Both sides MUST differ; entries that match
// the right form are skipped at scan time.
//
// Detection is whole-word. False positives are minimized by relying on the
// hamza dictionary having corrected obvious cases first.

export const ALIF_MAKSURA_DICT: ReadonlyArray<readonly [wrong: string, right: string]> = [
  ["الذى", "الذي"],
  ["التى", "التي"],
  ["إلي", "إلى"],
  ["ألي", "إلى"],
  ["علي", "على"],
  ["حتي", "حتى"],
  ["لدي", "لدى"],
  ["متي", "متى"],
  ["هدي", "هدى"],
  ["انتهي", "انتهى"],
  ["تحدي", "تحدّى"],
  ["تجلي", "تجلّى"],
  ["تخطي", "تخطّى"],
  ["تنحي", "تنحّى"],
  ["تولي", "تولّى"],
  ["تمني", "تمنّى"],
  ["تسلي", "تسلّى"],
  ["تبني", "تبنّى"],
  ["استعطي", "استعطى"],
  ["استلقي", "استلقى"],
  // أفعل/فعلى patterns
  ["العلي", "العلى"],
  ["الادني", "الأدنى"],
  ["الأدني", "الأدنى"],
  ["الاعلي", "الأعلى"],
  ["الأعلي", "الأعلى"],
  ["المثلي", "المثلى"],
  ["الكبري", "الكبرى"],
  ["الصغري", "الصغرى"],
  ["السفلي", "السفلى"],
  ["الوسطي", "الوسطى"],
  ["الاولي", "الأولى"],
  ["الأولي", "الأولى"],
  ["الاخري", "الأخرى"],
  ["الأخري", "الأخرى"],
  // أفعال آخرها ـى
  ["مضي", "مضى"],
  ["بكي", "بكى"],
  ["شكي", "شكى"],
  ["نهي", "نهى"],
  ["رمي", "رمى"],
  ["جري", "جرى"],
  ["مشي", "مشى"],
  ["سعي", "سعى"],
  ["انجلي", "انجلى"],
  ["انقضي", "انقضى"],
  // أسماء
  ["ذكري", "ذكرى"],
  ["أنثي", "أنثى"],
  ["انثي", "أنثى"],
  ["سلوي", "سلوى"],
  ["نجوي", "نجوى"],
  ["شوري", "شورى"],
  ["تقوي", "تقوى"],
  ["موسي", "موسى"],
  ["عيسي", "عيسى"],
  ["يحيي", "يحيى"],
  ["مرتضي", "مرتضى"],
  ["مصطفي", "مصطفى"],
  ["مدي", "مدى"],
  ["سدي", "سدى"],
  ["هوي", "هوى"],
  ["كفي", "كفى"],
  ["انتقي", "انتقى"],
  ["ارتقي", "ارتقى"],
  ["استعصي", "استعصى"],
];

const PREFIX_RANGE = "\\u0621-\\u064A";
const BOUNDARY_CLASS = "\\s.,،؛:!؟?\\[\\](){}«»\"'";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findAlifMaksuraErrors(text: string): {
  matches: Array<{ wrong: string; right: string }>;
  fix: string;
} {
  const matches: Array<{ wrong: string; right: string }> = [];
  let fix = text;
  const seen = new Set<string>();
  for (const [wrong, right] of ALIF_MAKSURA_DICT) {
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

