import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, X, AlertCircle } from "lucide-react";
import type { RestoreReport } from "@/lib/tag-restore";

interface FixTagsLineBreaksDialogProps {
  open: boolean;
  report: RestoreReport | null;
  onClose: () => void;
  onApply: () => void;
}

/** يرسم النصّ ويُظهر الرموز التقنيّة (PUA + FFF9..FFFC) كشارات مرئيّة،
 *  ويُظهر فاصل السطر (\n) كرمز ¶ ثمّ ينزل سطراً جديداً. */
function RenderTextWithTags({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let buf = "";
  let i = 0;
  const flushBuf = () => {
    if (buf) {
      parts.push(<span key={parts.length}>{buf}</span>);
      buf = "";
    }
  };
  while (i < text.length) {
    const ch = text[i];
    const code = ch.charCodeAt(0);
    if ((code >= 0xe000 && code <= 0xe0ff) || (code >= 0xfff9 && code <= 0xfffc)) {
      flushBuf();
      parts.push(
        <span
          key={parts.length}
          className="inline-block mx-0.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 border border-amber-500/30 text-[10px] font-mono align-middle"
        >
          U+{code.toString(16).toUpperCase().padStart(4, "0")}
        </span>,
      );
    } else if (ch === "\n") {
      flushBuf();
      parts.push(
        <span key={parts.length} className="text-primary/60 mx-0.5">
          ¶
        </span>,
        <br key={parts.length + "_br"} />,
      );
    } else {
      buf += ch;
    }
    i++;
  }
  flushBuf();
  return <span className="leading-relaxed">{parts}</span>;
}

const FixTagsLineBreaksDialog: React.FC<FixTagsLineBreaksDialogProps> = ({
  open, report, onClose, onApply,
}) => {
  const fixable = report?.fixable ?? 0;
  const scanned = report?.scanned ?? 0;
  const examples = report?.examples ?? [];
  const byFile = report?.byFile ?? {};
  const fileEntries = Object.entries(byFile).sort((a, b) => b[1] - a[1]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            🛠️ إصلاح الرموز التقنية وفواصل السطور
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            فحص محلّي بدون ذكاء اصطناعي — يستعيد الرموز التي تحذفها/تشوّهها الترجمة،
            ويرجّع فواصل السطور (\n) عندما يدمج المترجِم الأسطر في سطر واحد.
          </DialogDescription>
        </DialogHeader>

        {/* ملخّص الفحص */}
        <div className="grid grid-cols-3 gap-2 my-2">
          <div className="rounded-md border border-border bg-card/40 p-3 text-center">
            <div className="text-2xl font-display">{scanned}</div>
            <div className="text-[11px] text-muted-foreground">ترجمة مفحوصة</div>
          </div>
          <div className={`rounded-md border p-3 text-center ${fixable > 0 ? "border-amber-500/40 bg-amber-500/10" : "border-emerald-500/40 bg-emerald-500/10"}`}>
            <div className={`text-2xl font-display ${fixable > 0 ? "text-amber-700" : "text-emerald-700"}`}>{fixable}</div>
            <div className="text-[11px] text-muted-foreground">قابلة للإصلاح</div>
          </div>
          <div className="rounded-md border border-border bg-card/40 p-3 text-center">
            <div className="text-2xl font-display">{fileEntries.length}</div>
            <div className="text-[11px] text-muted-foreground">ملف متأثّر</div>
          </div>
        </div>

        {fixable === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-emerald-700">
            <CheckCircle2 className="w-10 h-10" />
            <div className="font-body text-sm">
              لا توجد مشاكل — كلّ الترجمات تحتوي على الرموز وفواصل السطور كما في النصّ الأصلي.
            </div>
          </div>
        ) : (
          <>
            {/* أعلى الملفّات تأثّراً */}
            {fileEntries.length > 0 && (
              <div className="rounded-md border border-border bg-muted/10 p-2 mb-2">
                <div className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> توزيع المشاكل على الملفّات (أعلى الملفّات):
                </div>
                <div className="flex flex-wrap gap-1 text-[11px]">
                  {fileEntries.slice(0, 10).map(([file, count]) => (
                    <span key={file} className="px-1.5 py-0.5 rounded bg-card border border-border font-mono">
                      <span className="text-muted-foreground">{file}</span>
                      <span className="mr-1 text-amber-700 font-bold">×{count}</span>
                    </span>
                  ))}
                  {fileEntries.length > 10 && (
                    <span className="text-muted-foreground">… +{fileEntries.length - 10} ملفّ آخر</span>
                  )}
                </div>
              </div>
            )}

            <div className="text-[11px] text-muted-foreground mb-1">
              عيّنات (أوّل {examples.length} حالة من {fixable}):
            </div>
            <ScrollArea className="flex-1 max-h-[40vh] border border-border rounded-md">
              <div className="divide-y divide-border">
                {examples.map((ex, idx) => (
                  <div key={ex.key} className="p-3 hover:bg-muted/10 transition-colors space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-mono bg-muted/30 px-1.5 py-0.5 rounded">
                        {idx + 1}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[200px]">
                        {ex.msbtFile}
                      </span>
                      <span className="text-[11px] text-muted-foreground/70 truncate">{ex.label}</span>
                      {ex.missingTags > 0 && (
                        <span className="text-[10px] bg-amber-500/15 text-amber-700 border border-amber-500/30 px-1.5 py-0.5 rounded">
                          رمز ناقص ×{ex.missingTags}
                        </span>
                      )}
                      {ex.missingLineBreaks > 0 && (
                        <span className="text-[10px] bg-blue-500/15 text-blue-700 border border-blue-500/30 px-1.5 py-0.5 rounded">
                          فاصل سطر ناقص ×{ex.missingLineBreaks}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-body" dir="rtl">
                      <span className="text-muted-foreground/60 text-[10px] ml-1">الأصل:</span>
                      <RenderTextWithTags text={ex.original} />
                    </div>
                    <div className="text-[11px] font-body" dir="rtl">
                      <span className="text-muted-foreground/60 text-[10px] ml-1">قبل:</span>
                      <span className="bg-destructive/10 rounded-sm px-1">
                        <RenderTextWithTags text={ex.before} />
                      </span>
                    </div>
                    <div className="text-[11px] font-body" dir="rtl">
                      <span className="text-muted-foreground/60 text-[10px] ml-1">بعد:</span>
                      <span className="bg-primary/10 rounded-sm px-1">
                        <RenderTextWithTags text={ex.after} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose} className="font-body">
            <X className="w-4 h-4 ml-1" /> إغلاق
          </Button>
          {fixable > 0 && (
            <Button onClick={onApply} className="font-body">
              <CheckCircle2 className="w-4 h-4 ml-1" /> إصلاح {fixable} ترجمة الآن
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FixTagsLineBreaksDialog;
