import type { LocalIssue } from "./local-enhance-scanner";

export interface IssueGroup {
  key: string;
  original: string;
  translation: string;
  /** All issues attached to this entry, sorted high → medium → low. */
  issues: LocalIssue[];
  /**
   * Translation after composing every auto-fix suggestion in this group.
   * Equal to `translation` when no issue carries an auto-fix.
   */
  unifiedSuggestion: string;
  /** Highest severity present in the group (used for sorting groups). */
  topSeverity: "high" | "medium" | "low";
}

/**
 * Derive a context-anchored `(wrong, right)` substitution that turns `a`
 * into `b`. Returns null when the strings are identical or when the
 * substitution can\u2019t be uniquely located in `a`.
 *
 * The algorithm strips the longest shared prefix and suffix to find the
 * minimal differing window, then expands the window outward until the
 * `wrong` substring appears at exactly one location in `a`. Expansion is
 * required because dictionary scanners often produce single-character
 * fixes (e.g. delete one alif) that recur many times in the surrounding
 * text \u2014 anchoring them with one or two neighbouring characters lets us
 * apply the patch safely to a partially-modified running buffer.
 */
export function derivePatch(
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

  // Expand the window outward until the "wrong" slice is unique in `a`.
  while (true) {
    const wrong = a.slice(aStart, aEnd);
    if (
      wrong.length > 0 &&
      a.indexOf(wrong) === a.lastIndexOf(wrong)
    ) {
      break;
    }
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

/**
 * Compose every auto-fix suggestion in `issues` against `translation`. The
 * scanner produces each `suggestion` as if it were the only fix applied,
 * so applying them naively would erase earlier fixes. We instead derive
 * each fix as a context-anchored `(wrong, right)` substitution from the
 * issue's own translation and apply them sequentially to a running
 * buffer.
 *
 * Substitutions whose `wrong` no longer occurs are skipped (they were
 * already absorbed by an earlier fix). Substitutions that can\u2019t be
 * uniquely anchored in the issue\u2019s translation are also skipped.
 */
export function composeSuggestions(
  translation: string,
  issues: ReadonlyArray<LocalIssue>,
): string {
  let cur = translation;
  for (const it of issues) {
    if (!it.suggestion || it.suggestion === it.translation) continue;
    const patch = derivePatch(it.translation, it.suggestion);
    if (!patch || patch.wrong.length === 0) continue;
    const idx = cur.indexOf(patch.wrong);
    if (idx === -1) continue;
    cur =
      cur.slice(0, idx) + patch.right + cur.slice(idx + patch.wrong.length);
  }
  return cur;
}

const SEVERITY_ORDER: Record<"high" | "medium" | "low", number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Group `issues` by entry key. The output preserves the first-seen order of
 * keys and within each group sorts issues by severity (high → low).
 */
export function groupIssuesByEntry(
  issues: ReadonlyArray<LocalIssue>,
): IssueGroup[] {
  const byKey = new Map<string, IssueGroup>();
  for (const it of issues) {
    let g = byKey.get(it.key);
    if (!g) {
      g = {
        key: it.key,
        original: it.original,
        translation: it.translation,
        issues: [],
        unifiedSuggestion: it.translation,
        topSeverity: it.severity,
      };
      byKey.set(it.key, g);
    }
    g.issues.push(it);
    if (SEVERITY_ORDER[it.severity] < SEVERITY_ORDER[g.topSeverity]) {
      g.topSeverity = it.severity;
    }
  }
  for (const g of byKey.values()) {
    g.issues.sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    );
    g.unifiedSuggestion = composeSuggestions(g.translation, g.issues);
  }
  return Array.from(byKey.values()).sort(
    (a, b) => SEVERITY_ORDER[a.topSeverity] - SEVERITY_ORDER[b.topSeverity],
  );
}
