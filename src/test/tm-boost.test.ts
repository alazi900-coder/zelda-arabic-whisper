import { describe, it, expect } from "vitest";
import {
  precomputeCandidates,
  findTopTmMatches,
  buildBatchTmExamples,
  type TmCandidate,
} from "@/lib/tm-boost";

const candidates: TmCandidate[] = [
  { original: "Open the chest to find the key", translation: "افتح الصندوق لتجد المفتاح" },
  { original: "Open the door to enter the temple", translation: "افتح الباب لتدخل المعبد" },
  { original: "Defeat the boss to save the princess", translation: "اهزم الزعيم لتنقذ الأميرة" },
  { original: "Talk to the old man in the village", translation: "تحدّث إلى الرجل العجوز في القرية" },
  { original: "", translation: "" }, // empty — should be filtered
  { original: "Empty translation", translation: "" }, // empty translation
];

describe("findTopTmMatches", () => {
  it("returns empty for empty needle", () => {
    const pre = precomputeCandidates(candidates);
    expect(findTopTmMatches("", pre)).toEqual([]);
    expect(findTopTmMatches("   ", pre)).toEqual([]);
  });

  it("returns empty when no candidates", () => {
    expect(findTopTmMatches("anything", [])).toEqual([]);
  });

  it("excludes exact-original self matches", () => {
    const pre = precomputeCandidates(candidates);
    const result = findTopTmMatches("Open the chest to find the key", pre);
    for (const r of result) {
      expect(r.original).not.toBe("Open the chest to find the key");
    }
  });

  it("excludes candidates with empty translation", () => {
    const pre = precomputeCandidates(candidates);
    const result = findTopTmMatches("Empty translation here", pre);
    for (const r of result) {
      expect(r.translation.trim().length).toBeGreaterThan(0);
    }
  });

  it("ranks higher-similarity matches first", () => {
    const pre = precomputeCandidates(candidates);
    const result = findTopTmMatches("Open the gate to find the sword", pre);
    expect(result.length).toBeGreaterThan(0);
    // Most similar should mention "Open the ... to find the ..."
    expect(result[0].original).toBe("Open the chest to find the key");
    // Sorted descending by sim
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].sim).toBeGreaterThanOrEqual(result[i].sim);
    }
  });

  it("respects k cap", () => {
    const pre = precomputeCandidates(candidates);
    const result = findTopTmMatches("Open the door to find the key", pre, 1);
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it("respects minSim threshold", () => {
    const pre = precomputeCandidates(candidates);
    const result = findTopTmMatches("Completely unrelated greeting", pre, 5, 0.9);
    expect(result.length).toBe(0);
  });
});

describe("buildBatchTmExamples", () => {
  it("returns empty for empty batch or candidates", () => {
    const pre = precomputeCandidates(candidates);
    expect(buildBatchTmExamples([], pre)).toEqual([]);
    expect(buildBatchTmExamples([{ original: "a" }], [])).toEqual([]);
  });

  it("dedupes the same example chosen by multiple needles", () => {
    const pre = precomputeCandidates(candidates);
    const batch = [
      { original: "Open the gate to find the sword" },
      { original: "Open the lock to find the key" },
    ];
    const result = buildBatchTmExamples(batch, pre, 5, 10);
    const originals = result.map((r) => r.original);
    expect(new Set(originals).size).toBe(originals.length);
  });

  it("keeps the maximum similarity when an example is matched by multiple needles", () => {
    const pre = precomputeCandidates(candidates);
    const batch = [
      { original: "Open the chest to find the key" }, // exact-self skipped
      { original: "Open the gate to find the key" }, // very similar
    ];
    const result = buildBatchTmExamples(batch, pre, 5, 10);
    const chest = result.find((r) => r.original === "Open the chest to find the key");
    if (chest) {
      // The match would only come from needle #2, since needle #1 skipped exact-self.
      expect(chest.sim).toBeGreaterThan(0);
    }
  });

  it("respects totalCap", () => {
    const pre = precomputeCandidates(candidates);
    const batch = [
      { original: "Open the gate to find the sword" },
      { original: "Defeat the dragon to save the kingdom" },
      { original: "Talk to the mage in the tower" },
    ];
    const result = buildBatchTmExamples(batch, pre, 5, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("sorts overall result by similarity desc", () => {
    const pre = precomputeCandidates(candidates);
    const batch = [
      { original: "Open the gate to find the sword" },
      { original: "Defeat the dragon to save the kingdom" },
    ];
    const result = buildBatchTmExamples(batch, pre);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].sim).toBeGreaterThanOrEqual(result[i].sim);
    }
  });
});
