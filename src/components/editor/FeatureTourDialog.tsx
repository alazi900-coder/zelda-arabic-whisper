import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ToolInfo {
  emoji: string;
  title: string;
  description: string;
  details: string[];
}

const TOOLS: ToolInfo[] = [
  {
    emoji: "🎬",
    title: "سياق المشهد",
    description: "عرض النصوص المحيطة من نفس الملف لفهم الحوار الكامل",
    details: [
      "يعرض النصوص السابقة واللاحقة للنص الحالي من نفس ملف MSBT",
      "يساعدك على فهم سياق الحوار قبل الترجمة",
      "يُظهر الترجمات الموجودة للنصوص المجاورة إن وُجدت",
    ],
  },
  {
    emoji: "🧠",
    title: "ذاكرة الترجمة",
    description: "البحث عن ترجمات مشابهة من نصوص أخرى في المشروع",
    details: [
      "يبحث في كل ترجمات المشروع عن نصوص إنجليزية مشابهة",
      "يعرض نسبة التطابق لكل نتيجة",
      "يمكنك تطبيق أي ترجمة مشابهة بضغطة واحدة",
    ],
  },
  {
    emoji: "📸",
    title: "سياق بالصور",
    description: "رفع لقطات شاشة من اللعبة لفهم السياق البصري",
    details: [
      "ارفع صور من اللعبة وربطها بملفات MSBT محددة",
      "أضف ملاحظات على كل صورة",
      "اضغط على الصورة لتكبيرها — الصور تُحفظ محلياً",
    ],
  },
  {
    emoji: "💡",
    title: "اقتراحات سياقية بالـ AI",
    description: "ترجمات مقترحة تراعي سياق المشهد الكامل عبر الذكاء الاصطناعي",
    details: [
      "يرسل النص مع النصوص المحيطة للذكاء الاصطناعي",
      "يقدم 3 اقتراحات بأساليب مختلفة: رسمي، طبيعي، إبداعي",
      "كل اقتراح يأتي مع نسبة ثقة وسبب الاختيار",
    ],
  },
  {
    emoji: "📝",
    title: "ملاحظات المترجم",
    description: "إضافة تعليقات وملاحظات على كل نص للرجوع إليها لاحقاً",
    details: [
      "اضغط 'ملاحظة' أسفل حقل الترجمة لإضافة تعليق",
      "الملاحظات تُحفظ محلياً وتظهر دائماً تحت النص",
      "مفيدة لتسجيل قرارات الترجمة أو الأسئلة المعلقة",
    ],
  },
  {
    emoji: "🟢🟡🔴",
    title: "تصنيف الصعوبة",
    description: "ترتيب النصوص حسب صعوبة الترجمة تلقائياً",
    details: [
      "🟢 بسيط: نصوص قصيرة بدون رموز تقنية",
      "🟡 متوسط: نصوص متوسطة الطول أو تحتوي متغيرات",
      "🔴 معقد: نصوص طويلة أو تحتوي رموز تقنية متعددة",
      "استخدم فلتر الصعوبة لعرض فئة محددة فقط",
    ],
  },
  {
    emoji: "✍️",
    title: "تحسين الصياغة العربية",
    description: "فحص تلقائي بالذكاء الاصطناعي للأخطاء النحوية والإملائية",
    details: [
      "يفحص دفعة من 15 ترجمة ويقترح تحسينات",
      "يصحح الأخطاء النحوية والإملائية",
      "يحافظ على الرموز التقنية والمعنى الأصلي",
      "متاح من قائمة الأدوات (⋮)",
    ],
  },
  {
    emoji: "🔍",
    title: "كشف التناقضات",
    description: "اكتشاف نفس المصطلح الإنجليزي مترجم بطرق مختلفة",
    details: [
      "يفحص كل الترجمات للعثور على تناقضات",
      "يعرض المصطلح الإنجليزي مع كل الترجمات المختلفة",
      "يقارن مع القاموس المفعّل إن وُجد",
      "متاح من قائمة الأدوات (⋮)",
    ],
  },
  {
    emoji: "⚖️",
    title: "مقارنة بين المحركات",
    description: "مقارنة جنب-لجنب بين ترجمات Lovable AI و MyMemory و Gemini",
    details: [
      "يترجم نفس النص بجميع المحركات المتاحة في نفس الوقت",
      "يعرض النتائج جنباً لجنب لاختيار الأفضل",
      "اضغط زر ⚖️ على أي بطاقة نص لبدء المقارنة",
    ],
  },
  {
    emoji: "🧠",
    title: "تحسين جماعي ذكي",
    description: "تحليل تلقائي لجميع الترجمات واقتراح تحسينات للنصوص الضعيفة",
    details: [
      "يفحص جميع الترجمات بالذكاء الاصطناعي ويحدد الضعيفة فقط",
      "يصنّف المشاكل حسب الخطورة (بسيط، متوسط، خطير)",
      "اختر الاقتراحات المعتمدة ثم طبّقها دفعة واحدة",
      "متاح من قائمة الأدوات أو شريط الأدوات",
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function FeatureTourDialog({ open, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const tool = TOOLS[currentIndex];
  const isLast = currentIndex === TOOLS.length - 1;
  const isFirst = currentIndex === 0;

  const handleNext = () => {
    if (isLast) {
      setCurrentIndex(0);
      onClose();
    } else {
      setCurrentIndex(i => i + 1);
    }
  };

  const handleClose = () => {
    setCurrentIndex(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <span className="text-2xl">{tool.emoji}</span>
            {tool.title}
          </DialogTitle>
          <DialogDescription className="text-sm font-body">
            {tool.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-3">
          {tool.details.map((detail, i) => (
            <div key={i} className="flex items-start gap-2 text-sm font-body">
              <span className="text-primary mt-0.5 shrink-0">•</span>
              <span className="text-foreground/80">{detail}</span>
            </div>
          ))}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 py-2">
          {TOOLS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground font-body">
            {currentIndex + 1} / {TOOLS.length}
          </span>
          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={() => setCurrentIndex(i => i - 1)} className="font-body">
                السابق
              </Button>
            )}
            <Button size="sm" onClick={handleNext} className="font-body">
              {isLast ? 'موافق ✓' : 'التالي →'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
