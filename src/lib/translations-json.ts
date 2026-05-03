import type { ScanEntry, ScanSourceFormat } from "@/components/quality-lab/InputZone";

export interface JsonParseResult {
  entries: ScanEntry[];
  sourceFormat: ScanSourceFormat;
  /** Original key order for round-trip exports of the editor's dict format. */
  sourceKeys?: string[];
}

/**
 * Parse a translation file in either of the two JSON shapes accepted by
 * the editor + Quality Lab:
 *
 * 1. Dictionary form (editor's translations.json): a plain object whose
 *    keys are "<file>.msbt:<idx>" and whose values are translation strings.
 *    Key order is preserved so we can round-trip the same file structure.
 * 2. Array form: an array of {key, original, translation} objects.
 *
 * Throws a localised error if neither shape matches.
 */
export function parseTranslationsJSON(text: string): JsonParseResult {
  const data = JSON.parse(text);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const keys = Object.keys(obj);
    const looksLikeEditor =
      keys.length > 0 &&
      keys.every((k) => typeof obj[k] === "string") &&
      keys.some((k) => /:[0-9]+$/.test(k) || /\.msbt:/i.test(k));
    if (looksLikeEditor) {
      const entries: ScanEntry[] = keys.map((k) => ({
        key: k,
        original: "",
        translation: String(obj[k] ?? ""),
      }));
      return { entries, sourceFormat: "dict-json", sourceKeys: keys };
    }
    if (Array.isArray((obj as Record<string, unknown>).entries)) {
      return parseArray((obj as Record<string, unknown>).entries as unknown[]);
    }
    if (Array.isArray((obj as Record<string, unknown>).translations)) {
      return parseArray((obj as Record<string, unknown>).translations as unknown[]);
    }
    // Fallback: any string-valued object becomes a dict.
    const stringEntries: ScanEntry[] = [];
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string") {
        stringEntries.push({ key: k, original: "", translation: v });
      }
    }
    if (stringEntries.length > 0) {
      return { entries: stringEntries, sourceFormat: "dict-json", sourceKeys: keys };
    }
    throw new Error("JSON يجب أن يكون كائناً {مفتاح:ترجمة} أو مصفوفة من الكائنات.");
  }
  if (!Array.isArray(data)) {
    throw new Error("JSON يجب أن يكون كائناً أو مصفوفة من الكائنات");
  }
  return parseArray(data as unknown[]);
}

function parseArray(rows: unknown[]): JsonParseResult {
  const entries = rows
    .map((row, i) => {
      const r = (row ?? {}) as Record<string, unknown>;
      return {
        key: String(r.key ?? r.id ?? `entry:${i + 1}`),
        original: String(r.original ?? r.source ?? r.en ?? ""),
        translation: String(r.translation ?? r.target ?? r.ar ?? ""),
      };
    })
    .filter((r) => r.original || r.translation);
  return { entries, sourceFormat: "array-json" };
}

/**
 * Build the editor-compatible JSON text for export. The result is a 2-space
 * indented object whose keys appear in the supplied order, with no extra
 * normalisation of the values, so the editor can round-trip without diff.
 */
export function buildEditorDictJSON(
  entries: ReadonlyArray<{ key: string; translation: string }>,
  preferredOrder?: ReadonlyArray<string>,
): string {
  const lookup = new Map<string, string>();
  for (const e of entries) lookup.set(e.key, e.translation);
  const seen = new Set<string>();
  const out: Record<string, string> = {};
  if (preferredOrder) {
    for (const k of preferredOrder) {
      if (lookup.has(k)) {
        out[k] = lookup.get(k) ?? "";
        seen.add(k);
      }
    }
  }
  for (const e of entries) {
    if (!seen.has(e.key)) {
      out[e.key] = e.translation;
      seen.add(e.key);
    }
  }
  return JSON.stringify(out, null, 2);
}
