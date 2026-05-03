import {
  scanAllLocally,
  isGrammarIssue,
  type LocalIssue,
  type LocalScanInput,
  type IssueSeverity,
  type IssueType,
} from "./local-enhance-scanner";
import { scanAllWithDictionaries, type DictScanInput } from "./dict-scanner";

export type { LocalIssue, LocalScanInput, IssueSeverity, IssueType };
export { isGrammarIssue };

export interface UnifiedScanInput {
  key: string;
  original: string;
  translation: string;
  maxBytes?: number;
}

export interface UnifiedScanReport {
  issues: LocalIssue[];
  bySeverity: Record<IssueSeverity, number>;
  byRule: Record<string, number>;
  byType: Record<string, number>;
  affectedEntries: number;
  totalScanned: number;
  total: number;
}

/**
 * Unified Quality Lab scanner. Combines:
 *  1. The structural 17-rule scanner from local-enhance-scanner.
 *  2. Dictionary-based detection (hamza, taa marbutah — PR4; more later).
 *
 * Issues are deduplicated by (key | rule | issue label).
 */
export function scanUnified(inputs: UnifiedScanInput[]): UnifiedScanReport {
  const ruleIssues = scanAllLocally(inputs);
  const dictInputs: DictScanInput[] = inputs.map(({ key, original, translation }) => ({
    key,
    original,
    translation,
  }));
  const dictIssues = scanAllWithDictionaries(dictInputs);

  const seen = new Set<string>();
  const issues: LocalIssue[] = [];
  for (const it of [...ruleIssues, ...dictIssues]) {
    const sig = `${it.key}|${it.rule}|${it.issue}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    issues.push(it);
  }

  const bySeverity: Record<IssueSeverity, number> = { high: 0, medium: 0, low: 0 };
  const byRule: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const affected = new Set<string>();

  for (const it of issues) {
    bySeverity[it.severity] = (bySeverity[it.severity] ?? 0) + 1;
    byRule[it.rule] = (byRule[it.rule] ?? 0) + 1;
    byType[it.type] = (byType[it.type] ?? 0) + 1;
    affected.add(it.key);
  }

  return {
    issues,
    bySeverity,
    byRule,
    byType,
    affectedEntries: affected.size,
    totalScanned: inputs.length,
    total: issues.length,
  };
}
