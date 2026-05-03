// Scanner pass that consults user-managed (custom) dictionaries on top of the
// built-in ones. Produces LocalIssue records using the same rule names so the
// UI doesn't need new categories — the rules just gain more coverage.

import type { LocalIssue } from "@/lib/local-enhance-scanner";
import type { CustomDicts, Pair, ProperNounEntry } from "@/lib/glossary-store";

const PREFIX_RANGE = "\\u0621-\\u064A";
const BOUNDARY_CLASS = "\\s.,،؛:!؟?\\[\\](){}«»\"'";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findPairMatches(text: string, pairs: ReadonlyArray<Pair>): {
  matches: Array<{ wrong: string; right: string }>;
  fix: string;
} {
  const matches: Array<{ wrong: string; right: string }> = [];
  let fix = text;
  const seen = new Set<string>();
  for (const [wrong, right] of pairs) {
    if (!wrong || wrong === right) continue;
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

function findGamingTerms(text: string, pairs: ReadonlyArray<Pair>): Array<{ en: string; ar: string }> {
  const out: Array<{ en: string; ar: string }> = [];
  const seen = new Set<string>();
  for (const [en, ar] of pairs) {
    if (!en || !ar) continue;
    const re = new RegExp(`\\b${escapeRegExp(en)}\\b`, "iu");
    if (re.test(text) && !seen.has(en.toLowerCase())) {
      out.push({ en, ar });
      seen.add(en.toLowerCase());
    }
  }
  return out;
}

function findProperNounsInOriginal(
  original: string,
  list: ReadonlyArray<ProperNounEntry>,
): ProperNounEntry[] {
  const out: ProperNounEntry[] = [];
  const seen = new Set<string>();
  for (const pn of list) {
    if (!pn.en) continue;
    const re = new RegExp(`\\b${escapeRegExp(pn.en)}\\b`, "iu");
    if (re.test(original) && !seen.has(pn.en.toLowerCase())) {
      out.push(pn);
      seen.add(pn.en.toLowerCase());
    }
  }
  return out;
}

const AR_RANGE = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const CATEGORY_LABEL: Record<string, string> = {
  character: "شخصية",
  place: "مكان",
  item: "غرض",
  race: "عرق",
  concept: "مفهوم",
  other: "آخر",
};

export interface CustomDictInput {
  key: string;
  original: string;
  translation: string;
}

export function scanWithCustomDicts(input: CustomDictInput, dicts: CustomDicts): LocalIssue[] {
  const { key, original, translation } = input;
  const issues: LocalIssue[] = [];
  if (!translation.trim()) return issues;

  // Custom hamza
  if (dicts.hamza.length > 0) {
    const r = findPairMatches(translation, dicts.hamza);
    if (r.matches.length > 0) {
      const sample = r.matches.slice(0, 3).map((m) => `«${m.wrong}» ← «${m.right}»`).join("، ");
      issues.push({
        key,
        original,
        translation,
        suggestion: r.fix,
        issue: `همزة (قاموسك) — ${r.matches.length}`,
        reason: `قواعد همزة من قاموسك المخصّص: ${sample}${r.matches.length > 3 ? "…" : ""}.`,
        severity: "medium",
        type: "missing_char",
        rule: "dict_hamza",
      });
    }
  }

  // Custom taa marbutah
  if (dicts.taMarbutah.length > 0) {
    const r = findPairMatches(translation, dicts.taMarbutah);
    if (r.matches.length > 0) {
      const sample = r.matches.slice(0, 3).map((m) => `«${m.wrong}» ← «${m.right}»`).join("، ");
      issues.push({
        key,
        original,
        translation,
        suggestion: r.fix,
        issue: `تاء مربوطة (قاموسك) — ${r.matches.length}`,
        reason: `قواعد تاء مربوطة من قاموسك المخصّص: ${sample}${r.matches.length > 3 ? "…" : ""}.`,
        severity: "medium",
        type: "missing_char",
        rule: "dict_ta_marbutah",
      });
    }
  }

  // Custom gaming glossary
  if (dicts.gaming.length > 0 && AR_RANGE.test(translation)) {
    const stranded = findGamingTerms(translation, dicts.gaming);
    if (stranded.length > 0) {
      const sample = stranded.slice(0, 3).map((s) => `«${s.en}» → «${s.ar}»`).join("، ");
      issues.push({
        key,
        original,
        translation,
        suggestion: translation,
        issue: `مصطلح من قاموسك (${stranded.length})`,
        reason: `هذي مصطلحات أضفتها بنفسك إلى قاموسك المخصّص: ${sample}${stranded.length > 3 ? "…" : ""}.`,
        severity: "medium",
        type: "terminology",
        rule: "dict_gaming_term",
      });
    }
  }

  // Custom proper nouns
  if (dicts.properNouns.length > 0) {
    const found = findProperNounsInOriginal(original, dicts.properNouns);
    for (const pn of found) {
      const englishPresent = new RegExp(`\\b${escapeRegExp(pn.en)}\\b`, "iu").test(translation);
      const arabicPresent = pn.ar.some((ar) => translation.includes(ar));
      if (!englishPresent && !arabicPresent) {
        issues.push({
          key,
          original,
          translation,
          suggestion: translation,
          issue: `اسم علم من قاموسك ضائع: «${pn.en}»`,
          reason: `النص الأصلي يذكر «${pn.en}» (${
            CATEGORY_LABEL[pn.category] ?? pn.category
          })، والترجمة لا تحتوي على أيّ من الصيغ المعتمدة في قاموسك (${pn.ar.join("، ")}).`,
          severity: "high",
          type: "accuracy",
          rule: "dict_proper_noun",
        });
      }
    }
  }

  return issues;
}

export function scanAllWithCustomDicts(
  inputs: CustomDictInput[],
  dicts: CustomDicts,
): LocalIssue[] {
  const out: LocalIssue[] = [];
  for (const input of inputs) {
    out.push(...scanWithCustomDicts(input, dicts));
  }
  return out;
}
