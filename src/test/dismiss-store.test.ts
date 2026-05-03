import { describe, it, expect, beforeEach } from "vitest";
import {
  loadDismissedIssues,
  saveDismissedIssues,
  loadDismissedPatterns,
  saveDismissedPatterns,
  patternSignature,
  issueSignature,
} from "@/lib/dismiss-store";

beforeEach(() => {
  localStorage.clear();
});

describe("issueSignature / patternSignature", () => {
  it("issueSignature concatenates key|rule|issue", () => {
    expect(issueSignature("foo:1", "dict_hamza", "إلي → إلى")).toBe(
      "foo:1|dict_hamza|إلي → إلى",
    );
  });

  it("patternSignature concatenates rule|issue (trimmed)", () => {
    expect(patternSignature("dict_hamza", "  علي → على  ")).toBe(
      "dict_hamza|علي → على",
    );
  });

  it("identical issues produce identical signatures", () => {
    const a = issueSignature("k", "r", "i");
    const b = issueSignature("k", "r", "i");
    expect(a).toBe(b);
  });
});

describe("dismissed issues per file", () => {
  it("returns empty set when no entries saved", () => {
    expect(loadDismissedIssues("file.json").size).toBe(0);
  });

  it("round-trips a set of issue ids", () => {
    const ids = new Set(["a:1|r|i", "b:2|r|i"]);
    saveDismissedIssues("file.json", ids);
    const loaded = loadDismissedIssues("file.json");
    expect(loaded).toEqual(ids);
  });

  it("scopes by filename — different files do not share state", () => {
    saveDismissedIssues("a.json", new Set(["a:1|r|i"]));
    saveDismissedIssues("b.json", new Set(["b:1|r|i"]));
    expect(loadDismissedIssues("a.json")).toEqual(new Set(["a:1|r|i"]));
    expect(loadDismissedIssues("b.json")).toEqual(new Set(["b:1|r|i"]));
  });

  it("treats undefined filename as a stable bucket", () => {
    saveDismissedIssues(undefined, new Set(["x|r|i"]));
    expect(loadDismissedIssues(undefined)).toEqual(new Set(["x|r|i"]));
  });

  it("ignores non-array stored values", () => {
    localStorage.setItem("ql:dismissed-issues:v1:a", '"not an array"');
    expect(loadDismissedIssues("a").size).toBe(0);
  });
});

describe("dismissed patterns global", () => {
  it("returns empty set initially", () => {
    expect(loadDismissedPatterns().size).toBe(0);
  });

  it("round-trips patterns globally", () => {
    saveDismissedPatterns(new Set(["dict_hamza|إلي → إلى"]));
    expect(loadDismissedPatterns()).toEqual(new Set(["dict_hamza|إلي → إلى"]));
  });

  it("survives independent of issue storage", () => {
    saveDismissedPatterns(new Set(["r|i"]));
    saveDismissedIssues("a.json", new Set(["a:1|r|i"]));
    expect(loadDismissedPatterns()).toEqual(new Set(["r|i"]));
    expect(loadDismissedIssues("a.json")).toEqual(new Set(["a:1|r|i"]));
  });
});
