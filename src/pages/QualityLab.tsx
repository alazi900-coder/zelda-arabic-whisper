import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import QualityLabHero from "@/components/quality-lab/QualityLabHero";
import InputZone, { type ScanEntry } from "@/components/quality-lab/InputZone";

const QualityLab = () => {
  const inputRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<ScanEntry[]>([]);

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

  return (
    <div className="min-h-screen flex flex-col">
      <QualityLabHero onScrollDown={scrollDown} />

      <div ref={inputRef}>
        <InputZone onLoaded={setEntries} />
      </div>

      {entries.length > 0 && (
        <section className="px-4 pb-16 max-w-5xl mx-auto w-full">
          <div className="rounded-2xl bg-card border border-primary/30 p-6 sm:p-8 text-center">
            <Badge variant="secondary" className="mb-3">
              تمّ التحميل
            </Badge>
            <div className="text-3xl sm:text-4xl font-display font-black mb-1 text-primary">
              {entries.length}
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              إدخال جاهز للفحص
            </p>
            <p className="text-xs text-muted-foreground/80 leading-relaxed mb-4 max-w-md mx-auto [overflow-wrap:anywhere]">
              في هذا الـ PR، ينتهي العمل عند الإدخال. زرّ «شغّل الفحص» سيُفعّل
              في PR3 مع 17 قاعدة بنيوية، ثمّ تُضاف القواميس المتخصّصة لاحقاً.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEntries([])}
              className="font-display"
            >
              مسح وبدء جديد
            </Button>
          </div>
        </section>
      )}

      <footer className="mt-auto py-6 text-center text-xs text-muted-foreground border-t border-border">
        مختبر جودة الترجمة — يعمل بالكامل داخل متصفّحك
      </footer>
    </div>
  );
};

export default QualityLab;
