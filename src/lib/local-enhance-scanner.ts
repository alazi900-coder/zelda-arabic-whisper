// Offline enhancement scanner — detects common Arabic translation issues
// without an internet connection: missing/extra chars, glued words,
// repeated words, double spaces, untranslated English, terminology drift.

export interface LocalIssue {
  key: string;
  original: string;
  translation: string;
  suggestion: string;
  issue: string;
  severity: "high" | "medium" | "low";
  type: "missing_char" | "style" | "consistency" | "punctuation" | "accuracy";
}

const AR = /[\u0600-\u06FF]/;
const TAG_RE = /[\uE000-\uF8FF]|\[[A-Z][^\]]*\]/g;

// Strip tags & PUA for textual analysis only
function stripTags(s: string): string {
  return s.replace(TAG_RE, " ");
}

// Detect double spaces / space before punctuation
function fixWhitespace(t: string): { fixed: string; changed: boolean } {
  let fixed = t.replace(/[ \t]{2,}/g, " ");
  fixed = fixed.replace(/\s+([،.؛:!؟?,])/g, "$1");
  fixed = fixed.replace(/([،.؛:])(?!\s|$)/g, "$1 ");
  return { fixed, changed: fixed !== t };
}

// Detect immediate word repetition: "كلمة كلمة"
function fixRepeatedWords(t: string): { fixed: string; changed: boolean } {
  const fixed = t.replace(/\b(\S+)\s+\1\b/g, "$1");
  return { fixed, changed: fixed !== t };
}

// Detect glued Arabic+Latin without space: "Linkالبطل" -> "Link البطل"
function fixGluedScripts(t: string): { fixed: string; changed: boolean } {
  let fixed = t.replace(/([A-Za-z0-9])([\u0600-\u06FF])/g, "$1 $2");
  fixed = fixed.replace(/([\u0600-\u06FF])([A-Za-z])/g, "$1 $2");
  return { fixed, changed: fixed !== t };
}

// Build a glossary of dominant translations across all entries:
// for each English term, find its most-common Arabic translation.
export function buildConsistencyMap(
  pairs: { original: string; translation: string }[]
): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const { original, translation } of pairs) {
    const stripped = stripTags(original).trim();
    const t = stripTags(translation).trim();
    if (!stripped || !t) continue;
    // Only consider single-word originals to avoid noise
    const m = stripped.match(/^[A-Z][A-Za-z]{2,}$/);
    if (!m) continue;
    if (!counts.has(stripped)) counts.set(stripped, new Map());
    const inner = counts.get(stripped)!;
    inner.set(t, (inner.get(t) || 0) + 1);
  }
  const result = new Map<string, string>();
  for (const [term, inner] of counts) {
    let best = "", n = 0;
    for (const [tr, c] of inner) if (c > n) { best = tr; n = c; }
    if (n >= 2) result.set(term, best);
  }
  return result;
}

export function scanEntryLocally(
  key: string,
  original: string,
  translation: string,
  consistencyMap?: Map<string, string>
): LocalIssue[] {
  const issues: LocalIssue[] = [];
  if (!translation.trim()) return issues;

  const t = translation;
  const orig = original;

  // 1. Whitespace
  const ws = fixWhitespace(t);
  if (ws.changed) {
    issues.push({
      key, original: orig, translation: t,
      suggestion: ws.fixed, issue: "مسافات زائدة أو حول علامات الترقيم",
      severity: "low", type: "punctuation",
    });
  }

  // 2. Repeated word
  const rep = fixRepeatedWords(t);
  if (rep.changed) {
    issues.push({
      key, original: orig, translation: t,
      suggestion: rep.fixed, issue: "كلمة مكررة مرتين متتاليتين",
      severity: "medium", type: "missing_char",
    });
  }

  // 3. Glued scripts
  const gl = fixGluedScripts(t);
  if (gl.changed) {
    issues.push({
      key, original: orig, translation: t,
      suggestion: gl.fixed, issue: "كلمات ملتصقة بدون مسافة (عربي+لاتيني)",
      severity: "medium", type: "style",
    });
  }

  // 4. Untranslated — original has Latin words but translation is Latin only with no Arabic
  const stripped = stripTags(t);
  const origStripped = stripTags(orig);
  if (origStripped.length >= 4 && !AR.test(stripped) && /[A-Za-z]/.test(stripped)) {
    issues.push({
      key, original: orig, translation: t,
      suggestion: t, issue: "النص لم يُترجم (لا يحتوي عربية)",
      severity: "high", type: "accuracy",
    });
  }

  // 5. Consistency: if original is a single capitalised word with a known dominant translation
  if (consistencyMap) {
    const origWord = origStripped.trim();
    if (/^[A-Z][A-Za-z]{2,}$/.test(origWord)) {
      const dominant = consistencyMap.get(origWord);
      if (dominant && stripTags(t).trim() && stripTags(t).trim() !== dominant) {
        issues.push({
          key, original: orig, translation: t,
          suggestion: t.replace(stripTags(t).trim(), dominant),
          issue: `الترجمة الشائعة لكلمة "${origWord}" هي "${dominant}"`,
          severity: "medium", type: "consistency",
        });
      }
    }
  }

  return issues;
}

export function scanAllLocally(
  entries: { key: string; original: string; translation: string }[]
): LocalIssue[] {
  const consistency = buildConsistencyMap(entries);
  const all: LocalIssue[] = [];
  for (const e of entries) {
    all.push(...scanEntryLocally(e.key, e.original, e.translation, consistency));
  }
  return all;
}
