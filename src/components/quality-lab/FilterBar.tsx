import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export type SeverityFilter = "all" | "high" | "medium" | "low";
export type FixFilter = "all" | "fixable" | "manual";

interface FilterBarProps {
  total: number;
  filtered: number;

  search: string;
  onSearch: (s: string) => void;

  severity: SeverityFilter;
  onSeverity: (s: SeverityFilter) => void;

  rule: string;
  onRule: (r: string) => void;
  ruleOptions: Array<{ value: string; label: string; count: number }>;

  fix: FixFilter;
  onFix: (f: FixFilter) => void;

  onClearAll: () => void;
}

const SEVERITY_OPTIONS: Array<{ value: SeverityFilter; label: string; tone: string }> = [
  { value: "all", label: "الكل", tone: "border-border" },
  { value: "high", label: "حرج", tone: "border-destructive/40 text-destructive" },
  { value: "medium", label: "متوسّط", tone: "border-orange-500/40 text-orange-400" },
  { value: "low", label: "بسيط", tone: "border-blue-500/40 text-blue-400" },
];

const FIX_OPTIONS: Array<{ value: FixFilter; label: string }> = [
  { value: "all", label: "الكل" },
  { value: "fixable", label: "قابل للإصلاح" },
  { value: "manual", label: "يدوي فقط" },
];

const FilterBar = ({
  total,
  filtered,
  search,
  onSearch,
  severity,
  onSeverity,
  rule,
  onRule,
  ruleOptions,
  fix,
  onFix,
  onClearAll,
}: FilterBarProps) => {
  const isFiltered = total !== filtered;

  return (
    <section className="px-4 max-w-6xl mx-auto w-full mb-4">
      <div className="rounded-2xl bg-card border border-border p-4 sm:p-5 space-y-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="ابحث في المفاتيح أو النصوص…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pr-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-display font-bold text-muted-foreground self-center pl-1">
            الخطورة:
          </span>
          {SEVERITY_OPTIONS.map((opt) => {
            const active = severity === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSeverity(opt.value)}
                className={`px-3 py-1 rounded-full border text-xs font-display transition-all ${
                  active
                    ? `bg-primary/15 ${opt.tone} ring-1 ring-primary/30`
                    : `${opt.tone} hover:bg-muted/50`
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-display font-bold text-muted-foreground self-center pl-1">
            الإصلاح:
          </span>
          {FIX_OPTIONS.map((opt) => {
            const active = fix === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onFix(opt.value)}
                className={`px-3 py-1 rounded-full border text-xs font-display transition-all ${
                  active
                    ? "bg-primary/15 border-primary/40 text-primary ring-1 ring-primary/30"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {ruleOptions.length > 1 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-display font-bold text-muted-foreground self-center pl-1">
              القاعدة:
            </span>
            <select
              value={rule}
              onChange={(e) => onRule(e.target.value)}
              className="bg-background border border-border rounded-md px-3 py-1.5 text-xs font-display max-w-full"
            >
              <option value="all">كل القواعد ({total})</option>
              {ruleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.count})
                </option>
              ))}
            </select>
          </div>
        )}

        {isFiltered && (
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
            <Badge variant="secondary" className="text-xs">
              تعرض {filtered} من {total}
            </Badge>
            <button
              type="button"
              onClick={onClearAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
              مسح كل التصفية
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default FilterBar;
