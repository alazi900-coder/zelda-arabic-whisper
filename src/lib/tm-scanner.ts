// Translation Memory scanner. For each entry, look up the original in TM
// and flag if the translation differs from the stored one.

import type { LocalIssue } from "@/lib/local-enhance-scanner";
import { tmGet, type TMEntry } from "@/lib/tm-store";

export interface TMScanInput {
  key: string;
  original: string;
  translation: string;
}

const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

export async function scanWithTM(inputs: TMScanInput[]): Promise<LocalIssue[]> {
  const out: LocalIssue[] = [];
  for (const it of inputs) {
    const hit = (await tmGet(it.original)) as TMEntry | null;
    if (!hit) continue;
    if (norm(hit.translation) === norm(it.translation)) continue;
    out.push({
      key: it.key,
      original: it.original,
      translation: it.translation,
      suggestion: hit.translation,
      issue: "تباين مع ذاكرة الترجمة",
      reason:
        `هذه الجملة موجودة سابقاً في ذاكرتك بترجمة مختلفة:\n«${hit.translation}»\n` +
        `(محفوظة منذ ${new Date(hit.createdAt).toLocaleDateString("ar")} ومُؤكَّدة ${hit.count} مرّة). ` +
        `وحّد الترجمة لتطابق ما اعتمدتَه سابقاً.`,
      severity: "medium",
      type: "consistency",
      rule: "tm_mismatch",
    });
  }
  return out;
}

/** Approve the current translation for the entry — adds it to TM. */
export async function tmApprove(
  inputs: TMScanInput[],
  approveOriginal: (original: string, translation: string) => Promise<unknown>,
): Promise<number> {
  let n = 0;
  for (const it of inputs) {
    if (!it.original.trim() || !it.translation.trim()) continue;
    await approveOriginal(it.original, it.translation);
    n++;
  }
  return n;
}
