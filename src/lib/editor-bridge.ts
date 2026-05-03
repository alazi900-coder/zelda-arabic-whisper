import { idbGet, idbSet } from "./idb-storage";
import type {
  EditorState,
  ExtractedEntry,
} from "@/components/editor/types";
import type { ScanEntry } from "@/components/quality-lab/InputZone";

/** IndexedDB key the editor uses for its autosaved state. */
export const EDITOR_IDB_KEY = "editorState";

/**
 * Convert an editor state into the Quality Lab's flat `ScanEntry` shape.
 * Entries with no translation yet are emitted with an empty string so they
 * still appear in the lab and the user can spot untranslated rows.
 */
export function editorStateToScanEntries(
  state: Pick<EditorState, "entries" | "translations">,
): ScanEntry[] {
  const out: ScanEntry[] = [];
  for (const e of state.entries) {
    const key = `${e.msbtFile}:${e.index}`;
    out.push({
      key,
      original: e.original,
      translation: state.translations[key] ?? "",
    });
  }
  return out;
}

/**
 * Merge updated translations from the Quality Lab back into an editor
 * state without mutating the input. Only keys that already exist in the
 * editor's `entries` (or its `translations` map) are written, so a stale
 * lab session cannot inject orphan keys into the editor.
 */
export function mergeIntoEditorState(
  state: EditorState,
  updates: ReadonlyMap<string, string>,
): { state: EditorState; written: number; ignored: number } {
  const validKeys = new Set<string>(Object.keys(state.translations));
  for (const e of state.entries) {
    validKeys.add(`${e.msbtFile}:${e.index}`);
  }

  const next: Record<string, string> = { ...state.translations };
  let written = 0;
  let ignored = 0;
  for (const [k, v] of updates) {
    if (!validKeys.has(k)) {
      ignored++;
      continue;
    }
    if (next[k] === v) continue;
    next[k] = v;
    written++;
  }

  return {
    state: { ...state, translations: next },
    written,
    ignored,
  };
}

/** Read the editor's autosaved state from IndexedDB. Returns null if absent. */
export async function loadEditorState(): Promise<EditorState | null> {
  try {
    const raw = await idbGet<unknown>(EDITOR_IDB_KEY);
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as Partial<EditorState>;
    if (!Array.isArray(obj.entries) || typeof obj.translations !== "object") {
      return null;
    }
    // Re-hydrate Set fields if present (the editor stores them as Sets).
    const protectedEntries =
      obj.protectedEntries instanceof Set
        ? obj.protectedEntries
        : Array.isArray(obj.protectedEntries)
          ? new Set<string>(obj.protectedEntries as string[])
          : undefined;
    const technicalBypass =
      obj.technicalBypass instanceof Set
        ? obj.technicalBypass
        : Array.isArray(obj.technicalBypass)
          ? new Set<string>(obj.technicalBypass as string[])
          : undefined;
    return {
      entries: obj.entries as ExtractedEntry[],
      translations: obj.translations as Record<string, string>,
      protectedEntries,
      glossary: obj.glossary,
      technicalBypass,
    };
  } catch {
    return null;
  }
}

/** Write a (possibly merged) editor state back to IndexedDB. */
export async function saveEditorState(state: EditorState): Promise<void> {
  await idbSet(EDITOR_IDB_KEY, state);
}
