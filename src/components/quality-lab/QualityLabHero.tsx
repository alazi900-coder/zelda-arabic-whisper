import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Beaker, Sparkles } from "lucide-react";

interface QualityLabHeroProps {
  onScrollDown: () => void;
}

const STATS = [
  { value: "17+", label: "قاعدة بنيوية" },
  { value: "300+", label: "نمط همزة وإملاء" },
  { value: "200+", label: "مصطلح ألعاب" },
  { value: "9", label: "محرّكات AI" },
];

const QualityLabHero = ({ onScrollDown }: QualityLabHeroProps) => {
  return (
    <header className="relative flex flex-col items-center justify-center min-h-[60vh] px-4 pt-12 pb-12 text-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-secondary/5 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />

      <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
        {/* Back button */}
        <div className="absolute -top-2 right-0 sm:top-2 sm:right-4">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">للصفحة الرئيسية</span>
            </Button>
          </Link>
        </div>

        {/* Icon */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
          <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/20 border border-primary/30 flex items-center justify-center shadow-2xl shadow-primary/30">
            <Beaker className="w-10 h-10 sm:w-14 sm:h-14 text-primary drop-shadow-[0_0_20px_hsl(var(--primary))]" />
          </div>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 backdrop-blur-sm">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs sm:text-sm text-primary font-display font-semibold">
            مختبر الجودة الاحترافي
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-black mb-4 leading-tight tracking-tight">
          مختبر جودة{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-l from-secondary via-primary to-secondary">
            الترجمة العربية
          </span>
        </h1>

        <p className="text-sm sm:text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto font-body leading-relaxed px-2">
          نظام احترافي يكتشف أخطاء الترجمة العربية تلقائياً — قواعد بنيوية وقواميس
          متخصّصة ومحرّكات ذكاء اصطناعي اختياريّة، كلّها في مكان واحد.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-10 w-full max-w-2xl">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="relative p-3 sm:p-4 rounded-xl bg-card/40 border border-primary/20 backdrop-blur-sm hover:border-primary/50 transition-colors"
            >
              <div className="text-xl sm:text-3xl font-display font-black text-primary">{s.value}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Button
          size="lg"
          onClick={onScrollDown}
          className="font-display font-bold text-base sm:text-lg px-8 sm:px-12 py-5 sm:py-6 bg-gradient-to-l from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/30"
        >
          ابدأ الفحص ✨
        </Button>
      </div>
    </header>
  );
};

export default QualityLabHero;
