import React, { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, CheckCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface GlossaryChange {
  key: string;
  msbtFile: string;
  index: number;
  original: string;
  oldTranslation: string;
  newTranslation: string;
  replacedTerms: { eng: string; arb: string }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  changes: GlossaryChange[];
  onApply: (approvedKeys: Set<string>) => void;
}

/** Highlight replaced Arabic terms in the new translation */
function HighlightedText({ text, terms }: { text: string; terms: { arb: string }[] }) {
  if (!terms.length) return <span>{text}</span>;

  // Build regex for all Arabic replacement terms
  const escaped = terms.map(t => t.arb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => {
        const isMatch = terms.some(t => t.arb === part);
        return isMatch ? (
          <span key={i} className="bg-emerald-500/25 text-emerald-300 px-0.5 rounded font-semibold">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </span>
  );
}

export default function GlossaryApplyPreview({ open, onClose, changes, onApply }: Props) {
  const [approved, setApproved] = useState<Set<string>>(() => new Set(changes.map(c => c.key)));

  // Reset approved set when changes update
  React.useEffect(() => {
    setApproved(new Set(changes.map(c => c.key)));
  }, [changes]);

  const approvedCount = approved.size;
  const rejectedCount = changes.length - approved.size;

  const toggleApproval = (key: string) => {
    setApproved(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const approveAll = () => setApproved(new Set(changes.map(c => c.key)));
  const rejectAll = () => setApproved(new Set());

  const handleApply = () => {
    onApply(approved);
    onClose();
  };

  if (!changes.length) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b border-border/50">
          <DialogTitle className="text-base font-display flex items-center gap-2">
            معاينة تطبيق القاموس
            <Badge variant="secondary" className="text-xs">
              {changes.length} تغيير
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            راجع التغييرات قبل تطبيقها — يمكنك الموافقة أو رفض كل تغيير على حدة
          </DialogDescription>
        </DialogHeader>

        {/* Bulk actions */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30">
          <Button size="sm" variant="outline" onClick={approveAll}
            className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
            <CheckCheck className="w-3 h-3" /> موافقة للكل
          </Button>
          <Button size="sm" variant="outline" onClick={rejectAll}
            className="h-7 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10">
            <X className="w-3 h-3" /> رفض الكل
          </Button>
          <div className="mr-auto text-xs text-muted-foreground">
            ✅ {approvedCount} موافق — ❌ {rejectedCount} مرفوض
          </div>
        </div>

        {/* Changes list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-2">
            {changes.map((change) => {
              const isApproved = approved.has(change.key);
              return (
                <div
                  key={change.key}
                  className={`rounded-lg border p-3 transition-colors ${
                    isApproved
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-destructive/20 bg-destructive/5 opacity-60'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {change.msbtFile}:{change.index}
                      </span>
                      <div className="flex gap-1">
                        {change.replacedTerms.map((t, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] h-4 px-1 border-emerald-500/40 text-emerald-400">
                            {t.eng} → {t.arb}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleApproval(change.key)}
                      className={`h-6 w-6 p-0 ${isApproved ? 'text-emerald-400 hover:text-destructive' : 'text-destructive hover:text-emerald-400'}`}
                    >
                      {isApproved ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </Button>
                  </div>

                  {/* Original English */}
                  <div className="text-[11px] text-muted-foreground mb-1.5 font-mono leading-relaxed truncate" dir="ltr">
                    {change.original}
                  </div>

                  {/* Comparison */}
                  <div className="grid grid-cols-2 gap-2 text-sm" dir="rtl">
                    <div className="rounded bg-destructive/10 px-2 py-1.5 border border-destructive/20">
                      <div className="text-[10px] text-destructive/70 mb-0.5">السابقة</div>
                      <div className="leading-relaxed">{change.oldTranslation}</div>
                    </div>
                    <div className="rounded bg-emerald-500/10 px-2 py-1.5 border border-emerald-500/20">
                      <div className="text-[10px] text-emerald-400/70 mb-0.5">الجديدة</div>
                      <div className="leading-relaxed">
                        <HighlightedText text={change.newTranslation} terms={change.replacedTerms} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="p-3 border-t border-border/50 flex-row gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={approvedCount === 0}
            className="gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            تطبيق {approvedCount} تغيير
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
