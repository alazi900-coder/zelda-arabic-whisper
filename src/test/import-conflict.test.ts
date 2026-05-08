import { describe, it, expect } from "vitest";
import { splitImportByConflict } from "@/hooks/useEditorFileIO";
import type { ExtractedEntry } from "@/components/editor/types";

function entry(file: string, index: number, original = "Hello", label = ""): ExtractedEntry {
  return {
    msbtFile: file, index, original, label,
    maxBytes: 0,
  } as ExtractedEntry;
}

describe("splitImportByConflict", () => {
  it("auto-applies entries with no existing translation", () => {
    const entries = [entry("a.msbt", 1)];
    const incoming = { "a.msbt:1": "مرحبا" };
    const out = splitImportByConflict(incoming, {}, entries);
    expect(out.conflicts).toHaveLength(0);
    expect(out.autoApply).toEqual({ "a.msbt:1": "مرحبا" });
  });

  it("auto-applies entries whose existing value equals the incoming one", () => {
    const entries = [entry("a.msbt", 1)];
    const incoming = { "a.msbt:1": "مرحبا" };
    const current = { "a.msbt:1": "مرحبا" };
    const out = splitImportByConflict(incoming, current, entries);
    expect(out.conflicts).toHaveLength(0);
    expect(out.autoApply).toEqual({ "a.msbt:1": "مرحبا" });
  });

  it("treats whitespace-only existing translations as empty (auto-apply)", () => {
    const entries = [entry("a.msbt", 1)];
    const incoming = { "a.msbt:1": "مرحبا" };
    const current = { "a.msbt:1": "   \n  " };
    const out = splitImportByConflict(incoming, current, entries);
    expect(out.conflicts).toHaveLength(0);
    expect(out.autoApply).toEqual({ "a.msbt:1": "مرحبا" });
  });

  it("creates a conflict when existing differs from incoming", () => {
    const entries = [entry("a.msbt", 1, "Hi there", "Greeting")];
    const incoming = { "a.msbt:1": "أهلاً وسهلاً" };
    const current = { "a.msbt:1": "مرحبا" };
    const out = splitImportByConflict(incoming, current, entries);
    expect(Object.keys(out.autoApply)).toHaveLength(0);
    expect(out.conflicts).toEqual([{
      key: "a.msbt:1",
      file: "a.msbt",
      label: "Greeting",
      original: "Hi there",
      oldTranslation: "مرحبا",
      newTranslation: "أهلاً وسهلاً",
    }]);
  });

  it("partitions a mixed batch correctly", () => {
    const entries = [
      entry("a.msbt", 1, "A"),
      entry("a.msbt", 2, "B"),
      entry("b.msbt", 3, "C"),
    ];
    const incoming = {
      "a.msbt:1": "alpha-new",  // conflict
      "a.msbt:2": "beta",       // auto (no existing)
      "b.msbt:3": "gamma",      // auto (existing equals incoming)
    };
    const current = {
      "a.msbt:1": "alpha-old",
      "b.msbt:3": "gamma",
    };
    const out = splitImportByConflict(incoming, current, entries);
    expect(out.conflicts.map(c => c.key)).toEqual(["a.msbt:1"]);
    expect(out.autoApply).toEqual({
      "a.msbt:2": "beta",
      "b.msbt:3": "gamma",
    });
  });

  it("falls back gracefully when the entry isn't found in `entries`", () => {
    const incoming = { "ghost.msbt:99": "X" };
    const current = { "ghost.msbt:99": "Y" };
    const out = splitImportByConflict(incoming, current, []);
    expect(out.conflicts).toHaveLength(1);
    expect(out.conflicts[0]).toMatchObject({
      key: "ghost.msbt:99",
      file: "ghost.msbt:99",
      label: "",
      original: "",
      oldTranslation: "Y",
      newTranslation: "X",
    });
  });

  it("returns empty results for an empty incoming map", () => {
    const out = splitImportByConflict({}, { "a.msbt:1": "x" }, [entry("a.msbt", 1)]);
    expect(out.conflicts).toHaveLength(0);
    expect(out.autoApply).toEqual({});
  });
});
