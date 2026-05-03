import { useEffect, useRef } from "react";
import QualityLabHero from "@/components/quality-lab/QualityLabHero";

const QualityLab = () => {
  const placeholderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.title;
    document.title = "مختبر جودة الترجمة العربية — أداة تعريب زيلدا";
    return () => {
      document.title = prev;
    };
  }, []);

  const scrollDown = () => {
    placeholderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <QualityLabHero onScrollDown={scrollDown} />

      <section
        ref={placeholderRef}
        className="flex-1 flex items-center justify-center px-4 py-16"
      >
        <div className="max-w-xl mx-auto text-center rounded-2xl bg-card border border-border p-8 sm:p-12">
          <div className="text-4xl mb-4">🚧</div>
          <h2 className="text-xl sm:text-2xl font-display font-bold mb-3">
            قريباً — أدوات الفحص
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            هذه الواجهة قيد البناء التدريجي. ستُضاف منطقة الإدخال (لصق ورفع
            واستيراد من المحرّر)، ثمّ بطاقات النتائج، ثمّ القواميس المتخصّصة،
            ثمّ تكامل الذكاء الاصطناعي — كلّ ذلك في PRs منفصلة.
          </p>
        </div>
      </section>

      <footer className="mt-auto py-6 text-center text-xs text-muted-foreground border-t border-border">
        مختبر جودة الترجمة — يعمل بالكامل داخل متصفّحك
      </footer>
    </div>
  );
};

export default QualityLab;
