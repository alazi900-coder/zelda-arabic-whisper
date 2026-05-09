// Glossary auto-trim — produce a per-batch glossary slice containing only
// the terms that actually appear in any of the batch's English source texts.
//
// The edge function still caps the glossary section at 100 entries, but
// trimming on the client cuts request size and prompt tokens for projects
// with large glossaries (often 80–95% reduction since most batches only
// touch a handful of proper nouns / item names).

export interface GlossaryEntry {
  /** Original line as it should appear in the glossary section. */
  line: string;
  /** The lookup key (everything before "="), trimmed and lowercased. */
  key: string;
}

/** Parse a glossary text blob into [{ line, key }] preserving order and case. */
export function parseGlossaryEntries(glossary: string | undefined | null): GlossaryEntry[] {
  if (!glossary || !glossary.trim()) return [];
  const out: GlossaryEntry[] = [];
  for (const raw of glossary.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#') || line.startsWith('//')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (!key || !val) continue;
    out.push({ line, key: key.toLowerCase() });
  }
  return out;
}

// eslint-disable-next-line no-control-regex -- intentional: ASCII range includes control bytes by definition
const ASCII_ONLY = /^[\x00-\x7F]+$/;
const REGEX_META = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(s: string): string {
  return s.replace(REGEX_META, '\\$&');
}

/**
 * Decide whether a glossary key matches the lowercased haystack.
 *
 * - For pure-ASCII keys we require word boundaries so "key" doesn't match
 *   "monkey" (these are common false positives for short English keys).
 * - For non-ASCII keys (Arabic, mixed) `\b` is unreliable, so we fall back
 *   to plain substring containment.
 */
function keyAppearsIn(key: string, haystackLower: string): boolean {
  if (!key) return false;
  if (ASCII_ONLY.test(key)) {
    try {
      const re = new RegExp(`\\b${escapeRegex(key)}\\b`);
      return re.test(haystackLower);
    } catch {
      return haystackLower.includes(key);
    }
  }
  return haystackLower.includes(key);
}

/**
 * Build a glossary string containing only entries whose key appears in any
 * of the batch's English source texts. Entry order is preserved; duplicates
 * by key are deduplicated; result is capped at `maxTerms`.
 *
 * Returns an empty string when no entries match — the edge function already
 * skips the glossary section in that case.
 */
export function trimGlossaryToBatch(
  glossary: string | undefined | null,
  entries: ReadonlyArray<{ original: string }>,
  maxTerms = 100,
): string {
  const parsed = parseGlossaryEntries(glossary);
  if (parsed.length === 0 || entries.length === 0) return '';

  // Build a single lowercase haystack from the batch.
  const haystack = entries.map((e) => e.original).join('\n').toLowerCase();
  if (!haystack.trim()) return '';

  const seen = new Set<string>();
  const matched: string[] = [];
  for (const { line, key } of parsed) {
    if (matched.length >= maxTerms) break;
    if (seen.has(key)) continue;
    if (keyAppearsIn(key, haystack)) {
      matched.push(line);
      seen.add(key);
    }
  }
  return matched.join('\n');
}
