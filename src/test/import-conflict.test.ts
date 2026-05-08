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

  it("flags overlap as a conflict even when the existing value equals the incoming one (identical=true)", () => {
    const entries = [entry("a.msbt", 1)];
    const incoming = { "a.msbt:1": "مرحبا" };
    const current = { "a.msbt:1": "مرحبا" };
    const out = splitImportByConflict(incoming, current, entries);
    expect(out.autoApply).toEqual({});
    expect(out.conflicts).toHaveLength(1);
    expect(out.conflicts[0]).toMatchObject({
      key: "a.msbt:1",
      oldTranslation: "مرحبا",
      newTranslation: "مرحبا",
      identical: true,
    });
  });

  it("treats whitespace-only existing translations as empty (auto-apply)", () => {
    const entries = [entry("a.msbt", 1)];
    const incoming = { "a.msbt:1": "مرحبا" };
    const current = { "a.msbt:1": "   \n  " };
    const out = splitImportByConflict(incoming, current, entries);
    expect(out.conflicts).toHaveLength(0);
    expect(out.autoApply).toEqual({ "a.msbt:1": "مرحبا" });
  });

  it("treats auto-detected entries (existing === entry.original) as empty (auto-apply)", () => {
    const entries = [entry("a.msbt", 1, "مرحبا بكم")];
    const incoming = { "a.msbt:1": "أهلاً وسهلاً" };
    const current = { "a.msbt:1": "مرحبا بكم" };
    const out = splitImportByConflict(incoming, current, entries);
    expect(out.conflicts).toHaveLength(0);
    expect(out.autoApply).toEqual({ "a.msbt:1": "أهلاً وسهلاً" });
  });

  it("treats trim-equal auto-detected entries as empty (auto-apply)", () => {
    const entries = [entry("a.msbt", 1, "مرحبا بكم")];
    const incoming = { "a.msbt:1": "أهلاً وسهلاً" };
    const current = { "a.msbt:1": "  مرحبا بكم  \n" };
    const out = splitImportByConflict(incoming, current, entries);
    expect(out.conflicts).toHaveLength(0);
    expect(out.autoApply).toEqual({ "a.msbt:1": "أهلاً وسهلاً" });
  });

  it("creates a conflict when existing differs from incoming (identical=false)", () => {
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
      identical: false,
    }]);
  });

  it("partitions a mixed batch correctly — both differing AND identical overlaps surface as conflicts", () => {
    const entries = [
      entry("a.msbt", 1, "A"),
      entry("a.msbt", 2, "B"),
      entry("b.msbt", 3, "C"),
    ];
    const incoming = {
      "a.msbt:1": "alpha-new",  // conflict (differing)
      "a.msbt:2": "beta",       // auto (no existing)
      "b.msbt:3": "gamma",      // conflict (identical)
    };
    const current = {
      "a.msbt:1": "alpha-old",
      "b.msbt:3": "gamma",
    };
    const out = splitImportByConflict(incoming, current, entries);
    expect(out.conflicts.map(c => c.key).sort()).toEqual(["a.msbt:1", "b.msbt:3"]);
    expect(out.conflicts.find(c => c.key === "a.msbt:1")?.identical).toBe(false);
    expect(out.conflicts.find(c => c.key === "b.msbt:3")?.identical).toBe(true);
    expect(out.autoApply).toEqual({ "a.msbt:2": "beta" });
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
      identical: false,
    });
  });

  it("returns empty results for an empty incoming map", () => {
    const out = splitImportByConflict({}, { "a.msbt:1": "x" }, [entry("a.msbt", 1)]);
    expect(out.conflicts).toHaveLength(0);
    expect(out.autoApply).toEqual({});
  });
});
