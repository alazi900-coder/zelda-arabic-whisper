import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import DiffView from "@/components/quality-lab/DiffView";
import IssueCard from "@/components/quality-lab/IssueCard";
import type { IssueGroup } from "@/lib/group-issues";
import type { LocalIssue } from "@/lib/quality-lab-scanner";

interface EntryGroupCardProps {
  group: IssueGroup;
  ruleLabels: Record<string, string>;
  /** Apply the composed unified suggestion in one shot. */
  onApplyAll?: (key: string, newText: string) => void;
  /** Apply a single child issue (when expanded). */
  onApplyOne?: (key: string, newText: string) => void;
  /** Dismiss every child issue for this entry. */
  onDismissAll?: (issueIds: string[]) => void;
  /** Dismiss a single child issue. */
  onDismissOne?: (issueId: string) => void;
  /** Build a stable id for a child issue. */
  issueId: (it: LocalIssue) => string;
  /** Optional: dismiss-pattern hook propagated to expanded child cards. */
  onDismissPattern?: (rule: string, issueText: string) => void;
}

const severityClass = (s: "high" | "medium" | "low") => {
  if (s === "high") return "bg-destructive/15 text-destructive border-destructive/30";
  if (s === "medium") return "bg-orange-500/15 text-orange-400 border-orange-500/30";
  return "bg-blue-500/15 text-blue-400 border-blue-500/30";
};

const severityLabel = (s: "high" | "medium" | "low") =>
  s === "high" ? "حرج" : s === "medium" ? "متوسّط" : "بسيط";

const EntryGroupCard = ({
  group,
  ruleLabels,
  onApplyAll,
  onApplyOne,
  onDismissAll,
  onDismissOne,
  issueId,
  onDismissPattern,
}: EntryGroupCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const hasUnifiedFix = group.unifiedSuggestion !== group.translation;
  const ruleCounts = group.issues.reduce<Record<string, number>>((acc, it) => {
    acc[it.rule] = (acc[it.rule] ?? 0) + 1;
    return acc;
  }, {});

  const apply = () => {
    if (!onApplyAll || !hasUnifiedFix) return;
    onApplyAll(group.key, group.unifiedSuggestion);
  };

  const dismiss = () => {
    if (!onDismissAll) return;
    const ids = group.issues.map((it) => issueId(it));
    onDismissAll(ids);
    toast.success(`تجاهلت ${ids.length} مشكلة`);
  };

  return (
    <article className="relative rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors">
      {/* Header */}
      <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-border/50">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge
              variant="outline"
              className={`text-[10px] sm:text-xs shrink-0 ${severityClass(group.topSeverity)}`}
            >
              {severityLabel(group.topSeverity)}
            </Badge>
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {group.issues.length} مشكلة
            </Badge>
            {Object.entries(ruleCounts).map(([rule, count]) => (
              <Badge
                key={rule}
                variant="outline"
                className="text-[10px] shrink-0 text-muted-foreground"
              >
                {ruleLabels[rule] ?? rule}
                {count > 1 ? ` (${count})` : ""}
              </Badge>
            ))}
          </div>
          <div className="flex gap-1 shrink-0">
            {hasUnifiedFix && onApplyAll && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-500"
                onClick={apply}
                title="تطبيق كلّ الإصلاحات الآلية على هذا الإدخال"
                aria-label="تطبيق كل الإصلاحات"
              >
                <Check className="w-4 h-4" />
              </Button>
            )}
            {onDismissAll && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={dismiss}
                title="تجاهل كلّ مشاكل هذا الإدخال"
                aria-label="تجاهل الكل"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        <p
          className="text-[10px] text-muted-foreground/70 mt-1.5 truncate font-mono"
          dir="ltr"
        >
          {group.key}
        </p>
      </div>

      {/* Body: unified before/after */}
      <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              الترجمة الحالية
            </div>
            <div className="px-3 py-2 rounded-lg bg-muted/40 border border-border text-sm [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap min-h-[2.5rem]">
              {group.translation}
            </div>
          </div>
          {hasUnifiedFix ? (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-emerald-500">
                الاقتراح الموحّد
              </div>
              <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap min-h-[2.5rem]">
                {group.unifiedSuggestion}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                لا اقتراح آلي
              </div>
              <div className="px-3 py-2 rounded-lg bg-muted/20 border border-dashed border-border text-xs text-muted-foreground min-h-[2.5rem] flex items-center">
                هذه المشاكل تحتاج قراراً يدوياً — وسّع البطاقة لمراجعة كلّ مشكلة.
              </div>
            </div>
          )}
        </div>

        {hasUnifiedFix && (
          <div className="rounded-lg border border-border bg-background/60 p-2.5">
            <p className="text-[10px] text-muted-foreground font-bold mb-1.5">
              الفرق الإجمالي
            </p>
            <DiffView before={group.translation} after={group.unifiedSuggestion} />
          </div>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors pt-1"
        >
          <span>
            {expanded ? "إخفاء" : "عرض"} تفاصيل المشاكل ({group.issues.length})
          </span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {expanded && (
          <div className="space-y-3 pt-1">
            {group.issues.map((it, i) => (
              <IssueCard
                key={`${it.key}__${it.rule}__${i}`}
                issue={it}
                ruleLabel={ruleLabels[it.rule]}
                issueId={issueId(it)}
                onApply={onApplyOne}
                onDismiss={onDismissOne}
                onDismissPattern={onDismissPattern}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
};

export default EntryGroupCard;
