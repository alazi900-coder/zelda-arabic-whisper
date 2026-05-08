/**
 * Parser for the structured English-only TXT export produced by
 * `buildEnglishTxt` in `src/hooks/useEditorFileIO.ts`.
 *
 * Each entry block looks like:
 *
 *     [<row>] (<file>.msbt:<idx>)
 *     Label: <label>           (optional)
 *
 *     <original English text>
 *
 *     ▶ Translation:
 *     <user's Arabic translation, possibly multi-line>
 *
 *     ════════════════════════════════════════════════════════════
 *
 * The parser walks the file line-by-line and returns a `{key: translation}`
 * dictionary that matches the editor's translations shape. Empty translation
 * blocks are silently dropped so untouched entries don't overwrite existing
 * translations on import.
 */

const HEADER_RE = /^\s*\[\d+\]\s*\(\s*(.+?\.msbt)\s*:\s*(\d+)\s*\)\s*$/;
const TRANSLATION_MARKER = "▶ Translation:";
// Matches the 60-character `═` separator emitted by `buildEnglishTxt`.
// Stays loose (≥ 5 chars) so manual edits with shorter rules still work.
const SEPARATOR_RE = /^\s*═{5,}\s*$/;

export interface EnglishTxtParseResult {
  translations: Record<string, string>;
  /** Entries whose translation block was empty after trimming. */
  emptyCount: number;
}

export function parseEnglishOnlyTxt(text: string): EnglishTxtParseResult {
  const lines = text.split(/\r?\n/);
  const translations: Record<string, string> = {};
  let emptyCount = 0;
  let i = 0;
  while (i < lines.length) {
    const header = lines[i].match(HEADER_RE);
    if (!header) {
      i++;
      continue;
    }
    const key = `${header[1]}:${header[2]}`;
    let j = i + 1;
    while (j < lines.length && !lines[j].includes(TRANSLATION_MARKER)) {
      if (HEADER_RE.test(lines[j])) break;
      j++;
    }
    if (j >= lines.length || !lines[j].includes(TRANSLATION_MARKER)) {
      i = j;
      continue;
    }
    j++;
    const block: string[] = [];
    while (j < lines.length) {
      if (SEPARATOR_RE.test(lines[j])) break;
      if (HEADER_RE.test(lines[j])) break;
      block.push(lines[j]);
      j++;
    }
    const translation = block.join("\n").replace(/^\s+|\s+$/g, "");
    if (translation) {
      translations[key] = translation;
    } else {
      emptyCount++;
    }
    i = j;
  }
  return { translations, emptyCount };
}
