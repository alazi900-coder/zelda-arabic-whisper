import type { LocalIssue } from "./local-enhance-scanner";

/**
 * Strip the longest shared prefix and suffix from `(a, b)` and return the
 * remaining differing window. This produces the *minimal* substitution
 * pair, which is stable across different surrounding contexts and is the
 * right granularity for grouping issues that share a user-intent pattern
 * (e.g. every "لاكن→لكن" fix should land in the same bucket regardless
 * of the rest of the sentence).
 */
function minimalDiff(
  a: string,
  b: string,
): { wrong: string; right: string } | null {
  if (a === b) return null;
  let pre = 0;
  const minLen = Math.min(a.length, b.length);
  while (pre < minLen && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (
    suf < a.length - pre &&
    suf < b.length - pre &&
    a[a.length - 1 - suf] === b[b.length - 1 - suf]
  ) {
    suf++;
  }
  return {
    wrong: a.slice(pre, a.length - suf),
    right: b.slice(pre, b.length - suf),
  };
}

/**
 * Derive a *context-anchored* substitution: starts from the minimal diff
 * and expands the window outward in `a` until `wrong` appears at exactly
 * one position. This is what we need for *applying* a patch to a running
 * text where the minimal-diff `wrong` might be ambiguous (e.g. a single
 * letter that recurs many times).
 */
function anchoredPatch(
  a: string,
  b: string,
): { wrong: string; right: string } | null {
  if (a === b) return null;
  let pre = 0;
  const minLen = Math.min(a.length, b.length);
  while (pre < minLen && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (
    suf < a.length - pre &&
    suf < b.length - pre &&
    a[a.length - 1 - suf] === b[b.length - 1 - suf]
  ) {
    suf++;
  }
  let aStart = pre;
  let aEnd = a.length - suf;
  let bStart = pre;
  let bEnd = b.length - suf;
  while (true) {
    const wrong = a.slice(aStart, aEnd);
    if (wrong.length > 0 && a.indexOf(wrong) === a.lastIndexOf(wrong)) break;
    if (aStart > 0) {
      aStart--;
      bStart--;
      continue;
    }
    if (aEnd < a.length) {
      aEnd++;
      bEnd++;
      continue;
    }
    return null;
  }
  return {
    wrong: a.slice(aStart, aEnd),
    right: b.slice(bStart, bEnd),
  };
}

export interface BulkPatternGroup {
  /** Stable id: rule + "|" + minimal-diff wrong + "|" + minimal-diff right. */
  id: string;
  rule: string;
  /**
   * Minimal-diff substring that will be replaced. Stable across entries so
   * identical user-intent patterns share a single bucket. Always non-empty.
   */
  wrong: string;
  /** Minimal-diff replacement substring. May be empty for pure deletions. */
  right: string;
  /** Total occurrences across all entries (one per source issue). */
  count: number;
  /** Highest severity that appeared with this pattern (used only for sort). */
  topSeverity: "high" | "medium" | "low";
  /**
   * Per-entry payload. Each entry carries a context-anchored substitution
   * derived from that entry's own translation, so applying the group on
   * one entry doesn't accidentally hit a different occurrence of the
   * minimal `wrong` substring elsewhere in the same text.
   */
  entries: Array<{
    key: string;
    translation: string;
    /** The full suggestion produced by the original scanner. */
    suggestion: string;
    /** Anchored substring to replace (unique within `translation`). */
    anchoredWrong: string;
    /** Anchored replacement substring. */
    anchoredRight: string;
  }>;
}

const SEVERITY_ORDER: Record<"high" | "medium" | "low", number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Aggregate `issues` into pattern groups. Two issues belong to the same
 * group when they share a rule and produce the exact same minimal-diff
 * `(wrong, right)` substitution. Each entry inside the group also carries
 * its own context-anchored patch so application is unambiguous.
 *
 * Groups are sorted by occurrence count desc, then by severity, then
 * alphabetically by `wrong`.
 *
 * Issues whose suggestion is empty/identical, or whose anchored patch
 * can't be uniquely located in their translation, are excluded.
 */
export function aggregateBulkPatterns(
  issues: ReadonlyArray<LocalIssue>,
): BulkPatternGroup[] {
  const byKey = new Map<string, BulkPatternGroup>();

  for (const it of issues) {
    if (!it.suggestion || it.suggestion === it.translation) continue;
    const minimal = minimalDiff(it.translation, it.suggestion);
    if (!minimal || minimal.wrong.length === 0) continue;
    const anchored = anchoredPatch(it.translation, it.suggestion);
    if (!anchored || anchored.wrong.length === 0) continue;

    const id = `${it.rule}|${minimal.wrong}|${minimal.right}`;
    let g = byKey.get(id);
    if (!g) {
      g = {
        id,
        rule: it.rule,
        wrong: minimal.wrong,
        right: minimal.right,
        count: 0,
        topSeverity: it.severity,
        entries: [],
      };
      byKey.set(id, g);
    }
    g.count += 1;
    g.entries.push({
      key: it.key,
      translation: it.translation,
      suggestion: it.suggestion,
      anchoredWrong: anchored.wrong,
      anchoredRight: anchored.right,
    });
    if (SEVERITY_ORDER[it.severity] < SEVERITY_ORDER[g.topSeverity]) {
      g.topSeverity = it.severity;
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const sev = SEVERITY_ORDER[a.topSeverity] - SEVERITY_ORDER[b.topSeverity];
    if (sev !== 0) return sev;
    return a.wrong.localeCompare(b.wrong);
  });
}

export interface ApplyBulkResult {
  /** Map of entry key -> new translation after applying every selected patch. */
  updates: Map<string, string>;
  /** Number of (group, entry) pairs that produced an actual replacement. */
  applied: number;
  /** Number of (group, entry) pairs that were skipped (target absent). */
  skipped: number;
}

/**
 * Apply every patch in `selectedGroups` to the translations in
 * `currentByKey`. Each entry uses its own anchored substitution rather
 * than the group's minimal diff so applying is unambiguous even when the
 * minimal `wrong` appears multiple times in the surrounding text.
 *
 * Patches whose anchored `wrong` is no longer present (because a prior
 * group already absorbed it) are skipped silently. The resulting map
 * contains only entries whose translation actually changed.
 */
export function applyBulkPatterns(
  selectedGroups: ReadonlyArray<BulkPatternGroup>,
  currentByKey: ReadonlyMap<string, string>,
): ApplyBulkResult {
  const updates = new Map<string, string>();
  let applied = 0;
  let skipped = 0;

  for (const g of selectedGroups) {
    for (const e of g.entries) {
      const cur = updates.get(e.key) ?? currentByKey.get(e.key);
      if (cur === undefined) {
        skipped++;
        continue;
      }
      const idx = cur.indexOf(e.anchoredWrong);
      if (idx === -1) {
        skipped++;
        continue;
      }
      const next =
        cur.slice(0, idx) +
        e.anchoredRight +
        cur.slice(idx + e.anchoredWrong.length);
      updates.set(e.key, next);
      applied++;
    }
  }

  return { updates, applied, skipped };
}
