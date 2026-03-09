import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Shield, FileText, Download, Sparkles, ChevronDown } from "lucide-react";
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

      {/* Footer */}
      <footer className="mt-auto py-4 sm:py-6 text-center text-xs sm:text-sm text-muted-foreground border-t border-border">
        أداة تعريب زيلدا — مشروع مفتوح المصدر 🇸🇦
      </footer>
    </div>
  );
};

export default Index;
