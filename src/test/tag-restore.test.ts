import { describe, it, expect } from "vitest";
import {
  restoreLineBreaks,
  restoreTagsAndLineBreaks,
  normalizeLineBreakRepresentations,
  scanTranslationsForRestore,
  buildRestoreUpdates,
} from "@/lib/tag-restore";

describe("normalizeLineBreakRepresentations", () => {
  it("converts <br>, <br/>, <br /> to real newlines", () => {
    expect(normalizeLineBreakRepresentations("a<br>b<br/>c<br />d")).toBe("a\nb\nc\nd");
    expect(normalizeLineBreakRepresentations("a<BR>b")).toBe("a\nb");
  });
  it("converts literal backslash-n to real newline", () => {
    expect(normalizeLineBreakRepresentations("a\\nb\\nc")).toBe("a\nb\nc");
  });
  it("normalizes CRLF and CR to LF", () => {
    expect(normalizeLineBreakRepresentations("a\r\nb\rc")).toBe("a\nb\nc");
  });
  it("leaves real \\n untouched", () => {
    expect(normalizeLineBreakRepresentations("a\nb")).toBe("a\nb");
  });
});

describe("restoreLineBreaks", () => {
  it("returns translation unchanged when both have same line count", () => {
    const original = "Line one\nLine two";
    const translation = "السطر الأول\nالسطر الثاني";
    expect(restoreLineBreaks(original, translation)).toBe(translation);
  });

  it("returns translation unchanged when original has a single line", () => {
    expect(restoreLineBreaks("Hello world", "مرحبا بالعالم")).toBe("مرحبا بالعالم");
  });

  it("splits merged translation back into the expected number of lines", () => {
    const original = "First sentence.\nSecond sentence.";
    const translation = "الجملة الأولى. الجملة الثانية.";
    const out = restoreLineBreaks(original, translation);
    expect(out.split("\n").length).toBe(2);
  });

  it("splits at punctuation when AI dropped newlines", () => {
    const original = "Press A to confirm.\nPress B to cancel.";
    const translation = "اضغط A للتأكيد، اضغط B للإلغاء";
    const out = restoreLineBreaks(original, translation);
    expect(out.split("\n").length).toBe(2);
    expect(out.split("\n")[0]).toMatch(/تأكيد/);
  });

  it("converts <br> and \\n literals even when partially split", () => {
    const original = "A\nB";
    const translation = "أ<br>ب";
    const out = restoreLineBreaks(original, translation);
    expect(out).toBe("أ\nب");
  });

  it("does not guess when translation is partially split (avoids over-fitting)", () => {
    const original = "A\nB\nC";
    const translation = "أ\nب ج"; // partial — 2 lines, not 3
    const out = restoreLineBreaks(original, translation);
    expect(out).toBe("أ\nب ج");
  });

  it("handles 3-line originals merged into one", () => {
    const original = "One.\nTwo.\nThree.";
    const translation = "واحد. اثنان. ثلاثة.";
    const out = restoreLineBreaks(original, translation);
    expect(out.split("\n").length).toBe(3);
  });

  it("preserves PUA tags through the split", () => {
    const original = "Press \uE000.\nDone.";
    const translation = "اضغط \uE000. تم.";
    const out = restoreLineBreaks(original, translation);
    expect(out.split("\n").length).toBe(2);
    expect(out).toContain("\uE000");
  });
});

describe("restoreTagsAndLineBreaks (composite)", () => {
  it("restores both missing PUA markers and missing line breaks", () => {
    const original = "Press \uE000 to confirm.\nPress \uE001 to cancel.";
    const translation = "اضغط للتأكيد. اضغط للإلغاء.";
    const out = restoreTagsAndLineBreaks(original, translation);
    expect(out).toContain("\uE000");
    expect(out).toContain("\uE001");
    expect(out.split("\n").length).toBe(2);
  });

  it("leaves clean translations untouched", () => {
    const original = "Hello world";
    const translation = "مرحبا بالعالم";
    expect(restoreTagsAndLineBreaks(original, translation)).toBe(translation);
  });

  it("handles empty translation safely", () => {
    expect(restoreTagsAndLineBreaks("Hello \uE000", "")).toBe("");
  });

  it("normalizes <br> and literal \\n before restoring tags", () => {
    const original = "A\nB \uE000";
    const translation = "أ<br>ب";
    const out = restoreTagsAndLineBreaks(original, translation);
    expect(out.split("\n").length).toBe(2);
    expect(out).toContain("\uE000");
  });

  it("does not double-insert tags that are already present", () => {
    const original = "Hello \uE000 world \uE001";
    const translation = "مرحبا \uE000 عالم \uE001";
    const out = restoreTagsAndLineBreaks(original, translation);
    const e000Count = (out.match(/\uE000/g) || []).length;
    const e001Count = (out.match(/\uE001/g) || []).length;
    expect(e000Count).toBe(1);
    expect(e001Count).toBe(1);
  });
});

describe("scanTranslationsForRestore", () => {
  const entries = [
    { msbtFile: "F1.msbt", index: 0, label: "a", original: "Press \uE000 to start.\nGo." },
    { msbtFile: "F1.msbt", index: 1, label: "b", original: "Hello \uE001" },
    { msbtFile: "F2.msbt", index: 0, label: "c", original: "Clean" },
  ];

  it("flags entries that lose tags or line breaks", () => {
    const translations = {
      "F1.msbt:0": "اضغط للبدء. اذهب.",         // missing tag + missing line break
      "F1.msbt:1": "مرحبا",                       // missing tag
      "F2.msbt:0": "نظيف",                        // clean — should not be flagged
    };
    const report = scanTranslationsForRestore(entries, translations);
    expect(report.scanned).toBe(3);
    expect(report.fixable).toBe(2);
    expect(report.byFile["F1.msbt"]).toBe(2);
    expect(report.byFile["F2.msbt"]).toBeUndefined();
    expect(report.examples.length).toBeGreaterThan(0);
  });

  it("returns zero fixable for already-clean translations", () => {
    const translations = {
      "F1.msbt:0": "اضغط \uE000 للبدء.\nاذهب.",
      "F1.msbt:1": "مرحبا \uE001",
      "F2.msbt:0": "نظيف",
    };
    const report = scanTranslationsForRestore(entries, translations);
    expect(report.fixable).toBe(0);
  });

  it("skips empty translations", () => {
    const translations = { "F1.msbt:0": "", "F1.msbt:1": "   " };
    const report = scanTranslationsForRestore(entries, translations);
    expect(report.scanned).toBe(0);
    expect(report.fixable).toBe(0);
  });
});

describe("buildRestoreUpdates", () => {
  it("returns updates only for entries that actually change", () => {
    const entries = [
      { msbtFile: "F1.msbt", index: 0, original: "Press \uE000.\nGo." },
      { msbtFile: "F1.msbt", index: 1, original: "Clean" },
    ];
    const translations = {
      "F1.msbt:0": "اضغط. اذهب.", // needs both restore
      "F1.msbt:1": "نظيف",
    };
    const { updates, previous } = buildRestoreUpdates(entries, translations);
    expect(Object.keys(updates)).toEqual(["F1.msbt:0"]);
    expect(Object.keys(previous)).toEqual(["F1.msbt:0"]);
    expect(updates["F1.msbt:0"]).toContain("\uE000");
    expect(updates["F1.msbt:0"].split("\n").length).toBe(2);
  });
});
