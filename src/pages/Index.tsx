import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Shield, FileText, Download, Sparkles } from "lucide-react";
import linkHero from "@/assets/link-hero.png";
import hyruleWorld from "@/assets/hyrule-world.jpg";

const steps = [
  { icon: FileText, title: "ارفع الملفات", desc: "ارفع ملف اللغة (.zs) وملف القاموس" },
  { icon: Shield, title: "معالجة تلقائية", desc: "فك الضغط واستخراج النصوص ومعالجتها" },
  { icon: Download, title: "حمّل النتيجة", desc: "حمّل الملف المعرّب جاهزاً للعبة" },
];

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <header className="relative flex flex-col items-center justify-center min-h-[70vh] px-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <img
            src={linkHero}
            alt="البطل لينك من لعبة زيلدا"
            className="w-40 h-40 md:w-52 md:h-52 mx-auto mb-6 object-contain drop-shadow-[0_0_25px_hsl(var(--primary)/0.4)] animate-[float_3s_ease-in-out_infinite]"
          />
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-display font-semibold">أداة تعريب تلقائية</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-black mb-6 leading-tight">
            عرّب لعبة{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-secondary to-primary">
              زيلدا
            </span>{" "}
            بسهولة
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-lg mx-auto font-body">
            ارفع ملفات اللعبة واحصل على نسخة معرّبة بالكامل مع ربط الحروف وعكس الاتجاه تلقائياً
          </p>
          <Link to="/process">
            <Button size="lg" className="font-display font-bold text-lg px-10 py-6 bg-primary hover:bg-primary/90">
              ابدأ التعريب 🎮
            </Button>
          </Link>
        </div>
      </header>

      {/* World Banner */}
      <section className="relative w-full overflow-hidden">
        <img
          src={hyruleWorld}
          alt="عالم هايرول مع أبطال اللعبة"
          className="w-full h-64 md:h-96 object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-6 inset-x-0 text-center">
          <p className="text-lg md:text-2xl font-display font-bold text-foreground drop-shadow-lg">
            🏰 استكشف عالم هايرول باللغة العربية
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-center mb-12">
            كيف تعمل الأداة؟
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div
                key={i}
                className="flex flex-col items-center text-center p-6 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <step.icon className="w-7 h-7 text-primary" />
                </div>
                <div className="text-sm text-secondary font-display font-bold mb-1">
                  الخطوة {i + 1}
                </div>
                <h3 className="text-xl font-display font-bold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-sm text-muted-foreground border-t border-border">
        أداة تعريب زيلدا — مشروع مفتوح المصدر 🇸🇦
      </footer>
    </div>
  );
};

export default Index;
