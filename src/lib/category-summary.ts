import { categorizeFile } from "@/components/editor/types";

export interface CategorySummary {
  total: number;
  withIssues: number;
}

/**
 * Build per-category summaries from a flat list of entries (with optional
 * issue keys). Each entry's category is derived from its key, treating the
 * portion before the colon as the file path.
 */
export function summarizeCategories(
  entries: Array<{ key: string; original?: string }>,
  keysWithIssues: ReadonlySet<string> = new Set(),
): Record<string, CategorySummary> {
  const out: Record<string, CategorySummary> = {};
  for (const e of entries) {
    const filePath = e.key.split(":")[0] ?? "";
    const cat = categorizeFile(filePath);
    if (!out[cat]) out[cat] = { total: 0, withIssues: 0 };
    out[cat].total += 1;
    if (keysWithIssues.has(e.key)) out[cat].withIssues += 1;
  }
  return out;
}

/** Categorize a single key the same way the UI groups them. */
export function categoryOfKey(key: string): string {
  const filePath = key.split(":")[0] ?? "";
  return categorizeFile(filePath);
}
