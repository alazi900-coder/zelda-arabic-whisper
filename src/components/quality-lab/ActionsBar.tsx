import { Button } from "@/components/ui/button";
import { Sparkles, Download, FileJson } from "lucide-react";

interface ActionsBarProps {
  totalIssues: number;
  safeFixCount: number;
  hasReport: boolean;
  onApplySafe: () => void;
  onExportIssues: () => void;
  onExportEntries: () => void;
}

const ActionsBar = ({
  totalIssues,
  safeFixCount,
  hasReport,
  onApplySafe,
  onExportIssues,
  onExportEntries,
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
