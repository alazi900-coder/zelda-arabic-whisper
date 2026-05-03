// Dictionary-based scanner — leverages curated dictionaries to detect issues
// that pure regex rules cannot reliably catch. Returns LocalIssue records
// compatible with the existing local-enhance-scanner.
//
// PR4 introduces hamza and taa-marbutah dictionaries. Gaming glossary,
// proper nouns, and digit consistency land in PR5.

import type { LocalIssue } from "@/lib/local-enhance-scanner";
import { findHamzaErrors } from "@/data/quality-dicts/hamza-dict";
import { findTaMarbutahErrors } from "@/data/quality-dicts/ta-marbutah-dict";

export interface DictScanInput {
  key: string;
  original: string;
  translation: string;
}

export function scanWithDictionaries(input: DictScanInput): LocalIssue[] {
  const { key, original, translation } = input;
  const issues: LocalIssue[] = [];

  // Skip empty translations — they're flagged elsewhere.
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

  return issues;
}

export function scanAllWithDictionaries(inputs: DictScanInput[]): LocalIssue[] {
  const out: LocalIssue[] = [];
  for (const input of inputs) {
    out.push(...scanWithDictionaries(input));
  }
  return out;
}
