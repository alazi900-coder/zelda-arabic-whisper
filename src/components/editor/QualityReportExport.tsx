import React from "react";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

interface QualityReportExportProps {
  totalEntries: number;
  translatedCount: number;
  qualityStats: {
    total: number;
    tooShort: number;
    tooLong: number;
    stuck: number;
    mixed: number;
    duplicateTranslations: number;
    punctuationMismatch: number;
    unclosedBrackets: number;
  };
  categoryProgress: Record<string, { total: number; translated: number }>;
}

const QualityReportExport: React.FC<QualityReportExportProps> = ({
  totalEntries, translatedCount, qualityStats, categoryProgress,
}) => {
  const handleExport = () => {
    const percent = totalEntries > 0 ? Math.round((translatedCount / totalEntries) * 100) : 0;
    const categories = Object.entries(categoryProgress).map(([cat, data]) => {
      const p = data.total > 0 ? Math.round((data.translated / data.total) * 100) : 0;
      return `<tr><td>${cat}</td><td>${data.translated}/${data.total}</td><td><div class="bar"><div class="fill" style="width:${p}%"></div></div></td><td>${p}%</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>تقرير جودة الترجمة</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Tahoma,sans-serif;background:#0f1a12;color:#d4c9a8;padding:2rem;direction:rtl}
h1{color:#4ade80;margin-bottom:1rem;font-size:1.8rem}
h2{color:#eab308;margin:1.5rem 0 .75rem;font-size:1.2rem}
.card{background:#1a2e1f;border:1px solid #2d4a35;border-radius:12px;padding:1.25rem;margin-bottom:1rem}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem}
.stat{text-align:center;padding:1rem;background:#0f1a12;border-radius:8px;border:1px solid #2d4a35}
.stat .num{font-size:1.8rem;font-weight:bold;color:#4ade80}
.stat .label{font-size:.75rem;color:#9ca3af;margin-top:.25rem}
.stat.warn .num{color:#eab308}
.stat.danger .num{color:#ef4444}
table{width:100%;border-collapse:collapse;margin-top:.5rem}
th,td{padding:.5rem .75rem;text-align:right;border-bottom:1px solid #2d4a35;font-size:.85rem}
th{color:#9ca3af;font-weight:600}
.bar{width:100%;height:8px;background:#2d4a35;border-radius:4px;overflow:hidden}
.fill{height:100%;background:linear-gradient(90deg,#4ade80,#22c55e);border-radius:4px}
.progress-main{width:100%;height:20px;background:#2d4a35;border-radius:10px;overflow:hidden;margin:.75rem 0}
.progress-main .fill{height:100%;background:linear-gradient(90deg,#4ade80,#eab308);transition:width .3s}
footer{text-align:center;margin-top:2rem;color:#6b7280;font-size:.75rem}
</style>
</head>
<body>
<h1>📊 تقرير جودة الترجمة</h1>
<p style="color:#9ca3af;margin-bottom:1rem">تم الإنشاء: ${new Date().toLocaleDateString('ar-SA')} ${new Date().toLocaleTimeString('ar-SA')}</p>

<div class="card">
<h2>📈 نسبة الإنجاز</h2>
<div class="progress-main"><div class="fill" style="width:${percent}%"></div></div>
<p style="text-align:center;font-size:1.5rem;font-weight:bold;color:#4ade80">${percent}%</p>
<p style="text-align:center;color:#9ca3af">${translatedCount} من ${totalEntries} نص</p>
</div>

<div class="card">
<h2>⚠️ مشاكل الجودة</h2>
<div class="stats">
<div class="stat ${qualityStats.total > 0 ? 'warn' : ''}"><div class="num">${qualityStats.total}</div><div class="label">إجمالي المشاكل</div></div>
<div class="stat ${qualityStats.tooShort > 0 ? 'warn' : ''}"><div class="num">${qualityStats.tooShort}</div><div class="label">📏 قصيرة جداً</div></div>
<div class="stat ${qualityStats.tooLong > 0 ? 'danger' : ''}"><div class="num">${qualityStats.tooLong}</div><div class="label">📐 طويلة جداً</div></div>
<div class="stat ${qualityStats.stuck > 0 ? 'warn' : ''}"><div class="num">${qualityStats.stuck}</div><div class="label">🔤 أحرف ملتصقة</div></div>
<div class="stat ${qualityStats.mixed > 0 ? 'warn' : ''}"><div class="num">${qualityStats.mixed}</div><div class="label">🌐 لغة مختلطة</div></div>
<div class="stat"><div class="num">${qualityStats.duplicateTranslations}</div><div class="label">🔁 مكررة</div></div>
<div class="stat"><div class="num">${qualityStats.punctuationMismatch}</div><div class="label">❓ ترقيم</div></div>
<div class="stat"><div class="num">${qualityStats.unclosedBrackets}</div><div class="label">🔓 أقواس مفتوحة</div></div>
</div>
</div>

<div class="card">
<h2>📂 تقدم الفئات</h2>
<table><thead><tr><th>الفئة</th><th>التقدم</th><th>الشريط</th><th>النسبة</th></tr></thead><tbody>${categories}</tbody></table>
</div>

<footer>أداة تعريب زيلدا — تقرير تم إنشاؤه آلياً</footer>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quality-report-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="font-body text-xs">
      <FileDown className="w-3 h-3" /> تقرير HTML
    </Button>
  );
};

export default QualityReportExport;
