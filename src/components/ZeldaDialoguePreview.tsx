import { X, AlertTriangle } from "lucide-react";

interface ZeldaDialoguePreviewProps {
  original: string;
  translation: string;
  label?: string;
  onClose: () => void;
}

const ZeldaDialoguePreview = ({ original, translation, label, onClose }: ZeldaDialoguePreviewProps) => {
  const originalLen = original.length;
  const translationLen = translation.length;
  const isOverLength = originalLen > 0 && translationLen > 0 && translationLen > originalLen * 1.2;
  const overPercent = originalLen > 0 ? Math.round(((translationLen - originalLen) / originalLen) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-[10vh] bg-black/80" onClick={onClose}>
      <div className="relative w-full max-w-3xl mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Close hint */}
        <div className="text-center mb-3">
          <span className="text-xs text-muted-foreground/60 font-body">اضغط في أي مكان للإغلاق</span>
        </div>

        {/* Speaker name tag */}
        {label && (
          <div className="inline-block mr-4 mb-0">
            <div
              className="px-4 py-1.5 rounded-t-lg text-sm font-display font-bold tracking-wide"
              style={{
                background: 'linear-gradient(180deg, hsl(140 15% 16%) 0%, hsl(140 15% 12%) 100%)',
                color: 'hsl(45 30% 90%)',
                borderTop: '2px solid hsl(45 50% 45% / 0.5)',
                borderLeft: '2px solid hsl(45 50% 45% / 0.5)',
                borderRight: '2px solid hsl(45 50% 45% / 0.5)',
              }}
            >
              {label}
            </div>
          </div>
        )}

        {/* Main dialogue box - Zelda TOTK style */}
        <div
          className="relative overflow-hidden rounded-xl"
          style={{
            background: 'linear-gradient(180deg, hsl(140 15% 12% / 0.95) 0%, hsl(140 20% 8% / 0.97) 100%)',
            border: '2px solid hsl(45 50% 45% / 0.4)',
            boxShadow: '0 0 40px hsl(140 30% 10% / 0.8), inset 0 1px 0 hsl(45 50% 60% / 0.1), 0 0 80px hsl(0 0% 0% / 0.5)',
          }}
        >
          {/* Subtle inner glow at top */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent 10%, hsl(45 50% 60% / 0.3) 50%, transparent 90%)' }}
          />

          {/* Diamond decorations in corners */}
          <div className="absolute top-2.5 right-3 text-[8px] opacity-40" style={{ color: 'hsl(45 60% 55%)' }}>◆</div>
          <div className="absolute top-2.5 left-3 text-[8px] opacity-40" style={{ color: 'hsl(45 60% 55%)' }}>◆</div>
          <div className="absolute bottom-2.5 right-3 text-[8px] opacity-40" style={{ color: 'hsl(45 60% 55%)' }}>◆</div>
          <div className="absolute bottom-2.5 left-3 text-[8px] opacity-40" style={{ color: 'hsl(45 60% 55%)' }}>◆</div>

          <div className="p-6 pr-8 pl-8">
            {/* Original text - small, above */}
            {original && (
              <div className="mb-3 pb-3" style={{ borderBottom: '1px solid hsl(45 30% 50% / 0.15)' }}>
                <span className="text-[10px] font-display uppercase tracking-widest" style={{ color: 'hsl(45 30% 55% / 0.5)' }}>
                  ORIGINAL
                </span>
                <p className="text-xs mt-1 leading-relaxed font-body" dir="ltr" style={{ color: 'hsl(45 20% 70% / 0.5)' }}>
                  {original}
                </p>
              </div>
            )}

            {/* Arabic translated text - main display */}
            <div dir="rtl">
              <p
                className="text-lg font-body leading-[2] tracking-wide"
                style={{ color: 'hsl(45 30% 92%)' }}
              >
                {translation || (
                  <span className="italic" style={{ color: 'hsl(45 20% 50% / 0.4)' }}>
                    لم يتم إدخال ترجمة بعد...
                  </span>
                )}
              </p>
            </div>

            {/* Bouncing arrow indicator */}
            {translation && !isOverLength && (
              <div className="flex justify-start mt-3">
                <span className="animate-bounce text-sm" style={{ color: 'hsl(45 60% 55% / 0.7)' }}>▼</span>
              </div>
            )}
          </div>

          {/* Length warning bar */}
          {isOverLength && (
            <div
              className="flex items-center gap-2 px-6 py-2.5"
              style={{
                background: 'linear-gradient(90deg, hsl(0 60% 30% / 0.3) 0%, transparent 100%)',
                borderTop: '1px solid hsl(0 60% 50% / 0.3)',
              }}
            >
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(0 70% 65%)' }} />
              <span className="text-xs font-display" style={{ color: 'hsl(0 70% 70%)' }}>
                النص أطول بنسبة {overPercent}% — قد لا يتسع ({translationLen}/{originalLen})
              </span>
            </div>
          )}

          {/* Length bar at bottom */}
          {originalLen > 0 && translationLen > 0 && (
            <div className="px-6 pb-4 pt-2">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-display" style={{ color: 'hsl(45 30% 55% / 0.4)' }}>
                  {Math.round((translationLen / originalLen) * 100)}%
                </span>
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'hsl(140 10% 20%)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((translationLen / originalLen) * 100, 100)}%`,
                      background: isOverLength
                        ? 'linear-gradient(90deg, hsl(0 70% 50%), hsl(0 70% 60%))'
                        : 'linear-gradient(90deg, hsl(145 60% 35%), hsl(45 60% 50%))',
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Close button - subtle */}
        <button
          onClick={onClose}
          className="absolute -top-2 -left-2 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
          style={{
            background: 'hsl(140 15% 15%)',
            border: '1.5px solid hsl(45 50% 45% / 0.4)',
            color: 'hsl(45 30% 70%)',
          }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default ZeldaDialoguePreview;
