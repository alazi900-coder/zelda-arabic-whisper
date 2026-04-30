import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, X, AlertTriangle } from "lucide-react";

export type AdvancedAction =
  | 'smart-review'
  | 'grammar-check'
  | 'context-review'
  | 'auto-correct'
  | 'detect-weak'
  | 'context-retranslate';

interface AdvancedFinding {
  key: string;
  original: string;
  current: string;
  fix: string;
  issue: string;
  type?: string;
  score?: number;
}

interface Props {
  action: AdvancedAction | null;
  findings: AdvancedFinding[];
  onApply: (key: string) => void;
  onDismiss: (key: string) => void;
  onApplyAll: () => void;
  onDismissAll: () => void;
}

const TITLES: Record<AdvancedAction, string> = {
  'smart-review': '🔬 مراجعة ذكية عميقة',
  'grammar-check': '✍️ فحص نحوي متخصّص',
  'context-review': '🎭 مراجعة مع سياق المشاهد',
  'auto-correct': '🔧 تصحيح إملائي/نحوي جماعي',
  'detect-weak': '⚠️ كشف الترجمات الضعيفة',
  'context-retranslate': '🎬 إعادة ترجمة مع سياق',
};

const AdvancedReviewPanel: React.FC<Props> = ({
  action, findings, onApply, onDismiss, onApplyAll, onDismissAll,
}) => {
  if (!action) return null;

  return (
    <div className="fixed inset-0 z-[9999]" dir="rtl">
      <div className="absolute inset-0 bg-black/70" onClick={onDismissAll} />
      <div className="absolute inset-4 sm:inset-8 md:inset-12 lg:inset-x-[15%] lg:inset-y-10 bg-background border rounded-lg shadow-2xl flex flex-col overflow-hidden">
        <div className="shrink-0 p-4 pb-3 border-b space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">{TITLES[action]}</h2>
              <p className="text-sm text-muted-foreground font-body mt-1">
                تم العثور على <span className="font-bold text-primary">{findings.length}</span> اقتراح — راجعها فردياً أو طبّق الكل دفعة واحدة
              </p>
            </div>
            <button onClick={onDismissAll} className="p-1 rounded-sm hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-end">
            <Button size="sm" variant="outline" onClick={onDismissAll} className="font-display gap-1 text-xs">
              <X className="w-3.5 h-3.5" /> تجاهل الكل
            </Button>
            <Button size="sm" onClick={onApplyAll} className="font-display gap-1 text-xs" disabled={findings.length === 0}>
              <CheckCircle2 className="w-3.5 h-3.5" /> تطبيق الكل ({findings.length})
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="space-y-2">
            {findings.length === 0 && (
              <div className="text-center text-muted-foreground font-body text-sm py-10">
                لا توجد اقتراحات متبقية
              </div>
            )}
            {findings.map((f) => (
              <div key={f.key} className="border rounded-md p-3 space-y-1.5 border-primary/30">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-body text-muted-foreground text-[11px] leading-relaxed flex-1 truncate" dir="ltr">
                    {f.original}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => onDismiss(f.key)} className="h-6 px-2 text-xs">
                      <X className="w-3 h-3" />
                    </Button>
                    <Button size="sm" onClick={() => onApply(f.key)} className="h-6 px-2 text-xs">
                      <CheckCircle2 className="w-3 h-3 ml-1" /> قبول
                    </Button>
                  </div>
                </div>

                {(f.issue || f.type || typeof f.score === 'number') && (
                  <div className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-body">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {typeof f.score === 'number' && <span className="font-semibold">درجة {f.score}/10</span>}
                    {f.type && <span className="opacity-70">[{f.type}]</span>}
                    {f.issue && <span>{f.issue}</span>}
                  </div>
                )}

                {f.current && (
                  <div className="text-xs font-body text-muted-foreground line-through" dir="rtl">
                    {f.current}
                  </div>
                )}
                <div className="text-xs font-body text-primary font-semibold" dir="rtl">
                  {f.fix}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 p-4 pt-3 border-t flex flex-row-reverse gap-2">
          <Button onClick={onApplyAll} className="font-display gap-1 flex-1 sm:flex-none" disabled={findings.length === 0}>
            <CheckCircle2 className="w-4 h-4" /> تطبيق الكل ({findings.length})
          </Button>
          <Button variant="outline" onClick={onDismissAll} className="font-display gap-1">
            <X className="w-4 h-4" /> إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdvancedReviewPanel;
