import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { toast } from "sonner";
import type { LocalIssue } from "@/lib/quality-lab-scanner";

interface IssueCardProps {
  issue: LocalIssue;
}

const severityClass = (s: LocalIssue["severity"]) => {
  if (s === "high") return "bg-destructive/15 text-destructive border-destructive/30";
  if (s === "medium") return "bg-orange-500/15 text-orange-400 border-orange-500/30";
  return "bg-blue-500/15 text-blue-400 border-blue-500/30";
};

const severityLabel = (s: LocalIssue["severity"]) =>
  s === "high" ? "حرج" : s === "medium" ? "متوسّط" : "بسيط";

const IssueCard = ({ issue }: IssueCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const hasAutoFix = issue.suggestion && issue.suggestion !== issue.translation;

  return (
    <article className="relative rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors">
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge
            variant="outline"
            className={`text-[10px] sm:text-xs shrink-0 ${severityClass(issue.severity)}`}
          >
            {severityLabel(issue.severity)}
          </Badge>
          <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
            {issue.rule}
          </Badge>
        </div>

        <p className="text-sm font-semibold leading-relaxed [overflow-wrap:anywhere] [word-break:break-word]">
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

      <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>الترجمة الحالية</span>
          <CopyBtn value={issue.translation} />
        </div>
        <div className="px-3 py-2 rounded-lg bg-muted/40 border border-border text-sm [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap">
          {issue.translation}
        </div>

        {hasAutoFix && (
          <>
            <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-emerald-400 mt-3">
              <span>الاقتراح</span>
              <CopyBtn value={issue.suggestion} />
            </div>
            <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap">
              {issue.suggestion}
            </div>
          </>
        )}

        {issue.original && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mt-2"
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
