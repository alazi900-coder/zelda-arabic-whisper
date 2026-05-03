// Persistent dismissal store for Quality Lab.
//
// Two layers of dismissal:
//
//  1. Issue-level dismissal: hide a single (key, rule, issue) tuple. Persisted
//     per source filename so reopening the same file keeps your previous
//     decisions.
//
//  2. Pattern-level dismissal: hide all issues that share the same
//     (rule, issue) signature regardless of which entry they appear on.
//     Persisted globally so once you teach the lab to ignore a pattern
//     (e.g. "همزة شائعة | علي"), it stays ignored across files and sessions.

const ISSUE_KEY_PREFIX = "ql:dismissed-issues:v1:";
const PATTERN_KEY = "ql:dismissed-patterns:v1";

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    if (typeof localStorage === "undefined") return null;
    // Some browsers throw on access in private mode.
    localStorage.getItem("__ql_probe__");
    return localStorage;
  } catch {
    return null;
  }
}

function loadStringSet(key: string): Set<string> {
  const ls = safeStorage();
  if (!ls) return new Set();
  try {
    const raw = ls.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveStringSet(key: string, set: ReadonlySet<string>): void {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore quota errors; dismissals are nice-to-have, not critical.
  }
}

function issueKey(filename?: string): string {
  return ISSUE_KEY_PREFIX + (filename && filename.length > 0 ? filename : "__unknown__");
}

/** Load the dismissed issue IDs for a given source file. */
export function loadDismissedIssues(filename?: string): Set<string> {
  return loadStringSet(issueKey(filename));
}

/** Persist the dismissed issue IDs for a given source file. */
export function saveDismissedIssues(
  filename: string | undefined,
  ids: ReadonlySet<string>,
): void {
  saveStringSet(issueKey(filename), ids);
}

/** Load the global dismissed patterns set. */
export function loadDismissedPatterns(): Set<string> {
  return loadStringSet(PATTERN_KEY);
}

/** Persist the global dismissed patterns set. */
export function saveDismissedPatterns(patterns: ReadonlySet<string>): void {
  saveStringSet(PATTERN_KEY, patterns);
}

/** Build a stable signature for a pattern (rule + issue text). */
export function patternSignature(rule: string, issue: string): string {
  return `${rule}|${issue.trim()}`;
}

/** Build a stable signature for a single issue (key + rule + issue text). */
export function issueSignature(key: string, rule: string, issue: string): string {
  return `${key}|${rule}|${issue.trim()}`;
}
