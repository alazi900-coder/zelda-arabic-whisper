import {
  scanAllLocally,
  isGrammarIssue,
  type LocalIssue,
  type LocalScanInput,
  type IssueSeverity,
  type IssueType,
} from "./local-enhance-scanner";

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
 * Phase 1 of the unified Quality Lab scanner: runs the existing 17-rule
 * structural scanner and aggregates the results. Dictionary-based detection
 * (hamza, taa marbutah, gaming glossary, proper nouns) lands in later PRs.
 */
export function scanUnified(inputs: UnifiedScanInput[]): UnifiedScanReport {
  const issues = scanAllLocally(inputs);

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
