import { describe, it, expect } from "vitest";
import {
  restoreLineBreaks,
  restoreTagsAndLineBreaks,
  normalizeLineBreakRepresentations,
  scanTranslationsForRestore,
  buildRestoreUpdates,
  smartReorderTags,
  buildSmartReorderUpdates,
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
    const translation = "أ\nب ج";
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

describe("scanTranslationsForRestore — auto vs review classification", () => {
  const entries = [
    { msbtFile: "F1.msbt", index: 0, label: "a", original: "Press \uE000 to start.\nGo." },
    { msbtFile: "F1.msbt", index: 1, label: "b", original: "Hello \uE001" },
    { msbtFile: "F2.msbt", index: 0, label: "c", original: "Clean" },
  ];

  it("flags entries that lose tags or line breaks as auto-fixable", () => {
    const translations = {
      "F1.msbt:0": "اضغط للبدء. اذهب.",
      "F1.msbt:1": "مرحبا",
      "F2.msbt:0": "نظيف",
    };
    const report = scanTranslationsForRestore(entries, translations);
    expect(report.scanned).toBe(3);
    expect(report.autoFixable).toBe(2);
    expect(report.needsReview).toBe(0);
    expect(report.byFile["F1.msbt"]).toBe(2);
    expect(report.byFile["F2.msbt"]).toBeUndefined();
    expect(report.autoExamples.length).toBeGreaterThan(0);
    expect(report.fixable).toBe(2);
  });

  it("returns zero for already-clean translations", () => {
    const translations = {
      "F1.msbt:0": "اضغط \uE000 للبدء.\nاذهب.",
      "F1.msbt:1": "مرحبا \uE001",
      "F2.msbt:0": "نظيف",
    };
    const report = scanTranslationsForRestore(entries, translations);
    expect(report.autoFixable).toBe(0);
    expect(report.needsReview).toBe(0);
  });

  it("skips empty translations", () => {
    const translations = { "F1.msbt:0": "", "F1.msbt:1": "   " };
    const report = scanTranslationsForRestore(entries, translations);
    expect(report.scanned).toBe(0);
    expect(report.autoFixable).toBe(0);
    expect(report.needsReview).toBe(0);
  });

  it("flags partial line-count mismatches as 'review' (not auto)", () => {
    // الأصل 3 أسطر، الترجمة 2 أسطر → لا نخمّن آلياً.
    const e = [{ msbtFile: "F.msbt", index: 0, label: "x", original: "A\nB\nC" }];
    const t = { "F.msbt:0": "أ\nب ج" };
    const report = scanTranslationsForRestore(e, t);
    expect(report.autoFixable).toBe(0);
    expect(report.needsReview).toBe(1);
    expect(report.reviewExamples[0].reasons.missingLineBreaksPartial).toBeGreaterThan(0);
    expect(report.reviewExamples[0].reasons.missingLineBreaksAuto).toBe(0);
  });

  it("flags tag-identity mismatches as 'review' even when counts match", () => {
    // نفس عدد الرموز ولكنّ القيم مختلفة → للمراجعة.
    const e = [{ msbtFile: "F.msbt", index: 0, label: "x", original: "Press \uE001 \uE002" }];
    const t = { "F.msbt:0": "اضغط \uE034 \uE002" };
    const report = scanTranslationsForRestore(e, t);
    expect(report.autoFixable).toBe(0);
    expect(report.needsReview).toBe(1);
    expect(report.reviewExamples[0].reasons.changedTagPositions).toBeGreaterThan(0);
  });

  it("flags extra tags (added by AI) as 'review'", () => {
    const e = [{ msbtFile: "F.msbt", index: 0, label: "x", original: "Hello" }];
    const t = { "F.msbt:0": "مرحبا \uE001" };
    const report = scanTranslationsForRestore(e, t);
    expect(report.needsReview).toBe(1);
    expect(report.reviewExamples[0].reasons.extraTags).toBe(1);
  });

  it("matches user-reported Simmerstone Springs case: partial line mismatch is detected", () => {
    // اقتباس مباشر من بلاغ المستخدم.
    const original =
      "Don't tell me you've never heard of\nSimmerstone Springs!\n\nWhat? Really?\n\n\nEh...I mean...if I'm bein' honest, I guess \nI don't really know that much about\nthe place either.";
    const translation =
      "لا تقل لي إنك لم تسمع عن ينابيع\nسيمرستون من قبل!\n ماذا؟\n حقاً؟\n أوه.\n..\n أعني...بصراحة،\nأظن أنني لا أعرف الكثير عن المكان أيضاً.";
    const e = [{ msbtFile: "Talk.msbt", index: 0, label: "Simmerstone", original }];
    const t = { "Talk.msbt:0": translation };
    const report = scanTranslationsForRestore(e, t);
    // الأصل فيه أسطر فارغة (فواصل فقرة) لا توجد في الترجمة → يجب الكشف عنها.
    expect(report.needsReview + report.autoFixable).toBeGreaterThan(0);
    // والترجمة مقسّمة جزئياً (لا سطر واحد) → لا نخمّن آلياً، نعرضها للمراجعة.
    expect(report.needsReview).toBe(1);
    expect(report.autoFixable).toBe(0);
  });
});

describe("buildRestoreUpdates", () => {
  it("returns updates only for entries that actually change", () => {
    const entries = [
      { msbtFile: "F1.msbt", index: 0, original: "Press \uE000.\nGo." },
      { msbtFile: "F1.msbt", index: 1, original: "Clean" },
    ];
    const translations = {
      "F1.msbt:0": "اضغط. اذهب.",
      "F1.msbt:1": "نظيف",
    };
    const { updates, previous } = buildRestoreUpdates(entries, translations);
    expect(Object.keys(updates)).toEqual(["F1.msbt:0"]);
    expect(Object.keys(previous)).toEqual(["F1.msbt:0"]);
    expect(updates["F1.msbt:0"]).toContain("\uE000");
    expect(updates["F1.msbt:0"].split("\n").length).toBe(2);
  });

  it("does NOT auto-modify partial line-count mismatches (those require manual review)", () => {
    const entries = [{ msbtFile: "F.msbt", index: 0, original: "A\nB\nC" }];
    const translations = { "F.msbt:0": "أ\nب ج" };
    const { updates } = buildRestoreUpdates(entries, translations);
    expect(Object.keys(updates).length).toBe(0);
  });
});

describe("smartReorderTags", () => {
  it("reorders tags to match the original sequence when counts match but values/order differ", () => {
    const original = "Press \uE001 then \uE002 to confirm.";
    const translation = "اضغط \uE002 ثمّ \uE001 للتأكيد.";
    const out = smartReorderTags(original, translation);
    // النتيجة يجب أن تطابق ترتيب الأصل: E001 ثم E002.
    const idx1 = out.indexOf("\uE001");
    const idx2 = out.indexOf("\uE002");
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(-1);
    expect(idx1).toBeLessThan(idx2);
  });

  it("replaces wrong tag values with the originals when count matches", () => {
    const original = "Hello \uE001 world \uE002";
    const translation = "مرحبا \uE034 عالم \uE002";
    const out = smartReorderTags(original, translation);
    expect(out).toContain("\uE001");
    expect(out).toContain("\uE002");
    expect(out).not.toContain("\uE034");
  });

  it("returns translation unchanged when tag count differs", () => {
    const original = "Press \uE001 then \uE002";
    const translation = "اضغط \uE001"; // رمز واحد فقط
    expect(smartReorderTags(original, translation)).toBe(translation);
  });

  it("returns translation unchanged when tags already match", () => {
    const original = "Hello \uE001 world \uE002";
    const translation = "مرحبا \uE001 عالم \uE002";
    expect(smartReorderTags(original, translation)).toBe(translation);
  });

  it("returns translation unchanged when there are no tags", () => {
    expect(smartReorderTags("Hello world", "مرحبا بالعالم")).toBe("مرحبا بالعالم");
  });

  it("does NOT modify line breaks", () => {
    const original = "Press \uE001\nthen \uE002";
    const translation = "اضغط \uE002 ثمّ \uE001"; // سطر واحد بدل سطرين
    const out = smartReorderTags(original, translation);
    // ترتيب الرموز يجب أن يتطابق، لكنّ الأسطر تبقى كما هي.
    expect(out.split("\n").length).toBe(1);
    expect(out.indexOf("\uE001")).toBeLessThan(out.indexOf("\uE002"));
  });

  it("handles empty inputs safely", () => {
    expect(smartReorderTags("", "abc")).toBe("abc");
    expect(smartReorderTags("abc", "")).toBe("");
  });
});

describe("buildSmartReorderUpdates", () => {
  it("returns updates only for entries with reorderable tags", () => {
    const entries = [
      { msbtFile: "F.msbt", index: 0, original: "Press \uE001 then \uE002" },
      { msbtFile: "F.msbt", index: 1, original: "Clean text" },
      { msbtFile: "F.msbt", index: 2, original: "Already \uE003 correct \uE004" },
    ];
    const translations = {
      "F.msbt:0": "اضغط \uE002 ثمّ \uE001", // ترتيب معكوس → سيُصلَح
      "F.msbt:1": "نص نظيف",                    // لا رموز → لا تغيير
      "F.msbt:2": "صحيح \uE003 مسبقاً \uE004",   // مطابق → لا تغيير
    };
    const { updates, previous } = buildSmartReorderUpdates(entries, translations);
    expect(Object.keys(updates)).toEqual(["F.msbt:0"]);
    expect(Object.keys(previous)).toEqual(["F.msbt:0"]);
    expect(previous["F.msbt:0"]).toBe(translations["F.msbt:0"]);
    expect(updates["F.msbt:0"].indexOf("\uE001")).toBeLessThan(updates["F.msbt:0"].indexOf("\uE002"));
  });

  it("skips entries where tag count differs (those need manual review)", () => {
    const entries = [
      { msbtFile: "F.msbt", index: 0, original: "Press \uE001 then \uE002" },
    ];
    const translations = {
      "F.msbt:0": "اضغط \uE001", // رمز واحد بدل اثنين
    };
    const { updates } = buildSmartReorderUpdates(entries, translations);
    expect(Object.keys(updates).length).toBe(0);
  });

  it("skips empty translations", () => {
    const entries = [
      { msbtFile: "F.msbt", index: 0, original: "Press \uE001 then \uE002" },
    ];
    const translations = { "F.msbt:0": "" };
    const { updates } = buildSmartReorderUpdates(entries, translations);
    expect(Object.keys(updates).length).toBe(0);
  });
});
