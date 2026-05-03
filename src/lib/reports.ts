// Report exporters for the Quality Lab.
// Outputs:
//   - CSV (issue table, Excel-ready)
//   - Markdown (human-readable)
//   - HTML (printable; user picks "Save as PDF" in browser print dialog)

import type { UnifiedScanReport } from "@/lib/quality-lab-scanner";
import type { LocalIssue } from "@/lib/local-enhance-scanner";

const escapeCSV = (s: string): string => {
  const v = s ?? "";
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
};

const SEVERITY_LABEL: Record<string, string> = {
  high: "حرجة",
  medium: "متوسّطة",
  low: "خفيفة",
};

export function issuesToCSV(issues: LocalIssue[], ruleLabels: Record<string, string>): string {
  const headers = [
    "key",
    "rule",
    "rule_label",
    "severity",
    "type",
    "issue",
    "reason",
    "original",
    "translation",
    "suggestion",
  ];
  const lines = [headers.join(",")];
  for (const it of issues) {
    lines.push(
      [
        it.key,
        it.rule,
        ruleLabels[it.rule] ?? it.rule,
        SEVERITY_LABEL[it.severity] ?? it.severity,
        it.type,
        it.issue,
        it.reason,
        it.original,
        it.translation,
        it.suggestion,
      ]
        .map(escapeCSV)
        .join(","),
    );
  }
  return "\uFEFF" + lines.join("\n");
}

export function reportToMarkdown(
  report: UnifiedScanReport,
  issues: LocalIssue[],
  ruleLabels: Record<string, string>,
): string {
  const lines: string[] = [];
  lines.push(`# تقرير مختبر جودة الترجمة`);
  lines.push("");
  lines.push(`- تاريخ التوليد: ${new Date().toLocaleString("ar")}`);
  lines.push(`- إجمالي الإدخالات المفحوصة: **${report.totalScanned}**`);
  lines.push(`- إدخالات بها مشاكل: **${report.affectedEntries}**`);
  lines.push(`- إجمالي المشاكل: **${report.total}**`);
  lines.push("");
  lines.push("## الخطورة");
  lines.push(`- حرجة: ${report.bySeverity.high}`);
  lines.push(`- متوسّطة: ${report.bySeverity.medium}`);
  lines.push(`- خفيفة: ${report.bySeverity.low}`);
  lines.push("");
  lines.push("## القواعد");
  const rules = Object.entries(report.byRule).sort((a, b) => b[1] - a[1]);
  for (const [r, c] of rules) {
    lines.push(`- ${ruleLabels[r] ?? r}: **${c}**`);
  }
  lines.push("");
  lines.push("## النتائج");
  for (const it of issues) {
    lines.push(`### \`${it.key}\` — ${ruleLabels[it.rule] ?? it.rule} · ${SEVERITY_LABEL[it.severity] ?? it.severity}`);
    lines.push(`**${it.issue}**`);
    lines.push("");
    lines.push(`> ${it.reason.replace(/\n/g, "\n> ")}`);
    lines.push("");
    lines.push(`- الأصل: \`${it.original}\``);
    lines.push(`- الترجمة: \`${it.translation}\``);
    if (it.suggestion && it.suggestion !== it.translation) {
      lines.push(`- المقترَح: \`${it.suggestion}\``);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function reportToHTML(
  report: UnifiedScanReport,
  issues: LocalIssue[],
  ruleLabels: Record<string, string>,
): string {
  const sevPill = (s: string) =>
    `<span class="pill pill-${s}">${SEVERITY_LABEL[s] ?? s}</span>`;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const items = issues
    .map(
      (it) => `
      <article class="issue">
        <header>
          <code>${esc(it.key)}</code>
          <span class="rule">${esc(ruleLabels[it.rule] ?? it.rule)}</span>
          ${sevPill(it.severity)}
        </header>
        <h3>${esc(it.issue)}</h3>
        <p class="reason">${esc(it.reason).replace(/\n/g, "<br/>")}</p>
        <dl>
          <dt>الأصل</dt><dd>${esc(it.original)}</dd>
          <dt>الترجمة</dt><dd>${esc(it.translation)}</dd>
          ${
            it.suggestion && it.suggestion !== it.translation
              ? `<dt>المقترَح</dt><dd class="suggestion">${esc(it.suggestion)}</dd>`
              : ""
          }
        </dl>
      </article>`,
    )
    .join("\n");

  const ruleRows = Object.entries(report.byRule)
    .sort((a, b) => b[1] - a[1])
    .map(([r, c]) => `<tr><th>${esc(ruleLabels[r] ?? r)}</th><td>${c}</td></tr>`)
    .join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>تقرير مختبر جودة الترجمة</title>
<style>
  body { font-family: "Tajawal", "Cairo", system-ui, sans-serif; line-height: 1.6; padding: 24px; color: #1a1a1a; background: #fff; }
  h1 { font-size: 26px; margin: 0 0 8px; }
  h2 { font-size: 20px; margin: 24px 0 8px; border-bottom: 2px solid #eee; padding-bottom: 4px; }
  .meta { color: #555; font-size: 13px; margin-bottom: 16px; }
  .stats { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .stat { background: #f4f4f4; border-radius: 8px; padding: 10px 14px; min-width: 120px; }
  .stat .v { font-size: 22px; font-weight: 700; }
  .stat .l { color: #666; font-size: 12px; }
  table.rules { width: 100%; border-collapse: collapse; font-size: 14px; }
  table.rules th, table.rules td { text-align: right; padding: 6px 8px; border-bottom: 1px solid #eee; }
  table.rules td { font-variant-numeric: tabular-nums; }
  article.issue { border: 1px solid #e6e6e6; border-radius: 12px; padding: 14px; margin: 10px 0; page-break-inside: avoid; }
  article.issue header { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 12px; color: #555; margin-bottom: 6px; }
  article.issue header code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; }
  article.issue header .rule { background: #fff7e6; color: #8b5a00; padding: 2px 8px; border-radius: 999px; }
  .pill { padding: 2px 8px; border-radius: 999px; font-size: 11px; }
  .pill-high { background: #fde2e1; color: #b00000; }
  .pill-medium { background: #fff4d6; color: #8b6500; }
  .pill-low { background: #e3f2e1; color: #2a6b29; }
  article.issue h3 { margin: 4px 0 6px; font-size: 15px; }
  article.issue .reason { background: #fafafa; border-radius: 8px; padding: 8px 10px; font-size: 13px; color: #444; margin: 6px 0 10px; }
  article.issue dl { margin: 0; display: grid; grid-template-columns: 80px 1fr; gap: 4px 10px; font-size: 13px; }
  article.issue dt { color: #888; }
  article.issue dd { margin: 0; }
  article.issue dd.suggestion { color: #2a6b29; font-weight: 600; }
  @media print {
    body { padding: 12px; }
    article.issue { break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>تقرير مختبر جودة الترجمة</h1>
  <div class="meta">${new Date().toLocaleString("ar")}</div>
  <div class="stats">
    <div class="stat"><div class="v">${report.totalScanned}</div><div class="l">إدخالات مفحوصة</div></div>
    <div class="stat"><div class="v">${report.affectedEntries}</div><div class="l">إدخالات بمشاكل</div></div>
    <div class="stat"><div class="v">${report.total}</div><div class="l">مشاكل</div></div>
    <div class="stat"><div class="v">${report.bySeverity.high}</div><div class="l">حرجة</div></div>
    <div class="stat"><div class="v">${report.bySeverity.medium}</div><div class="l">متوسّطة</div></div>
    <div class="stat"><div class="v">${report.bySeverity.low}</div><div class="l">خفيفة</div></div>
  </div>
  <h2>توزيع القواعد</h2>
  <table class="rules"><thead><tr><th>القاعدة</th><th>العدد</th></tr></thead><tbody>${ruleRows}</tbody></table>
  <h2>النتائج (${issues.length})</h2>
  ${items}
</body>
</html>`;
}

export function downloadString(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function openHTMLForPrint(html: string): void {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      // user can print manually
    }
  }, 500);
}
