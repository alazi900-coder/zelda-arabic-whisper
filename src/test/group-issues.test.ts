import { describe, it, expect } from "vitest";
import {
  derivePatch,
  composeSuggestions,
  groupIssuesByEntry,
} from "@/lib/group-issues";
import type { LocalIssue } from "@/lib/local-enhance-scanner";

const baseIssue = (
  partial: Partial<LocalIssue> & {
    key: string;
    translation: string;
    suggestion: string;
    rule: string;
    issue: string;
  },
): LocalIssue => ({
  original: partial.original ?? "",
  reason: partial.reason ?? "",
  type: partial.type ?? "spelling",
  severity: partial.severity ?? "medium",
  ...partial,
});

describe("derivePatch", () => {
  it("returns null when strings are identical", () => {
    expect(derivePatch("hello", "hello")).toBeNull();
  });

  it("captures a trailing punctuation change", () => {
    expect(derivePatch("ماذا؟", "ماذا?")).toEqual({
      wrong: "؟",
      right: "?",
    });
  });

  it("expands an ambiguous single-char deletion until unique", () => {
    // The minimal diff for لاكن→لكن is wrong="ا" right="". But "ا" appears
    // multiple times in the surrounding sentence — expansion picks up the
    // preceding "ل" so the patch becomes "لا"→"ل".
    const patch = derivePatch("علي يضرب لاكن", "علي يضرب لكن");
    expect(patch).not.toBeNull();
    if (!patch) return;
    // The patch must round-trip when applied to the original translation.
    const applied = ("علي يضرب لاكن").replace(patch.wrong, patch.right);
    expect(applied).toBe("علي يضرب لكن");
  });

  it("returns a patch whose `wrong` is unique in the source", () => {
    const a = "بسم الله لاكن أنا";
    const b = "بسم الله لكن أنا";
    const patch = derivePatch(a, b);
    expect(patch).not.toBeNull();
    if (!patch) return;
    expect(a.indexOf(patch.wrong)).toBe(a.lastIndexOf(patch.wrong));
    expect(a.replace(patch.wrong, patch.right)).toBe(b);
  });

  it("captures a unique trailing single-char swap", () => {
    const patch = derivePatch("أنا", "انا");
    expect(patch).not.toBeNull();
    if (!patch) return;
    expect("أنا".replace(patch.wrong, patch.right)).toBe("انا");
  });
});

describe("composeSuggestions", () => {
  const k = "f.msbt:1";
  it("returns translation when no fixes apply", () => {
    expect(composeSuggestions("سيف", [])).toBe("سيف");
  });

  it("applies a single fix", () => {
    const issues = [
      baseIssue({
        key: k,
        translation: "علي يضرب لاكن",
        suggestion: "علي يضرب لكن",
        rule: "dict_common_typo",
        issue: "لاكن → لكن",
      }),
    ];
    expect(composeSuggestions("علي يضرب لاكن", issues)).toBe("علي يضرب لكن");
  });

  it("composes two non-overlapping fixes from the same translation", () => {
    const t = "بسم الله لاكن أنا";
    const issues = [
      baseIssue({
        key: k,
        translation: t,
        suggestion: "بسم الله لكن أنا",
        rule: "dict_common_typo",
        issue: "لاكن → لكن",
      }),
      baseIssue({
        key: k,
        translation: t,
        suggestion: "بسم الله لاكن انا",
        rule: "dict_hamza",
        issue: "أنا → انا",
        severity: "low",
      }),
    ];
    expect(composeSuggestions(t, issues)).toBe("بسم الله لكن انا");
  });

  it("skips a fix whose target was absorbed by an earlier fix", () => {
    const t = "abcdefg";
    const issues = [
      // First fix: c→Z, replacing the only "c" with "Z" → "abZdefg".
      baseIssue({
        key: k,
        translation: t,
        suggestion: "abZdefg",
        rule: "r1",
        issue: "c → Z",
      }),
      // Second fix: replace "cd" with "XY" but "cd" no longer occurs after
      // the first fix — composeSuggestions must skip rather than throw.
      baseIssue({
        key: k,
        translation: t,
        suggestion: "abXYefg",
        rule: "r2",
        issue: "cd → XY",
      }),
    ];
    expect(composeSuggestions(t, issues)).toBe("abZdefg");
  });

  it("ignores issues with no auto-fix (suggestion === translation)", () => {
    const issues = [
      baseIssue({
        key: k,
        translation: "نص",
        suggestion: "نص",
        rule: "manual",
        issue: "manual decision",
      }),
    ];
    expect(composeSuggestions("نص", issues)).toBe("نص");
  });
});

describe("groupIssuesByEntry", () => {
  it("groups issues by key and preserves seen order", () => {
    const issues = [
      baseIssue({
        key: "a:1",
        translation: "ت١",
        suggestion: "ت١",
        rule: "r",
        issue: "i1",
        severity: "low",
      }),
      baseIssue({
        key: "b:1",
        translation: "ت٢",
        suggestion: "ت٢",
        rule: "r",
        issue: "i2",
        severity: "high",
      }),
      baseIssue({
        key: "a:1",
        translation: "ت١",
        suggestion: "ت١",
        rule: "r",
        issue: "i3",
        severity: "high",
      }),
    ];
    const groups = groupIssuesByEntry(issues);
    // "a:1" was seen first but its top severity (high via i3) should sort it
    // ahead of b:1 (also high). Both are high → original order preserved.
    expect(groups.map((g) => g.key)).toEqual(["a:1", "b:1"]);
    expect(groups[0].issues).toHaveLength(2);
    expect(groups[1].issues).toHaveLength(1);
  });

  it("sorts groups by top severity (high first)", () => {
    const issues = [
      baseIssue({
        key: "low",
        translation: "x",
        suggestion: "x",
        rule: "r",
        issue: "i",
        severity: "low",
      }),
      baseIssue({
        key: "high",
        translation: "x",
        suggestion: "x",
        rule: "r",
        issue: "i",
        severity: "high",
      }),
      baseIssue({
        key: "medium",
        translation: "x",
        suggestion: "x",
        rule: "r",
        issue: "i",
        severity: "medium",
      }),
    ];
    const groups = groupIssuesByEntry(issues);
    expect(groups.map((g) => g.key)).toEqual(["high", "medium", "low"]);
  });

  it("sorts inner issues by severity within each group", () => {
    const issues = [
      baseIssue({
        key: "k",
        translation: "x",
        suggestion: "x",
        rule: "r",
        issue: "low",
        severity: "low",
      }),
      baseIssue({
        key: "k",
        translation: "x",
        suggestion: "x",
        rule: "r",
        issue: "high",
        severity: "high",
      }),
      baseIssue({
        key: "k",
        translation: "x",
        suggestion: "x",
        rule: "r",
        issue: "medium",
        severity: "medium",
      }),
    ];
    const [g] = groupIssuesByEntry(issues);
    expect(g.issues.map((i) => i.severity)).toEqual(["high", "medium", "low"]);
  });

  it("composes a unified suggestion for multi-issue groups", () => {
    const t = "علي يضرب لاكن أنا";
    const issues = [
      baseIssue({
        key: "k",
        translation: t,
        suggestion: "علي يضرب لكن أنا",
        rule: "dict_common_typo",
        issue: "لاكن → لكن",
      }),
      baseIssue({
        key: "k",
        translation: t,
        suggestion: "علي يضرب لاكن انا",
        rule: "dict_hamza",
        issue: "أنا → انا",
        severity: "low",
      }),
    ];
    const [g] = groupIssuesByEntry(issues);
    expect(g.unifiedSuggestion).toBe("علي يضرب لكن انا");
  });

  it("falls back to translation when no auto-fix is present", () => {
    const issues = [
      baseIssue({
        key: "k",
        translation: "نص",
        suggestion: "نص",
        rule: "manual",
        issue: "manual",
      }),
    ];
    const [g] = groupIssuesByEntry(issues);
    expect(g.unifiedSuggestion).toBe("نص");
  });
});
