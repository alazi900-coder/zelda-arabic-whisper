import { Button } from "@/components/ui/button";
import { Sparkles, Download, FileJson, ArrowLeftToLine } from "lucide-react";

interface ActionsBarProps {
  totalIssues: number;
  safeFixCount: number;
  hasReport: boolean;
  onApplySafe: () => void;
  onExportIssues: () => void;
  onExportEntries: () => void;
  /** Optional: when provided, shows a "Send to Editor" action. */
  onSendToEditor?: () => void;
  /** Whether the send-to-editor action is currently allowed. */
  canSendToEditor?: boolean;
  /** Whether the send-to-editor action is in progress. */
  sendingToEditor?: boolean;
}

const ActionsBar = ({
  totalIssues,
  safeFixCount,
  hasReport,
  onApplySafe,
  onExportIssues,
  onExportEntries,
  onSendToEditor,
  canSendToEditor = true,
  sendingToEditor = false,
}: ActionsBarProps) => {
  if (!hasReport) return null;

  return (
    <section className="px-4 max-w-6xl mx-auto w-full mb-4">
      <div className="rounded-2xl bg-card border border-border p-4 sm:p-5 flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="text-xs sm:text-sm text-muted-foreground flex-1 min-w-[140px] [overflow-wrap:anywhere]">
          {safeFixCount > 0
            ? `${safeFixCount} إصلاح آمن جاهز للتطبيق دفعة واحدة`
            : "لا توجد إصلاحات آلية آمنة في النتائج الحالية"}
        </div>

        <Button
          variant="default"
          size="sm"
          disabled={safeFixCount === 0}
          onClick={onApplySafe}
          className="gap-1.5 shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>طبّق الآمن ({safeFixCount})</span>
        </Button>

        {onSendToEditor && (
          <Button
            variant="default"
            size="sm"
            onClick={onSendToEditor}
            disabled={!canSendToEditor || sendingToEditor}
            className="gap-1.5 shrink-0 bg-emerald-600 hover:bg-emerald-600/90 text-white"
            title="ادمج الترجمات الحالية في جلسة المحرّر المحفوظة"
          >
            <ArrowLeftToLine className="w-3.5 h-3.5" />
            <span>{sendingToEditor ? "جارٍ الإرسال…" : "أرسل إلى المحرّر"}</span>
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onExportIssues}
          disabled={totalIssues === 0}
          className="gap-1.5 shrink-0"
        >
          <FileJson className="w-3.5 h-3.5" />
          <span>تصدير التقرير</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onExportEntries}
          className="gap-1.5 shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>تصدير الترجمات</span>
        </Button>
      </div>
    </section>
  );
};

export default ActionsBar;
