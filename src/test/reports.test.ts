import { describe, it, expect } from "vitest";
import { issuesToCSV, reportToMarkdown, reportToHTML } from "@/lib/reports";
import type { LocalIssue } from "@/lib/local-enhance-scanner";
import type { UnifiedScanReport } from "@/lib/quality-lab-scanner";

const issues: LocalIssue[] = [
  {
    key: "msg/1",
    original: "Defeat the Bokoblin.",
    translation: "اهزم Bokoblin.",
    suggestion: "اهزم البوكوبلين.",
    issue: "اسم علم لم يُترجم",
    reason: "اسم Bokoblin ظهر في الأصل ولم يُحوَّل لصيغة عربية مقبولة.",
    severity: "high",
    type: "terminology",
    rule: "dict_proper_noun",
  },
  {
    key: "msg/2",
    original: "Press A to talk.",
    translation: "اضغط  A للتحدث",
    suggestion: "اضغط A للتحدث",
    issue: "مسافات مكرّرة",
    reason: "مسافتان متتاليتان.",
    severity: "low",
    type: "punctuation",
    rule: "double_space",
  },
];

const report: UnifiedScanReport = {
  issues,
  bySeverity: { high: 1, medium: 0, low: 1 },
  byRule: { dict_proper_noun: 1, double_space: 1 },
  byType: { terminology: 1, punctuation: 1 },
  affectedEntries: 2,
  totalScanned: 2,
  total: 2,
};

const labels: Record<string, string> = {
  dict_proper_noun: "اسم علم",
  double_space: "مسافات مكرّرة",
};

describe("reports — CSV", () => {
  it("includes a UTF-8 BOM for Excel", () => {
    const csv = issuesToCSV(issues, labels);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("escapes commas, quotes, and newlines", () => {
    const csv = issuesToCSV(
      [
        {
          ...issues[0],
          translation: 'has "quote", comma\nand newline',
        },
      ],
      labels,
    );
    expect(csv).toContain('"has ""quote"", comma\nand newline"');
  });

  it("includes one row per issue plus header", () => {
    const csv = issuesToCSV(issues, labels);
    const lines = csv.split("\n");
    expect(lines.length).toBe(issues.length + 1);
  });
});

describe("reports — Markdown", () => {
  it("contains stats and per-issue sections", () => {
    const md = reportToMarkdown(report, issues, labels);
    expect(md).toContain("# تقرير مختبر جودة الترجمة");
    expect(md).toContain("`msg/1`");
    expect(md).toContain("`msg/2`");
    expect(md).toContain("اسم علم");
    expect(md).toContain("Defeat the Bokoblin");
  });

  it("includes the suggestion when it differs from the translation", () => {
    const md = reportToMarkdown(report, issues, labels);
    expect(md).toContain("المقترَح");
  });
});

describe("reports — HTML", () => {
  it("returns a full RTL Arabic HTML document", () => {
    const html = reportToHTML(report, issues, labels);
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain("تقرير مختبر جودة الترجمة");
    expect(html).toContain("Defeat the Bokoblin");
  });

  it("includes severity pill class names", () => {
    const html = reportToHTML(report, issues, labels);
    expect(html).toContain("pill-high");
    expect(html).toContain("pill-low");
  });

  it("HTML-escapes user content", () => {
    const html = reportToHTML(
      report,
      [{ ...issues[0], original: "<script>alert(1)</script>" }],
      labels,
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
