import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import QualityLabHero from "@/components/quality-lab/QualityLabHero";
import InputZone, { type ScanEntry } from "@/components/quality-lab/InputZone";
import StatsPanel from "@/components/quality-lab/StatsPanel";
import IssueCard from "@/components/quality-lab/IssueCard";
import { scanUnified, type UnifiedScanReport } from "@/lib/quality-lab-scanner";

const PAGE_SIZE = 30;

const QualityLab = () => {
  const inputRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const [report, setReport] = useState<UnifiedScanReport | null>(null);
  const [shown, setShown] = useState(PAGE_SIZE);

  useEffect(() => {
    const prev = document.title;
    document.title = "مختبر جودة الترجمة العربية — أداة تعريب زيلدا";
    return () => {
      document.title = prev;
    };
  }, []);

  const scrollDown = () => {
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onLoaded = (loaded: ScanEntry[]) => {
    const next = scanUnified(loaded);
    setReport(next);
    setShown(PAGE_SIZE);
    setTimeout(() => {
      reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const reset = () => {
    setReport(null);
    setShown(PAGE_SIZE);
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const sortedIssues = useMemo(() => {
    if (!report) return [];
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...report.issues].sort((a, b) => order[a.severity] - order[b.severity]);
  }, [report]);

  const visible = sortedIssues.slice(0, shown);
  const hasMore = sortedIssues.length > shown;

  return (
    <div className="min-h-screen flex flex-col">
      <QualityLabHero onScrollDown={scrollDown} />

      <div ref={inputRef}>
        <InputZone onLoaded={onLoaded} />
      </div>

      {report && (
        <div ref={reportRef} className="pb-16">
          <StatsPanel report={report} onReset={reset} />

          <section className="px-4 max-w-6xl mx-auto w-full">
            {sortedIssues.length === 0 ? (
              <div className="rounded-2xl bg-card border border-emerald-500/30 p-10 text-center">
                <Badge
                  variant="outline"
                  className="mb-3 bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                >
                  ممتاز
                </Badge>
                <p className="text-sm text-muted-foreground">
                  لم يكتشف الفحص أيّ مشكلة ضمن القواعد المتاحة. الترجمات نظيفة بنيوياً.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {visible.map((issue, i) => (
                    <IssueCard
                      key={`${issue.key}__${issue.rule}__${i}`}
                      issue={issue}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div className="flex justify-center mt-6">
                    <button
                      type="button"
                      onClick={() => setShown((v) => v + PAGE_SIZE)}
                      className="px-5 py-2.5 rounded-full border border-primary/40 bg-primary/10 hover:bg-primary/20 text-sm font-display font-bold transition-colors"
                    >
                      تحميل المزيد ({sortedIssues.length - shown} متبقّ)
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      <footer className="mt-auto py-6 text-center text-xs text-muted-foreground border-t border-border">
        مختبر جودة الترجمة — يعمل بالكامل داخل متصفّحك
      </footer>
    </div>
  );
};

export default QualityLab;
