import React from "react";
import { Progress } from "@/components/ui/progress";
import { FILE_CATEGORIES } from "@/components/editor/types";
import { AlertTriangle } from "lucide-react";
import type { CategorySummary } from "@/lib/category-summary";

interface CategoryFilterProps {
  summaries: Record<string, CategorySummary>;
  filterCategory: string;
  setFilterCategory: (cat: string) => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  summaries,
  filterCategory,
  setFilterCategory,
}) => {
  const ordered = FILE_CATEGORIES.filter((cat) => summaries[cat.id]?.total);
  const hasOther = !!summaries["other"]?.total;
  if (ordered.length === 0 && !hasOther) return null;

  const grandTotal = Object.values(summaries).reduce((s, v) => s + v.total, 0);
  const grandIssues = Object.values(summaries).reduce((s, v) => s + v.withIssues, 0);

  return (
    <section className="px-4 max-w-6xl mx-auto w-full pb-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-display font-bold text-muted-foreground">
          الأقسام ({grandTotal} إدخال، {grandIssues} مع مشاكل)
        </h3>
        {filterCategory !== "all" && (
          <button
            type="button"
            onClick={() => setFilterCategory("all")}
            className="text-xs text-primary hover:underline font-display"
          >
            مسح التصفية
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-4">
        <button
          type="button"
          onClick={() => setFilterCategory("all")}
          className={`p-2 rounded-lg border text-xs text-right transition-colors ${
            filterCategory === "all"
              ? "border-primary bg-primary/10"
              : "border-border/50 bg-card/50 hover:border-primary/30"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span>📋</span>
            <span className="font-mono text-muted-foreground">
              {grandTotal > 0 ? Math.round((grandIssues / grandTotal) * 100) : 0}%
            </span>
          </div>
          <p className="font-display font-bold truncate">الكل</p>
          <Progress
            value={grandTotal > 0 ? (grandIssues / grandTotal) * 100 : 0}
            className="h-1 mt-1"
          />
          <p className="text-muted-foreground mt-1">
            {grandIssues}/{grandTotal}
          </p>
        </button>

        {ordered.map((cat) => {
          const s = summaries[cat.id];
          const pct = s.total > 0 ? Math.round((s.withIssues / s.total) * 100) : 0;
          const isActive = filterCategory === cat.id;
          const hasIssues = s.withIssues > 0;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFilterCategory(isActive ? "all" : cat.id)}
              className={`p-2 rounded-lg border text-xs text-right transition-colors ${
                isActive
                  ? "border-primary bg-primary/10"
                  : "border-border/50 bg-card/50 hover:border-primary/30"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span>{cat.emoji}</span>
                <span
                  className={`font-mono ${
                    hasIssues ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {pct}%
                </span>
              </div>
              <p className="font-display font-bold truncate">{cat.label}</p>
              <Progress value={pct} className="h-1 mt-1" />
              <p className="text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                {hasIssues && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                {s.withIssues}/{s.total}
              </p>
            </button>
          );
        })}

        {hasOther && (
          <button
            type="button"
            onClick={() => setFilterCategory(filterCategory === "other" ? "all" : "other")}
            className={`p-2 rounded-lg border text-xs text-right transition-colors ${
              filterCategory === "other"
                ? "border-primary bg-primary/10"
                : "border-border/50 bg-card/50 hover:border-primary/30"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span>📁</span>
              <span className="font-mono text-muted-foreground">
                {summaries["other"].total > 0
                  ? Math.round(
                      (summaries["other"].withIssues / summaries["other"].total) * 100,
                    )
                  : 0}
                %
              </span>
            </div>
            <p className="font-display font-bold truncate">أخرى</p>
            <Progress
              value={
                summaries["other"].total > 0
                  ? (summaries["other"].withIssues / summaries["other"].total) * 100
                  : 0
              }
              className="h-1 mt-1"
            />
            <p className="text-muted-foreground mt-1">
              {summaries["other"].withIssues}/{summaries["other"].total}
            </p>
          </button>
        )}
      </div>
    </section>
  );
};

export default CategoryFilter;
