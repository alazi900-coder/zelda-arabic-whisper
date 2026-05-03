import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  X,
  Pencil,
  Copy,
  ChevronDown,
  ChevronUp,
  Save,
  CornerUpLeft,
} from "lucide-react";
import { toast } from "sonner";
import DiffView from "@/components/quality-lab/DiffView";
import type { LocalIssue } from "@/lib/quality-lab-scanner";

interface IssueCardProps {
  issue: LocalIssue;
  ruleLabel?: string;
  /** Apply suggestion (or edited text) to the underlying entry. */
  onApply?: (key: string, newText: string) => void;
  /** Hide this issue from view (does not change underlying data). */
  onDismiss?: (issueId: string) => void;
  /** Stable identifier for the issue used by dismiss. */
  issueId?: string;
}

const severityClass = (s: LocalIssue["severity"]) => {
  if (s === "high") return "bg-destructive/15 text-destructive border-destructive/30";
  if (s === "medium") return "bg-orange-500/15 text-orange-400 border-orange-500/30";
  return "bg-blue-500/15 text-blue-400 border-blue-500/30";
};

const severityLabel = (s: LocalIssue["severity"]) =>
  s === "high" ? "حرج" : s === "medium" ? "متوسّط" : "بسيط";

const IssueCard = ({ issue, ruleLabel, onApply, onDismiss, issueId }: IssueCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(issue.suggestion || issue.translation);

  // Reset edit text when issue changes (e.g., after re-scan).
  useEffect(() => {
    setEditText(issue.suggestion || issue.translation);
    setEditing(false);
  }, [issue.key, issue.rule, issue.suggestion, issue.translation]);

  const hasAutoFix = issue.suggestion && issue.suggestion !== issue.translation;
  const canApply = Boolean(onApply) && hasAutoFix;
  const canEdit = Boolean(onApply); // Editing implies applying.
  const canDismiss = Boolean(onDismiss && issueId);

  const apply = (text: string) => {
    if (!onApply) return;
    onApply(issue.key, text);
  };

  const startEdit = () => {
    setEditText(issue.suggestion || issue.translation);
    setEditing(true);
  };

  const saveEdit = () => {
    apply(editText);
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditText(issue.suggestion || issue.translation);
    setEditing(false);
  };

  const dismiss = () => {
    if (!onDismiss || !issueId) return;
    onDismiss(issueId);
  };

  return (
    <article className="relative rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors">
      {/* Header: severity + rule + key */}
      <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-border/50">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge
              variant="outline"
              className={`text-[10px] sm:text-xs shrink-0 ${severityClass(issue.severity)}`}
            >
              {severityLabel(issue.severity)}
            </Badge>
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {ruleLabel ?? issue.rule}
            </Badge>
          </div>
          <div className="flex gap-1 shrink-0">
            {canEdit && !editing && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                onClick={startEdit}
                title="تعديل قبل التطبيق"
                aria-label="تعديل"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
            {canApply && !editing && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-500"
                onClick={() => apply(issue.suggestion)}
                title="تطبيق الاقتراح"
                aria-label="تطبيق"
              >
                <Check className="w-4 h-4" />
              </Button>
            )}
            {canDismiss && !editing && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={dismiss}
                title="تجاهل"
                aria-label="تجاهل"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <p className="text-sm font-semibold leading-relaxed [overflow-wrap:anywhere] [word-break:break-word] mt-2">
          {issue.issue}
        </p>
        {issue.reason && issue.reason !== issue.issue && (
          <p className="text-xs text-muted-foreground leading-relaxed [overflow-wrap:anywhere] [word-break:break-word] mt-1.5">
            <span className="font-bold text-foreground/80">لماذا؟ </span>
            {issue.reason}
          </p>
        )}
        <p
          className="text-[10px] text-muted-foreground/70 mt-1.5 truncate font-mono"
          dir="ltr"
        >
          {issue.key}
        </p>
      </div>

      {/* Body */}
      <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-3">
        {editing ? (
          <div className="space-y-2 p-2.5 rounded-lg border border-primary/30 bg-primary/5">
            <p className="text-[10px] text-primary font-bold">تعديل قبل التطبيق</p>
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              dir="auto"
              className="text-sm min-h-[80px] [overflow-wrap:anywhere] [word-break:break-word]"
            />
            <div className="flex gap-1.5 justify-end flex-wrap">
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelEdit}
                className="h-7 text-xs gap-1"
              >
                <CornerUpLeft className="w-3 h-3" />
                <span>إلغاء</span>
              </Button>
              <Button
                size="sm"
                onClick={saveEdit}
                disabled={!editText.trim() || editText === issue.translation}
                className="h-7 text-xs gap-1"
              >
                <Save className="w-3 h-3" />
                <span>حفظ وتطبيق</span>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>الترجمة الحالية</span>
                  <CopyBtn value={issue.translation} />
                </div>
                <div className="px-3 py-2 rounded-lg bg-muted/40 border border-border text-sm [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap min-h-[2.5rem]">
                  {issue.translation}
                </div>
              </div>
              {hasAutoFix ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-emerald-500">
                    <span>الاقتراح</span>
                    <CopyBtn value={issue.suggestion} />
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap min-h-[2.5rem]">
                    {issue.suggestion}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>لا اقتراح آلي</span>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-muted/20 border border-dashed border-border text-xs text-muted-foreground min-h-[2.5rem] flex items-center [overflow-wrap:anywhere]">
                    تحتاج هذه الملاحظة قراراً يدوياً — راجع التفسير أعلاه.
                  </div>
                </div>
              )}
            </div>

            {hasAutoFix && (
              <div className="rounded-lg border border-border bg-background/60 p-2.5">
                <p className="text-[10px] text-muted-foreground font-bold mb-1.5">الفرق</p>
                <DiffView before={issue.translation} after={issue.suggestion} />
              </div>
            )}

            {issue.original && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>النص الأصلي</span>
                {expanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            {expanded && issue.original && (
              <div
                className="px-3 py-2 rounded-lg bg-background border border-border text-sm [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap"
                dir="ltr"
              >
                {issue.original}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
};

const CopyBtn = ({ value }: { value: string }) => (
  <button
    type="button"
    onClick={() => {
      navigator.clipboard.writeText(value);
      toast.success("تم النسخ");
    }}
    className="opacity-50 hover:opacity-100 transition-opacity"
    aria-label="نسخ"
  >
    <Copy className="w-3 h-3" />
  </button>
);

export default IssueCard;
