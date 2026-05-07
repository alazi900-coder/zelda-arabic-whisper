import { describe, it, expect } from "vitest";

// ─── Types mirroring TranslationAIEnhancePanel ───────────────────────────
type GrammarCategory = "wrong" | "reorder" | "weak";
type IssueSeverity = "high" | "medium" | "low";

interface GrammarIssue {
  key: string;
  original: string;
  translation: string;
  suggestion: string;
  issue: string;
  category?: GrammarCategory;
  severity?: IssueSeverity;
}

// ─── Pure logic extracted from enhance-translations edge function ─────────
/**
 * Validates and normalises the category returned by the AI model.
 * Invalid values default to "wrong" (the most cautious label).
 * See supabase/functions/enhance-translations/index.ts line 143.
 */
function normaliseCategory(raw: string | undefined | null): GrammarCategory {
  const valid: GrammarCategory[] = ["wrong", "reorder", "weak"];
  if (raw && valid.includes(raw as GrammarCategory)) return raw as GrammarCategory;
  return "wrong";
}

// ─── Pure logic extracted from TranslationAIEnhancePanel ─────────────────
const catOrder: Record<string, number> = { wrong: 0, reorder: 1, weak: 2 };
const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * Filter grammar issues by severity and/or category.
 * Mirrors the `filteredIssues` useMemo in TranslationAIEnhancePanel.tsx line 645-660.
 */
function filterIssues(
  issues: GrammarIssue[],
  severityFilter: IssueSeverity | null,
  categoryFilter: GrammarCategory | null,
  searchQuery: string,
): GrammarIssue[] {
  return issues.filter(g => {
    if (severityFilter && g.severity !== severityFilter) return false;
    if (categoryFilter && (g.category ?? "wrong") !== categoryFilter) return false;
    if (
      searchQuery &&
      !`${g.key} ${g.original} ${g.translation} ${g.suggestion} ${g.issue}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });
}

/**
 * Sort grammar issues: first by category (wrong → reorder → weak),
 * then by severity (high → medium → low) within each category.
 * Mirrors TranslationAIEnhancePanel.tsx line 654-658.
 */
function sortIssues(issues: GrammarIssue[]): GrammarIssue[] {
  return [...issues].sort((a, b) => {
    const ca = catOrder[a.category ?? "wrong"] ?? 0;
    const cb = catOrder[b.category ?? "wrong"] ?? 0;
    if (ca !== cb) return ca - cb;
    return (severityOrder[a.severity ?? "low"] ?? 2) - (severityOrder[b.severity ?? "low"] ?? 2);
  });
}

// ─── Test fixtures ───────────────────────────────────────────────────────
function makeIssue(
  overrides: Partial<GrammarIssue> & { category?: GrammarCategory; severity?: IssueSeverity },
): GrammarIssue {
  return {
    key: "file.msbt:0",
    original: "Hello",
    translation: "مرحبا",
    suggestion: "أهلاً",
    issue: "ترجمة ركيكة",
    ...overrides,
  };
}

// =====================================================================
// 1. Category normalisation (edge function logic)
// =====================================================================
describe("normaliseCategory — edge function category validation", () => {
  it('returns "wrong" for a valid "wrong" input', () => {
    expect(normaliseCategory("wrong")).toBe("wrong");
  });

  it('returns "reorder" for a valid "reorder" input', () => {
    expect(normaliseCategory("reorder")).toBe("reorder");
  });

  it('returns "weak" for a valid "weak" input', () => {
    expect(normaliseCategory("weak")).toBe("weak");
  });

  it('defaults to "wrong" for undefined', () => {
    expect(normaliseCategory(undefined)).toBe("wrong");
  });

  it('defaults to "wrong" for null', () => {
    expect(normaliseCategory(null)).toBe("wrong");
  });

  it('defaults to "wrong" for empty string', () => {
    expect(normaliseCategory("")).toBe("wrong");
  });

  it('defaults to "wrong" for an unknown value', () => {
    expect(normaliseCategory("typo")).toBe("wrong");
    expect(normaliseCategory("bad")).toBe("wrong");
    expect(normaliseCategory("WRONG")).toBe("wrong"); // case-sensitive
  });
});

// =====================================================================
// 2. Filtering by category
// =====================================================================
describe("filterIssues — category filter", () => {
  const issues: GrammarIssue[] = [
    makeIssue({ key: "a:0", category: "wrong", severity: "high", issue: "خطأ فادح" }),
    makeIssue({ key: "a:1", category: "reorder", severity: "medium", issue: "ترتيب خاطئ" }),
    makeIssue({ key: "a:2", category: "weak", severity: "low", issue: "ركيكة" }),
    makeIssue({ key: "a:3", category: "wrong", severity: "medium", issue: "كلمة ناقصة" }),
    makeIssue({ key: "a:4", category: "weak", severity: "high", issue: "صياغة سيئة" }),
  ];

  it("returns all when no filter is set", () => {
    const result = filterIssues(issues, null, null, "");
    expect(result).toHaveLength(5);
  });

  it('filters to only "wrong" issues', () => {
    const result = filterIssues(issues, null, "wrong", "");
    expect(result).toHaveLength(2);
    expect(result.every(r => r.category === "wrong")).toBe(true);
  });

  it('filters to only "reorder" issues', () => {
    const result = filterIssues(issues, null, "reorder", "");
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("a:1");
  });

  it('filters to only "weak" issues', () => {
    const result = filterIssues(issues, null, "weak", "");
    expect(result).toHaveLength(2);
    expect(result.every(r => r.category === "weak")).toBe(true);
  });

  it('treats missing category as "wrong"', () => {
    const withMissing = [
      makeIssue({ key: "b:0", severity: "high" }), // no category → "wrong"
      makeIssue({ key: "b:1", category: "weak", severity: "low" }),
    ];
    const result = filterIssues(withMissing, null, "wrong", "");
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("b:0");
  });
});

// =====================================================================
// 3. Filtering by severity
// =====================================================================
describe("filterIssues — severity filter", () => {
  const issues: GrammarIssue[] = [
    makeIssue({ key: "s:0", category: "wrong", severity: "high" }),
    makeIssue({ key: "s:1", category: "reorder", severity: "medium" }),
    makeIssue({ key: "s:2", category: "weak", severity: "low" }),
    makeIssue({ key: "s:3", category: "wrong", severity: "low" }),
  ];

  it('filters to only "high" severity', () => {
    const result = filterIssues(issues, "high", null, "");
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("s:0");
  });

  it('filters to only "medium" severity', () => {
    const result = filterIssues(issues, "medium", null, "");
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("s:1");
  });

  it('filters to only "low" severity', () => {
    const result = filterIssues(issues, "low", null, "");
    expect(result).toHaveLength(2);
  });
});

// =====================================================================
// 4. Combined filter: category + severity
// =====================================================================
describe("filterIssues — combined category + severity", () => {
  const issues: GrammarIssue[] = [
    makeIssue({ key: "c:0", category: "wrong", severity: "high" }),
    makeIssue({ key: "c:1", category: "wrong", severity: "low" }),
    makeIssue({ key: "c:2", category: "weak", severity: "high" }),
    makeIssue({ key: "c:3", category: "reorder", severity: "medium" }),
  ];

  it('returns only wrong+high when both filters are set', () => {
    const result = filterIssues(issues, "high", "wrong", "");
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("c:0");
  });

  it("returns empty when no issue matches both filters", () => {
    const result = filterIssues(issues, "low", "reorder", "");
    expect(result).toHaveLength(0);
  });
});

// =====================================================================
// 5. Search query filter
// =====================================================================
describe("filterIssues — search query", () => {
  const issues: GrammarIssue[] = [
    makeIssue({ key: "q:0", original: "Sword", issue: "ترجمة خاطئة" }),
    makeIssue({ key: "q:1", original: "Shield", issue: "ترتيب خاطئ" }),
    makeIssue({ key: "q:2", original: "Bow", issue: "ركيكة جداً" }),
  ];

  it("filters by original text", () => {
    const result = filterIssues(issues, null, null, "Sword");
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("q:0");
  });

  it("filters by issue text (Arabic)", () => {
    const result = filterIssues(issues, null, null, "ركيكة");
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("q:2");
  });

  it("is case-insensitive", () => {
    const result = filterIssues(issues, null, null, "sword");
    expect(result).toHaveLength(1);
  });
});

// =====================================================================
// 6. Sorting: category order (wrong → reorder → weak)
// =====================================================================
describe("sortIssues — category ordering", () => {
  it("sorts wrong before reorder before weak", () => {
    const issues = [
      makeIssue({ key: "w:0", category: "weak", severity: "high" }),
      makeIssue({ key: "r:0", category: "reorder", severity: "high" }),
      makeIssue({ key: "x:0", category: "wrong", severity: "high" }),
    ];
    const sorted = sortIssues(issues);
    expect(sorted.map(s => s.category)).toEqual(["wrong", "reorder", "weak"]);
  });

  it("groups same categories together even when interleaved", () => {
    const issues = [
      makeIssue({ key: "1", category: "weak" }),
      makeIssue({ key: "2", category: "wrong" }),
      makeIssue({ key: "3", category: "weak" }),
      makeIssue({ key: "4", category: "reorder" }),
      makeIssue({ key: "5", category: "wrong" }),
    ];
    const sorted = sortIssues(issues);
    const cats = sorted.map(s => s.category);
    // All wrong first, then reorder, then weak
    expect(cats).toEqual(["wrong", "wrong", "reorder", "weak", "weak"]);
  });
});

// =====================================================================
// 7. Sorting: severity within same category (high → medium → low)
// =====================================================================
describe("sortIssues — severity within category", () => {
  it("sorts high before medium before low within the same category", () => {
    const issues = [
      makeIssue({ key: "1", category: "wrong", severity: "low" }),
      makeIssue({ key: "2", category: "wrong", severity: "high" }),
      makeIssue({ key: "3", category: "wrong", severity: "medium" }),
    ];
    const sorted = sortIssues(issues);
    expect(sorted.map(s => s.severity)).toEqual(["high", "medium", "low"]);
  });

  it("treats missing severity as low", () => {
    const issues = [
      makeIssue({ key: "1", category: "wrong", severity: undefined }),
      makeIssue({ key: "2", category: "wrong", severity: "high" }),
    ];
    const sorted = sortIssues(issues);
    expect(sorted[0].severity).toBe("high");
  });
});

// =====================================================================
// 8. Sorting: combined category + severity (full ordering)
// =====================================================================
describe("sortIssues — full combined ordering", () => {
  it("applies category-first then severity-second ordering", () => {
    const issues = [
      makeIssue({ key: "1", category: "weak", severity: "high" }),
      makeIssue({ key: "2", category: "wrong", severity: "low" }),
      makeIssue({ key: "3", category: "reorder", severity: "medium" }),
      makeIssue({ key: "4", category: "wrong", severity: "high" }),
      makeIssue({ key: "5", category: "weak", severity: "low" }),
      makeIssue({ key: "6", category: "reorder", severity: "high" }),
    ];
    const sorted = sortIssues(issues);
    // wrong(high) → wrong(low) → reorder(high) → reorder(medium) → weak(high) → weak(low)
    expect(sorted.map(s => s.key)).toEqual(["4", "2", "6", "3", "1", "5"]);
  });

  it("preserves relative order for equal category+severity (stable sort)", () => {
    const issues = [
      makeIssue({ key: "a", category: "wrong", severity: "high" }),
      makeIssue({ key: "b", category: "wrong", severity: "high" }),
      makeIssue({ key: "c", category: "wrong", severity: "high" }),
    ];
    const sorted = sortIssues(issues);
    expect(sorted.map(s => s.key)).toEqual(["a", "b", "c"]);
  });
});

// =====================================================================
// 9. Edge cases
// =====================================================================
describe("filter + sort — edge cases", () => {
  it("handles empty input", () => {
    expect(filterIssues([], null, null, "")).toEqual([]);
    expect(sortIssues([])).toEqual([]);
  });

  it("handles single item", () => {
    const single = [makeIssue({ key: "x", category: "reorder", severity: "medium" })];
    expect(filterIssues(single, null, null, "")).toHaveLength(1);
    expect(sortIssues(single)).toHaveLength(1);
  });

  it("filter then sort produces correct result", () => {
    const issues = [
      makeIssue({ key: "1", category: "wrong", severity: "low" }),
      makeIssue({ key: "2", category: "wrong", severity: "high" }),
      makeIssue({ key: "3", category: "reorder", severity: "high" }),
      makeIssue({ key: "4", category: "weak", severity: "medium" }),
    ];
    // Filter to "wrong" only, then sort
    const filtered = filterIssues(issues, null, "wrong", "");
    const sorted = sortIssues(filtered);
    expect(sorted).toHaveLength(2);
    expect(sorted[0].key).toBe("2"); // high first
    expect(sorted[1].key).toBe("1"); // low second
  });
});
