import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, FileSearch, RefreshCw } from "lucide-react";
import type { UnifiedScanReport } from "@/lib/quality-lab-scanner";

interface StatsPanelProps {
  report: UnifiedScanReport;
  onReset: () => void;
}

const StatsPanel = ({ report, onReset }: StatsPanelProps) => {
  const { bySeverity, total, totalScanned, affectedEntries, byRule } = report;
  const cleanRate =
    totalScanned > 0
      ? Math.round(((totalScanned - affectedEntries) / totalScanned) * 100)
      : 0;

  const topRules = Object.entries(byRule)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <section className="px-4 max-w-6xl mx-auto w-full mb-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Stat
          icon={<FileSearch className="w-5 h-5" />}
          value={totalScanned}
          label="إدخال مفحوص"
          tone="primary"
        />
        <Stat
          icon={<AlertTriangle className="w-5 h-5" />}
          value={bySeverity.high}
          label="حرج"
          tone="destructive"
        />
        <Stat
          icon={<AlertCircle className="w-5 h-5" />}
          value={bySeverity.medium}
          label="متوسّط"
          tone="warning"
        />
        <Stat
          icon={<Info className="w-5 h-5" />}
          value={bySeverity.low}
          label="بسيط"
          tone="info"
        />
        <Stat
          icon={<span className="text-base font-display font-black">%</span>}
          value={`${cleanRate}%`}
          label="إدخالات سليمة"
          tone="success"
        />
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-border">
          <div>
            <div className="text-sm font-display font-bold">ملخّص الفحص</div>
            <div className="text-xs text-muted-foreground">
              {total} مشكلة موزّعة على {affectedEntries} إدخال
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={onReset} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            فحص جديد
          </Button>
        </div>
        {topRules.length > 0 && (
          <div className="p-4 sm:p-6">
            <div className="text-xs font-display font-bold text-muted-foreground mb-2">
              أكثر القواعد إطلاقاً
            </div>
            <div className="flex flex-wrap gap-2">
              {topRules.map(([rule, count]) => (
                <Badge
                  key={rule}
                  variant="secondary"
                  className="font-mono text-[10px] sm:text-xs"
                >
                  {ruleLabel(rule)} · {count}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const TONE_CLASSES: Record<string, string> = {
  primary: "border-primary/30 bg-primary/5 text-primary",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  warning: "border-orange-500/40 bg-orange-500/10 text-orange-400",
  info: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
};

const Stat = ({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  tone: keyof typeof TONE_CLASSES;
}) => (
  <div
    className={`relative rounded-xl border p-3 sm:p-4 backdrop-blur-sm ${TONE_CLASSES[tone]}`}
  >
    <div className="flex items-center justify-between mb-1.5">
      <div className="opacity-80">{icon}</div>
    </div>
    <div className="text-2xl sm:text-3xl font-display font-black leading-none">
      {value}
    </div>
    <div className="text-[10px] sm:text-xs mt-1 opacity-90">{label}</div>
  </div>
);

const RULE_LABELS: Record<string, string> = {
  double_space: "مسافات مكرّرة",
  space_before_punct: "مسافة قبل ترقيم",
  missing_space_after_punct: "مسافة ناقصة بعد ترقيم",
  no_space_after_punct: "مسافة ناقصة بعد ترقيم",
  tab_chars: "محارف Tab",
  leading_trailing: "مسافات أطراف",
  repeated_word: "كلمة مكرّرة",
  repeated_char: "حرف مكرّر",
  glued_scripts: "نصوص ملتصقة",
  missing_tags: "وسوم ناقصة",
  damaged_pua: "رموز PUA تالفة",
  ph_mismatch: "محدّدات مختلفة",
  unclosed_brackets: "أقواس غير مغلقة",
  byte_over: "تجاوز البايتات",
  punct_parity: "ترقيم غير متطابق",
  missing_terminal_punct: "نقطة أخيرة مفقودة",
  untranslated: "غير مترجم",
  verbatim_copy: "نسخ حرفي",
  common_untranslated: "كلمات شائعة غير مترجمة",
  hamza_pattern: "همزة شائعة",
  has_diacritics: "تشكيل",
  consistency: "اتساق المصطلحات",
  dict_hamza: "همزة (قاموس)",
  dict_ta_marbutah: "تاء مربوطة (قاموس)",
};

function ruleLabel(rule: string): string {
  return RULE_LABELS[rule] ?? rule;
}

export default StatsPanel;
