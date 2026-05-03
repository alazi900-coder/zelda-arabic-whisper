import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  Layers3,
  Wand2,
  Check,
} from "lucide-react";
import type { BulkPatternGroup } from "@/lib/bulk-suggestions";

interface BulkSuggestionsPanelProps {
  groups: ReadonlyArray<BulkPatternGroup>;
  ruleLabels: Record<string, string>;
  onApplyGroups: (selectedIds: ReadonlyArray<string>) => void;
}

const severityClass = (s: "high" | "medium" | "low") => {
  if (s === "high") return "bg-destructive/15 text-destructive border-destructive/30";
  if (s === "medium") return "bg-orange-500/15 text-orange-400 border-orange-500/30";
  return "bg-blue-500/15 text-blue-400 border-blue-500/30";
};

const formatLiteral = (s: string) =>
  s.length === 0 ? "ø" : s.replace(/ /g, "·").replace(/\t/g, "→");

const BulkSuggestionsPanel = ({
  groups,
  ruleLabels,
  onApplyGroups,
}: BulkSuggestionsPanelProps) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const totalOccurrences = useMemo(
    () => groups.reduce((sum, g) => sum + g.count, 0),
    [groups],
  );

  if (groups.length === 0) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(groups.map((g) => g.id)));
  const clearAll = () => setSelected(new Set());

  const applySelected = () => {
    if (selected.size === 0) return;
    onApplyGroups(Array.from(selected));
    setSelected(new Set());
  };

  const applyOne = (id: string) => {
    onApplyGroups([id]);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 sm:px-5 py-3 hover:bg-amber-500/10 transition-colors text-right"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Layers3 className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-display font-bold text-sm">
            اقتراحات قابلة للتطبيق دفعةً
          </span>
          <Badge
            variant="outline"
            className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30"
          >
            {groups.length} نمط
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] bg-amber-500/10 text-amber-400/80 border-amber-500/20"
          >
            {totalOccurrences} ظهور
          </Badge>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-amber-500/20">
          <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-2.5 bg-background/40 border-b border-amber-500/20">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={selectAll}
              className="h-7 text-xs"
            >
              تحديد الكلّ
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={clearAll}
              className="h-7 text-xs"
              disabled={selected.size === 0}
            >
              إلغاء التحديد
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              size="sm"
              onClick={applySelected}
              disabled={selected.size === 0}
              className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-600/90 text-white"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>تطبيق المحدّد ({selected.size})</span>
            </Button>
          </div>

          <ul className="divide-y divide-amber-500/15 max-h-[60vh] overflow-y-auto">
            {groups.map((g) => {
              const checked = selected.has(g.id);
              const uniqueEntries = new Set(g.entries.map((e) => e.key)).size;
              return (
                <li
                  key={g.id}
                  className="px-4 sm:px-5 py-2.5 flex items-center gap-3 hover:bg-amber-500/5 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(g.id)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer shrink-0"
                    aria-label={`تحديد النمط ${g.wrong} → ${g.right}`}
                  />
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${severityClass(g.topSeverity)}`}
                    >
                      {ruleLabels[g.rule] ?? g.rule}
                    </Badge>
                    <code
                      className="text-xs px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/30 [overflow-wrap:anywhere] [word-break:break-word]"
                      dir="auto"
                    >
                      {formatLiteral(g.wrong)}
                    </code>
                    <span className="text-muted-foreground text-xs shrink-0">
                      ←
                    </span>
                    <code
                      className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 [overflow-wrap:anywhere] [word-break:break-word]"
                      dir="auto"
                    >
                      {formatLiteral(g.right)}
                    </code>
                    <Badge
                      variant="secondary"
                      className="text-[10px] shrink-0"
                    >
                      {g.count} ظهور
                      {uniqueEntries < g.count
                        ? ` · ${uniqueEntries} إدخال`
                        : ""}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => applyOne(g.id)}
                    className="h-7 w-7 shrink-0 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-500"
                    title="تطبيق هذا النمط على كلّ ظهوراته"
                    aria-label="تطبيق هذا النمط"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};

export default BulkSuggestionsPanel;
