import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { ExtractedEntry } from "./types";
import { findSimilarTranslations, type TMMatch } from "@/hooks/useTranslationMemory";

interface Props {
  open: boolean;
  onClose: () => void;
  entry: ExtractedEntry;
  entries: ExtractedEntry[];
  translations: Record<string, string>;
  onApplyTranslation: (key: string, translation: string) => void;
}

export default function TranslationMemoryPanel({ open, onClose, entry, entries, translations, onApplyTranslation }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const matches = useMemo(() => {
    return findSimilarTranslations(entry, entries, translations, 15, 0.3);
  }, [entry, entries, translations]);

  const targetKey = `${entry.msbtFile}:${entry.index}`;

  const handleApply = (match: TMMatch) => {
    onApplyTranslation(targetKey, match.translation);
    setCopiedKey(match.key);
    toast({ title: "✅ تم تطبيق الترجمة", description: `من ${match.file}` });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const similarityColor = (sim: number) => {
    if (sim >= 0.8) return "bg-green-500/20 text-green-600 border-green-500/30";
    if (sim >= 0.6) return "bg-amber-500/20 text-amber-600 border-amber-500/30";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0" dir="rtl">
        <DialogHeader className="p-4 pb-2 border-b border-border/50">
          <DialogTitle className="text-sm font-display flex items-center gap-2">
            🧠 ذاكرة الترجمة
            <Badge variant="secondary" className="text-[10px]">{matches.length} نتيجة</Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            ترجمات مشابهة من نصوص أخرى في المشروع — اضغط لتطبيقها
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 py-2 border-b border-border/30 bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">النص الأصلي:</p>
          <p className="text-sm font-body" dir="ltr">{entry.original}</p>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-2">
            {matches.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">لم يتم العثور على ترجمات مشابهة</p>
            ) : (
              matches.map(match => (
                <div
                  key={match.key}
                  className="rounded-lg border border-border/30 hover:border-border/60 p-3 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${similarityColor(match.similarity)}`}>
                      {Math.round(match.similarity * 100)}% تطابق
                    </Badge>
                    <span className="text-[10px] text-muted-foreground truncate">{match.file}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mr-auto h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleApply(match)}
                    >
                      {copiedKey === match.key ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      تطبيق
                    </Button>
                  </div>
                  <p className="text-xs text-foreground/70 mb-1 leading-relaxed" dir="ltr">{match.original}</p>
                  <p className="text-xs text-primary/80 leading-relaxed" dir="rtl">{match.translation}</p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
