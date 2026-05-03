// Dictionary-based scanner — leverages curated dictionaries to detect issues
// that pure regex rules cannot reliably catch. Returns LocalIssue records
// compatible with the existing local-enhance-scanner.

import type { LocalIssue } from "@/lib/local-enhance-scanner";
import { findHamzaErrors } from "@/data/quality-dicts/hamza-dict";
import { findTaMarbutahErrors } from "@/data/quality-dicts/ta-marbutah-dict";
import { findUntranslatedGamingTerms } from "@/data/quality-dicts/gaming-glossary";
import { findProperNounsInOriginal } from "@/data/quality-dicts/proper-nouns";
import { findAlifMaksuraErrors } from "@/data/quality-dicts/alif-maksura-dict";
import { findCommonTypos } from "@/data/quality-dicts/common-typos";

export interface DictScanInput {
  key: string;
  original: string;
  translation: string;
}

const AR_RANGE = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const DIGIT_RE = /\d+/g;

const CATEGORY_LABEL: Record<string, string> = {
  character: "شخصية",
  place: "مكان",
  item: "غرض",
  race: "عرق",
  concept: "مفهوم",
};

export function scanWithDictionaries(input: DictScanInput): LocalIssue[] {
  const { key, original, translation } = input;
  const issues: LocalIssue[] = [];

  if (!translation.trim()) return issues;

  // 1. Hamza / common spelling errors
  const hamza = findHamzaErrors(translation);
  if (hamza.matches.length > 0) {
    const sample = hamza.matches
      .slice(0, 3)
      .map((m) => `«${m.wrong}» ← «${m.right}»`)
      .join("، ");
    issues.push({
      key,
      original,
      translation,
      suggestion: hamza.fix,
      issue: `أخطاء همزة/إملاء (${hamza.matches.length})`,
      reason: `رُصدت ${hamza.matches.length} كلمة بإملاء شائع خاطئ: ${sample}${
        hamza.matches.length > 3 ? "…" : ""
      }. هذه أخطاء معروفة وموثّقة في القاموس، والإصلاح آمن للتطبيق.`,
      severity: "medium",
      type: "missing_char",
      rule: "dict_hamza",
    });
  }

  // 2a. Alif-maksura confusions (ى vs ي)
  const alif = findAlifMaksuraErrors(translation);
  if (alif.matches.length > 0) {
    const sample = alif.matches
      .slice(0, 3)
      .map((m) => `«${m.wrong}» ← «${m.right}»`)
      .join("، ");
    issues.push({
      key,
      original,
      translation,
      suggestion: alif.fix,
      issue: `خلط بين الألف المقصورة والياء (${alif.matches.length})`,
      reason: `رُصدت ${alif.matches.length} كلمة كُتبت بـي بدل الألف المقصورة ـى: ${sample}${
        alif.matches.length > 3 ? "…" : ""
      }. القاعدة: إن تلا الحرف ضميرٌ أو إضافةٌ فهو ياء، وإلاّ فهو ألفٌ مقصورة.`,
      severity: "medium",
      type: "missing_char",
      rule: "dict_alif_maksura",
    });
  }

  // 2b. Common typos (lakin/inshallah/etc.)
  const typos = findCommonTypos(translation);
  if (typos.matches.length > 0) {
    const sample = typos.matches
      .slice(0, 3)
      .map((m) => `«${m.wrong}» ← «${m.right}»`)
      .join("، ");
    issues.push({
      key,
      original,
      translation,
      suggestion: typos.fix,
      issue: `أخطاء إملائيّة شائعة (${typos.matches.length})`,
      reason: `أخطاء معروفة في الترجمات العربية، مثل: ${sample}${
        typos.matches.length > 3 ? "…" : ""
      }. الإصلاح آمن للتطبيق الجماعي.`,
      severity: "medium",
      type: "missing_char",
      rule: "dict_common_typo",
    });
  }

  // 2. Taa marbutah / haa terminal confusion
  const ta = findTaMarbutahErrors(translation);
  if (ta.matches.length > 0) {
    const sample = ta.matches
      .slice(0, 3)
      .map((m) => `«${m.wrong}» ← «${m.right}»`)
      .join("، ");
    issues.push({
      key,
      original,
      translation,
      suggestion: ta.fix,
      issue: `تاء مربوطة خاطئة (${ta.matches.length})`,
      reason: `كلمات مؤنّثة كُتبت بـ ﻫ بدل ﺔ: ${sample}${
        ta.matches.length > 3 ? "…" : ""
      }. القاعدة: الاسم المؤنّث ينتهي بتاء مربوطة (ﺔ)، ومن دونها قد ينقلب المعنى أو يصبح خطأً إملائياً.`,
      severity: "medium",
      type: "missing_char",
      rule: "dict_ta_marbutah",
    });
  }

  // 3. Untranslated gaming terms — English words inside an Arabic translation
  //    that have known Arabic equivalents in the gaming glossary.
  const hasArabic = AR_RANGE.test(translation);
  if (hasArabic) {
    const stranded = findUntranslatedGamingTerms(translation);
    if (stranded.length > 0) {
      const sample = stranded
        .slice(0, 3)
        .map((s) => `«${s.en}» → «${s.ar}»`)
        .join("، ");
      issues.push({
        key,
        original,
        translation,
        suggestion: translation,
        issue: `مصطلحات إنجليزية في القاموس (${stranded.length})`,
        reason: `هذه المصطلحات لها مقابل عربي معتمد في قاموس الألعاب: ${sample}${
          stranded.length > 3 ? "…" : ""
        }. ترجمتها يُحسّن اتساق الأداة.`,
        severity: "medium",
        type: "terminology",
        rule: "dict_gaming_term",
      });
    }
  }

  // 4. Proper nouns: if the original mentions a known proper noun, the
  //    translation should contain one of its accepted Arabic renderings, or
  //    keep the English form. Flag only when neither is found.
  const properNouns = findProperNounsInOriginal(original);
  for (const pn of properNouns) {
    const englishPresent = new RegExp(
      `\\b${pn.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "iu",
    ).test(translation);
    const arabicPresent = pn.acceptable.some((ar) => translation.includes(ar));
    if (!englishPresent && !arabicPresent) {
      issues.push({
        key,
        original,
        translation,
        suggestion: translation,
        issue: `اسم علم محتمل ضائع: «${pn.en}»`,
        reason: `النص الأصلي يذكر «${pn.en}» (${
          CATEGORY_LABEL[pn.category] ?? pn.category
        })، والترجمة لا تحتوي على هذا الاسم بأيّ من الصيغ المعتمدة (${pn.acceptable.join(
          "، ",
        )}). تأكّد أن الاسم لم يُحذف بالخطأ.`,
        severity: "high",
        type: "accuracy",
        rule: "dict_proper_noun",
      });
    }
  }

  // 5. Number consistency between original and translation.
  const origDigits = (original.match(DIGIT_RE) || []).map((s) =>
    s.replace(/^0+(\d)/, "$1"),
  );
  const transDigits = (translation.match(DIGIT_RE) || []).map((s) =>
    s.replace(/^0+(\d)/, "$1"),
  );
  if (
    origDigits.length > 0 &&
    origDigits.slice().sort().join(",") !== transDigits.slice().sort().join(",")
  ) {
    issues.push({
      key,
      original,
      translation,
      suggestion: translation,
      issue: "الأرقام لا تطابق الأصل",
      reason: `النص الأصلي يحوي [${origDigits.join("، ")}] والترجمة تحوي [${
        transDigits.join("، ") || "—"
      }]. الأرقام عادةً تُعرض ديناميكياً من اللعبة، فأي اختلاف هنا قد يُعطي معلومة غلط للّاعب.`,
      severity: "high",
      type: "accuracy",
      rule: "digit_mismatch",
    });
  }

  return issues;
}

export function scanAllWithDictionaries(inputs: DictScanInput[]): LocalIssue[] {
  const out: LocalIssue[] = [];
  for (const input of inputs) {
    out.push(...scanWithDictionaries(input));
  }
  return out;
}
