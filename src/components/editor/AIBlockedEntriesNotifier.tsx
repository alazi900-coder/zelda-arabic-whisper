import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AI_BLOCKED_EVENT,
  type BlockedAIEntry,
} from "@/lib/ai-blocked-notify";
import {
  visualize,
  classifyBlockReason,
  BLOCK_REASON_LABEL_AR,
} from "@/lib/tag-report-format";

/**
 * يستمع لأحداث «نصّ مُحظَر من الإرسال للذكاء الاصطناعي»، يجمعها، ويُظهر
 * Toast يفتح نافذة تفصيليّة بالنصّ المُرئي وسبب التصنيف.
 */
export function AIBlockedEntriesNotifier() {
  const [blocked, setBlocked] = useState<BlockedAIEntry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onEvt(e: Event) {
      const detail = (e as CustomEvent<BlockedAIEntry[]>).detail || [];
      if (!detail.length) return;
      setBlocked(prev => {
        const seen = new Set(prev.map(b => b.key));
        const merged = [...prev];
        for (const b of detail) if (!seen.has(b.key)) merged.push(b);
        return merged;
      });
      toast({
        title: `🚫 تم منع ${detail.length} نصّ من الإرسال للذكاء الاصطناعي`,
        description:
          "هذه النصوص مكوّنة من رموز PUA / علامات تنسيق / علامات اتجاه فقط. ترجمتها ستُتلف الرموز وتُسبّب ظهور `??` داخل اللعبة.",
        action: (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            عرض التفاصيل
          </Button>
        ),
      });
    }
    window.addEventListener(AI_BLOCKED_EVENT, onEvt);
    return () => window.removeEventListener(AI_BLOCKED_EVENT, onEvt);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>النصوص المحظور إرسالها للذكاء الاصطناعي</DialogTitle>
          <DialogDescription>
            عدد النصوص: {blocked.length}. تُحفظ هذه النصوص كما هي في الأصل ولا
            يُسمح بإرسالها للذكاء الاصطناعي لأنّ ترجمتها ستُفسد رموز اللعبة.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2">
          <ul className="space-y-3">
            {blocked.length === 0 && (
              <li className="text-sm text-muted-foreground">لا توجد نصوص محظورة.</li>
            )}
            {blocked.map((b, i) => {
              const reason = classifyBlockReason(b.original);
              return (
                <li key={`${b.key}-${i}`} className="rounded border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant="outline" className="font-mono text-[10px]">{b.key}</Badge>
                    <Badge variant="secondary">{BLOCK_REASON_LABEL_AR[reason]}</Badge>
                  </div>
                  <div className="text-muted-foreground text-xs mb-1">المحتوى المُرئي:</div>
                  <pre dir="ltr" className="font-mono text-xs bg-muted/50 rounded px-2 py-1 whitespace-pre-wrap break-all">
                    {visualize(b.original)}
                  </pre>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
        <div className="flex justify-between items-center pt-2">
          <Button size="sm" variant="ghost" onClick={() => setBlocked([])}>
            مسح القائمة
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>إغلاق</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
