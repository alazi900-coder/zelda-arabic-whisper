import { describe, it, expect } from "vitest";
import {
  aggregateBulkPatterns,
  applyBulkPatterns,
  type BulkPatternGroup,
} from "@/lib/bulk-suggestions";
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

describe("aggregateBulkPatterns", () => {
  it("returns empty array for empty input", () => {
    expect(aggregateBulkPatterns([])).toEqual([]);
  });

  it("groups identical (rule, wrong, right) across entries even when surrounding context differs", () => {
    const issues = [
      baseIssue({
        key: "a:1",
        translation: "هذا لاكن صعب",
        suggestion: "هذا لكن صعب",
        rule: "dict_common_typo",
        issue: "لاكن → لكن",
      }),
      baseIssue({
        key: "b:2",
        translation: "أحب لاكن أكره",
        suggestion: "أحب لكن أكره",
        rule: "dict_common_typo",
        issue: "لاكن → لكن",
      }),
      baseIssue({
        key: "c:3",
        translation: "نعم لاكن لا",
        suggestion: "نعم لكن لا",
        rule: "dict_common_typo",
        issue: "لاكن → لكن",
      }),
    ];
    const groups = aggregateBulkPatterns(issues);
    expect(groups).toHaveLength(1);
    expect(groups[0].rule).toBe("dict_common_typo");
    expect(groups[0].count).toBe(3);
    expect(groups[0].entries.map((e) => e.key)).toEqual(["a:1", "b:2", "c:3"]);
    // Each entry's anchored patch must round-trip when applied to its own
    // translation (the minimal diff alone may not, since it can be
    // ambiguous within the surrounding text).
    for (const e of groups[0].entries) {
      const idx = e.translation.indexOf(e.anchoredWrong);
      expect(idx).toBeGreaterThanOrEqual(0);
      const applied =
        e.translation.slice(0, idx) +
        e.anchoredRight +
        e.translation.slice(idx + e.anchoredWrong.length);
      expect(applied).toBe(e.suggestion);
    }
  });

  it("keeps separate groups when rules differ", () => {
    const issues = [
      baseIssue({
        key: "a",
        translation: "هذا لاكن صعب",
        suggestion: "هذا لكن صعب",
        rule: "dict_common_typo",
        issue: "لاكن → لكن",
      }),
      baseIssue({
        key: "a",
        translation: "هذا لاكن صعب",
        suggestion: "هذا لكن صعب",
        rule: "dict_hamza",
        issue: "لاكن → لكن",
      }),
    ];
    const groups = aggregateBulkPatterns(issues);
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((g) => g.rule))).toEqual(
      new Set(["dict_common_typo", "dict_hamza"]),
    );
  });

  it("merges issues with the same minimal diff regardless of surrounding text", () => {
    const make = (key: string, translation: string, suggestion: string) =>
      baseIssue({
        key,
        translation,
        suggestion,
        rule: "dict_hamza",
        issue: `${translation} → ${suggestion}`,
      });
    // Both "أنا → انا" and "أكتب → اكتب" share the same minimal diff
    // (أ → ا), so they collapse into a single bulk group.
    const issues = [
      make("a:1", "أنا هنا", "انا هنا"),
      make("a:2", "أنا هناك", "انا هناك"),
      make("b:1", "أكتب نص", "اكتب نص"),
      make("b:2", "أكتب رواية", "اكتب رواية"),
      make("b:3", "أكتب قصيدة", "اكتب قصيدة"),
    ];
    const groups = aggregateBulkPatterns(issues);
    expect(groups).toHaveLength(1);
    expect(groups[0].wrong).toBe("أ");
    expect(groups[0].right).toBe("ا");
    expect(groups[0].count).toBe(5);
  });

  it("sorts groups by count descending", () => {
    const make = (
      key: string,
      translation: string,
      suggestion: string,
      rule: string,
    ) =>
      baseIssue({
        key,
        translation,
        suggestion,
        rule,
        issue: `${translation} → ${suggestion}`,
      });
    const issues = [
      // Rule A: "لاكن → لكن" appears twice.
      make("a:1", "هذا لاكن صعب", "هذا لكن صعب", "dict_common_typo"),
      make("a:2", "نعم لاكن لا", "نعم لكن لا", "dict_common_typo"),
      // Rule B: "أ → ا" appears five times.
      make("b:1", "أنا هنا", "انا هنا", "dict_hamza"),
      make("b:2", "أنا هناك", "انا هناك", "dict_hamza"),
      make("b:3", "أكتب نص", "اكتب نص", "dict_hamza"),
      make("b:4", "أكتب رواية", "اكتب رواية", "dict_hamza"),
      make("b:5", "أكتب قصيدة", "اكتب قصيدة", "dict_hamza"),
    ];
    const groups = aggregateBulkPatterns(issues);
    expect(groups[0].count).toBe(5);
    expect(groups[1].count).toBe(2);
  });

  it("excludes issues without a usable patch", () => {
    const issues = [
      baseIssue({
        key: "k",
        translation: "x",
        suggestion: "x",
        rule: "manual",
        issue: "manual",
      }),
    ];
    expect(aggregateBulkPatterns(issues)).toHaveLength(0);
  });
});

describe("applyBulkPatterns", () => {
  const makeGroup = (
    id: string,
    rule: string,
    wrong: string,
    right: string,
    entries: Array<{
      key: string;
      translation: string;
      suggestion: string;
      anchoredWrong: string;
      anchoredRight: string;
    }>,
  ): BulkPatternGroup => ({
    id,
    rule,
    wrong,
    right,
    count: entries.length,
    topSeverity: "medium",
    entries,
  });

  it("applies a single pattern to every matching entry", () => {
    const groups = [
      makeGroup("g1", "dict_common_typo", "ا", "", [
        {
          key: "a",
          translation: "هذا لاكن صعب",
          suggestion: "هذا لكن صعب",
          anchoredWrong: "لاك",
          anchoredRight: "لك",
        },
        {
          key: "b",
          translation: "نعم لاكن لا",
          suggestion: "نعم لكن لا",
          anchoredWrong: "لاك",
          anchoredRight: "لك",
        },
      ]),
    ];
    const cur = new Map([
      ["a", "هذا لاكن صعب"],
      ["b", "نعم لاكن لا"],
      ["c", "بدون مشكلة"],
    ]);
    const out = applyBulkPatterns(groups, cur);
    expect(out.applied).toBe(2);
    expect(out.skipped).toBe(0);
    expect(out.updates.size).toBe(2);
    expect(out.updates.get("a")).toBe("هذا لكن صعب");
    expect(out.updates.get("b")).toBe("نعم لكن لا");
    expect(out.updates.has("c")).toBe(false);
  });

  it("composes two non-overlapping patterns on the same entry", () => {
    const groups = [
      makeGroup("g1", "dict_common_typo", "ا", "", [
        {
          key: "a",
          translation: "علي لاكن أنا",
          suggestion: "علي لكن أنا",
          anchoredWrong: "لاك",
          anchoredRight: "لك",
        },
      ]),
      makeGroup("g2", "dict_hamza", "أ", "ا", [
        {
          key: "a",
          translation: "علي لاكن أنا",
          suggestion: "علي لاكن انا",
          anchoredWrong: "أ",
          anchoredRight: "ا",
        },
      ]),
    ];
    const cur = new Map([["a", "علي لاكن أنا"]]);
    const out = applyBulkPatterns(groups, cur);
    expect(out.applied).toBe(2);
    expect(out.updates.get("a")).toBe("علي لكن انا");
  });

  it("skips a pattern whose wrong was already absorbed", () => {
    const groups = [
      makeGroup("g1", "r1", "abc", "XYZ", [
        {
          key: "a",
          translation: "abc def",
          suggestion: "XYZ def",
          anchoredWrong: "abc",
          anchoredRight: "XYZ",
        },
      ]),
      makeGroup("g2", "r2", "ab", "QQ", [
        {
          key: "a",
          translation: "abc def",
          suggestion: "QQc def",
          anchoredWrong: "ab",
          anchoredRight: "QQ",
        },
      ]),
    ];
    const cur = new Map([["a", "abc def"]]);
    const out = applyBulkPatterns(groups, cur);
    expect(out.applied).toBe(1);
    expect(out.skipped).toBe(1);
    expect(out.updates.get("a")).toBe("XYZ def");
  });
});
