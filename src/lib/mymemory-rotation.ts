// MyMemory email rotation.
//
// MyMemory's free tier is rate-limited per registered email (~50k chars/day
// without an account, 100k+ with one). Users can register multiple emails
// and rotate between them to extend the effective daily limit.
//
// This module is a pure helper: parse the user's email blob (one address
// per line, or comma-separated), pick the next email by round-robin index,
// and return the index to persist for the next call.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parse a comma- or newline-separated string of emails. Trims, dedupes, drops invalid. */
export function parseEmailList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const e = part.trim().toLowerCase();
    if (!e) continue;
    if (!EMAIL_RE.test(e)) continue;
    if (seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

export interface RotationResult {
  /** Email to use for the upcoming MyMemory request. Empty string if no valid emails. */
  email: string;
  /** Index to persist for the next rotation call. */
  nextIndex: number;
  /** Total number of emails in the rotation list. */
  total: number;
}

/**
 * Pick the next email in round-robin order.
 *
 * Returns:
 *   - email: the chosen email (or "" if list is empty — caller should fall
 *     back to anonymous MyMemory access in that case)
 *   - nextIndex: caller persists this so subsequent calls advance
 *   - total: count of valid emails (for UI/diagnostics)
 */
export function pickNextEmail(emails: ReadonlyArray<string>, currentIndex = 0): RotationResult {
  if (emails.length === 0) {
    return { email: "", nextIndex: 0, total: 0 };
  }
  const idx = ((currentIndex % emails.length) + emails.length) % emails.length;
  const email = emails[idx];
  const nextIndex = (idx + 1) % emails.length;
  return { email, nextIndex, total: emails.length };
}
