import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Alternative {
  style: string;
  text: string;
  reason: string;
}

interface Props {
  data: null | {
    key: string;
    original: string;
    current: string;
    alternatives: Alternative[];
  };
  onApply: (text: string) => void;
  onClose: () => void;
}

const STYLE_LABELS: Record<string, string> = {
  natural: '💬 طبيعي وسلس',
  concise: '✂️ مختصر ومباشر',
  literary: '📚 أدبي وغني',
};

const QuickAlternativesPanel: React.FC<Props> = ({ data, onApply, onClose }) => {
  if (!data) return null;

  return (
    <div className="fixed inset-0 z-[9999]" dir="rtl">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute inset-x-4 inset-y-10 sm:inset-x-16 md:inset-x-[20%] md:inset-y-16 bg-background border rounded-lg shadow-2xl flex flex-col overflow-hidden">
        <div className="shrink-0 p-4 pb-3 border-b">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">🎭 3 بدائل سريعة</h2>
              <p className="text-sm text-muted-foreground font-body mt-1">اختر البديل الأنسب لهذا النص</p>
            </div>
            <button onClick={onClose} className="p-1 rounded-sm hover:bg-accent">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-3">
          <div className="border rounded-md p-3 bg-muted/30 space-y-1">
            <div className="text-[11px] font-body text-muted-foreground" dir="ltr">{data.original}</div>
            <div className="text-xs font-body text-muted-foreground font-semibold" dir="rtl">
              الحالي: <span className="font-normal">{data.current}</span>
            </div>
          </div>

          {data.alternatives.map((alt, i) => (
            <div key={i} className="border rounded-md p-3 border-primary/30 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-display text-xs font-semibold">
                  {STYLE_LABELS[alt.style] || alt.style}
                </span>
                <Button size="sm" onClick={() => onApply(alt.text)} className="h-7 px-3 text-xs font-display">
                  استخدم هذا
                </Button>
              </div>
              <div className="text-sm font-body text-primary font-semibold" dir="rtl">{alt.text}</div>
              {alt.reason && (
                <div className="text-[11px] font-body text-muted-foreground" dir="rtl">
                  {alt.reason}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="shrink-0 p-4 pt-3 border-t flex flex-row-reverse">
          <Button variant="outline" onClick={onClose} className="font-display gap-1">
            <X className="w-4 h-4" /> إلغاء
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuickAlternativesPanel;
