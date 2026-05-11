import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Shield, FileText, Download, Sparkles, ChevronDown, Beaker, ArrowLeft, Mic } from "lucide-react";
import linkHero from "@/assets/link-hero.png";
import hyruleWorld from "@/assets/hyrule-world.jpg";

const steps = [
  { icon: FileText, title: "ارفع الملفات", desc: "ارفع ملف اللغة (.zs) وملف القاموس" },
  { icon: Shield, title: "معالجة تلقائية", desc: "فك الضغط واستخراج النصوص ومعالجتها" },
  { icon: Download, title: "حمّل النتيجة", desc: "حمّل الملف المعرّب جاهزاً للعبة" },
];

const Index = () => {
  const parallaxRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (parallaxRef.current) {
        const rect = parallaxRef.current.getBoundingClientRect();
        const windowH = window.innerHeight;
        if (rect.bottom > 0 && rect.top < windowH) {
          setOffset((rect.top - windowH) * -0.35);
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <header className="relative flex flex-col items-center justify-center min-h-[calc(100svh-2rem)] md:min-h-[70vh] px-4 pt-8 pb-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
          <img
            src={linkHero}
            alt="البطل لينك من لعبة زيلدا"
            className="w-28 h-28 sm:w-40 sm:h-40 md:w-52 md:h-52 mx-auto mb-4 md:mb-6 object-contain drop-shadow-[0_0_25px_hsl(var(--primary)/0.4)] animate-[float_3s_ease-in-out_infinite]"
          />
          <div className="inline-flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-6 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            <span className="text-xs sm:text-sm text-primary font-display font-semibold">أداة تعريب تلقائية</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-display font-black mb-3 sm:mb-6 leading-tight">
            عرّب لعبة{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-secondary to-primary">
              زيلدا
            </span>{" "}
            بسهولة
          </h1>
          <p className="text-sm sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-10 max-w-lg mx-auto font-body leading-relaxed px-2">
            ارفع ملفات اللعبة واحصل على نسخة معرّبة بالكامل مع ربط الحروف وعكس الاتجاه تلقائياً
          </p>
          <Link to="/process">
            <Button size="lg" className="font-display font-bold text-base sm:text-lg px-8 sm:px-10 py-5 sm:py-6 bg-primary hover:bg-primary/90">
              ابدأ التعريب 🎮
            </Button>
          </Link>
        </div>
        {/* Scroll indicator - mobile only */}
        <div className="absolute bottom-4 inset-x-0 flex justify-center md:hidden animate-bounce">
          <ChevronDown className="w-5 h-5 text-muted-foreground/50" />
        </div>
      </header>

      {/* World Banner */}
      <section ref={parallaxRef} className="relative w-full overflow-hidden h-40 sm:h-48 md:h-96">
        <img
          src={hyruleWorld}
          alt="عالم هايرول مع أبطال اللعبة"
          className="absolute inset-x-0 top-0 w-full h-full object-cover will-change-transform"
          style={{ transform: `translateY(${offset * 0.5}px)`, scale: '1.2' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-3 sm:bottom-6 inset-x-0 text-center px-4">
          <p className="text-sm sm:text-lg md:text-2xl font-display font-bold text-foreground drop-shadow-lg">
            🏰 استكشف عالم هايرول باللغة العربية
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-10 sm:py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-center mb-6 sm:mb-12">
            كيف تعمل الأداة؟
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
            {steps.map((step, i) => (
              <div
                key={i}
                className="flex sm:flex-col items-center sm:text-center gap-4 sm:gap-0 p-4 sm:p-6 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors"
              >
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 sm:mb-4">
                  <step.icon className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
                </div>
                <div className="flex-1 sm:flex-initial text-right sm:text-center">
                  <div className="text-xs sm:text-sm text-secondary font-display font-bold mb-0.5 sm:mb-1">
                    الخطوة {i + 1}
                  </div>
                  <h3 className="text-base sm:text-xl font-display font-bold mb-1 sm:mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-xs sm:text-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quality Lab CTA */}
      <section className="px-4 pb-10 sm:pb-16">
        <div className="max-w-4xl mx-auto">
          <Link
            to="/quality-lab"
            className="group relative block rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-secondary/5 hover:from-primary/15 hover:to-secondary/10 transition-all overflow-hidden shadow-2xl shadow-primary/10 hover:shadow-primary/20"
          >
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/20 blur-3xl group-hover:bg-primary/30 transition-colors" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-secondary/15 blur-3xl group-hover:bg-secondary/25 transition-colors" />

            <div className="relative p-6 sm:p-10 flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-8">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl group-hover:bg-primary/40 transition-colors" />
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/15 border border-primary/40 flex items-center justify-center">
                  <Beaker className="w-8 h-8 sm:w-10 sm:h-10 text-primary drop-shadow-[0_0_15px_hsl(var(--primary))]" />
                </div>
              </div>

              <div className="flex-1 text-center sm:text-right">
                <div className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-0.5 rounded-full bg-primary/15 border border-primary/30">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-[10px] sm:text-xs text-primary font-display font-semibold">جديد</span>
                </div>
                <h2 className="text-xl sm:text-3xl font-display font-black mb-2 leading-tight">
                  مختبر جودة{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-l from-secondary to-primary">الترجمة العربية</span>
                </h2>
                <p className="text-xs sm:text-base text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                  افحص ترجماتك تلقائياً بـ 17 قاعدة بنيوية و+500 نمط إملائي ومصطلح ألعاب — كلّه يعمل داخل متصفّحك.
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[10px] sm:text-xs">
                  <span className="px-2 py-1 rounded-md bg-card/60 border border-border">17+ قاعدة</span>
                  <span className="px-2 py-1 rounded-md bg-card/60 border border-border">قواميس متخصّصة</span>
                  <span className="px-2 py-1 rounded-md bg-card/60 border border-border">يعمل بدون اتصال</span>
                </div>
              </div>

              <div className="shrink-0 self-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center group-hover:bg-primary/30 group-hover:translate-x-[-4px] transition-all">
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
              </div>
            </div>
          </Link>

          {/* Dubbing Studio CTA */}
          <Link
            to="/dubbing"
            className="group relative block mt-4 rounded-2xl border border-secondary/30 bg-gradient-to-br from-secondary/10 via-card to-primary/5 hover:from-secondary/15 hover:to-primary/10 transition-all overflow-hidden shadow-xl shadow-secondary/10"
          >
            <div className="relative p-5 sm:p-7 flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-secondary/30 to-primary/15 border border-secondary/40 flex items-center justify-center shrink-0">
                <Mic className="w-7 h-7 sm:w-8 sm:h-8 text-secondary drop-shadow-[0_0_12px_hsl(var(--secondary))]" />
              </div>
              <div className="flex-1">
                <div className="inline-flex items-center gap-1.5 mb-1 px-2 py-0.5 rounded-full bg-secondary/15 border border-secondary/30">
                  <Sparkles className="w-3 h-3 text-secondary" />
                  <span className="text-[10px] sm:text-xs text-secondary font-display font-semibold">جديد · مجاني</span>
                </div>
                <h2 className="text-lg sm:text-2xl font-display font-black mb-1">
                  استوديو الدبلجة العربية
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  ولِّد أصوات شخصيات Zelda بالعربية (Link, Zelda, Ganon...) — يعمل عبر Lovable AI
                </p>
              </div>
              <ArrowLeft className="w-5 h-5 text-secondary shrink-0 group-hover:translate-x-[-4px] transition-transform" />
            </div>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-4 sm:py-6 text-center text-xs sm:text-sm text-muted-foreground border-t border-border">
        أداة تعريب زيلدا — مشروع مفتوح المصدر 🇸🇦
      </footer>
    </div>
  );
};

export default Index;
