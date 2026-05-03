import { describe, it, expect } from "vitest";
import {
  editorStateToScanEntries,
  mergeIntoEditorState,
} from "@/lib/editor-bridge";
import type { EditorState } from "@/components/editor/types";

const mkEntry = (msbtFile: string, index: number, original: string) => ({
  msbtFile,
  index,
  label: `${msbtFile}:${index}`,
  original,
  maxBytes: 200,
});

const mkState = (
  entries: ReturnType<typeof mkEntry>[],
  translations: Record<string, string>,
): EditorState => ({
  entries,
  translations,
});

describe("editor-bridge: editorStateToScanEntries", () => {
  it("emits one ScanEntry per editor entry, with translation from the map", () => {
    const state = mkState(
      [
        mkEntry("intro.msbt", 0, "Hello"),
        mkEntry("intro.msbt", 1, "World"),
      ],
      {
        "intro.msbt:0": "أهلاً",
        "intro.msbt:1": "أيها العالم",
      },
    );
    const out = editorStateToScanEntries(state);
    expect(out).toEqual([
      { key: "intro.msbt:0", original: "Hello", translation: "أهلاً" },
      { key: "intro.msbt:1", original: "World", translation: "أيها العالم" },
    ]);
  });

  it("emits empty translation for entries that have no translation yet", () => {
    const state = mkState(
      [mkEntry("a.msbt", 0, "x"), mkEntry("a.msbt", 1, "y")],
      { "a.msbt:0": "" },
    );
    const out = editorStateToScanEntries(state);
    expect(out[0].translation).toBe("");
    expect(out[1].translation).toBe("");
  });

  it("preserves entry order from the editor state", () => {
    const state = mkState(
      [
        mkEntry("b.msbt", 5, "five"),
        mkEntry("a.msbt", 0, "zero"),
        mkEntry("a.msbt", 1, "one"),
      ],
      {},
    );
    const keys = editorStateToScanEntries(state).map((e) => e.key);
    expect(keys).toEqual(["b.msbt:5", "a.msbt:0", "a.msbt:1"]);
  });
});

describe("editor-bridge: mergeIntoEditorState", () => {
  it("writes updates and reports the count of changed translations", () => {
    const state = mkState(
      [mkEntry("x.msbt", 0, "Hi"), mkEntry("x.msbt", 1, "Bye")],
      { "x.msbt:0": "مرحباً", "x.msbt:1": "مع السلامة" },
    );
    const merged = mergeIntoEditorState(
      state,
      new Map([
        ["x.msbt:0", "أهلاً"],
        ["x.msbt:1", "وداعاً"],
      ]),
    );
    expect(merged.written).toBe(2);
    expect(merged.ignored).toBe(0);
    expect(merged.state.translations["x.msbt:0"]).toBe("أهلاً");
    expect(merged.state.translations["x.msbt:1"]).toBe("وداعاً");
  });

  it("does not mutate the input state", () => {
    const state = mkState(
      [mkEntry("a.msbt", 0, "x")],
      { "a.msbt:0": "أصلي" },
    );
    const before = JSON.stringify(state);
    mergeIntoEditorState(state, new Map([["a.msbt:0", "جديد"]]));
    expect(JSON.stringify(state)).toBe(before);
  });

  it("ignores keys that don't correspond to any editor entry or existing translation", () => {
    const state = mkState(
      [mkEntry("a.msbt", 0, "x")],
      { "a.msbt:0": "" },
    );
    const merged = mergeIntoEditorState(
      state,
      new Map([
        ["a.msbt:0", "ترجمة"],
        ["unknown:99", "لن يُكتب"],
      ]),
    );
    expect(merged.written).toBe(1);
    expect(merged.ignored).toBe(1);
    expect("unknown:99" in merged.state.translations).toBe(false);
  });

  it("does not count no-op writes (same value as before) as written", () => {
    const state = mkState(
      [mkEntry("a.msbt", 0, "x")],
      { "a.msbt:0": "ثابت" },
    );
    const merged = mergeIntoEditorState(
      state,
      new Map([["a.msbt:0", "ثابت"]]),
    );
    expect(merged.written).toBe(0);
    expect(merged.ignored).toBe(0);
  });

  it("accepts updates for keys that come from entries even when no prior translation exists", () => {
    const state = mkState(
      [mkEntry("new.msbt", 0, "x")],
      {},
    );
    const merged = mergeIntoEditorState(
      state,
      new Map([["new.msbt:0", "ترجمة جديدة"]]),
    );
    expect(merged.written).toBe(1);
    expect(merged.state.translations["new.msbt:0"]).toBe("ترجمة جديدة");
  });
});
