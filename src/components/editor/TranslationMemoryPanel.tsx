import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Pencil, X } from "lucide-react";
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
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const matches = useMemo(() => {
    return findSimilarTranslations(entry, entries, translations, 15, 0.25);
  }, [entry, entries, translations]);

  const targetKey = `${entry.msbtFile}:${entry.index}`;

  const handleApply = (match: TMMatch) => {
    onApplyTranslation(targetKey, match.translation);
    setCopiedKey(match.key);
    toast({ title: "✅ تم تطبيق الترجمة", description: `من ${match.file}` });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleEditApply = (match: TMMatch) => {
    onApplyTranslation(targetKey, editText);
    setEditingKey(null);
    toast({ title: "✅ تم تطبيق الترجمة المعدّلة" });
  };

  const similarityColor = (sim: number, matchType: TMMatch['matchType']) => {
    if (matchType === 'exact') return "bg-emerald-500/20 text-emerald-600 border-emerald-500/30";
    if (sim >= 0.7) return "bg-green-500/20 text-green-600 border-green-500/30";
    if (sim >= 0.5) return "bg-amber-500/20 text-amber-600 border-amber-500/30";
    return "bg-muted text-muted-foreground";
  };

  const matchTypeLabel = (matchType: TMMatch['matchType']) => {
    switch (matchType) {
      case 'exact': return '🎯 مطابق';
      case 'fuzzy': return '🔍 مشابه';
      case 'partial': return '📎 جزئي';
    }
  };

  // Group by match type
  const grouped = useMemo(() => {
    const exact = matches.filter(m => m.matchType === 'exact');
    const fuzzy = matches.filter(m => m.matchType === 'fuzzy');
    const partial = matches.filter(m => m.matchType === 'partial');
    return { exact, fuzzy, partial };
  }, [matches]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0" dir="rtl">
        <DialogHeader className="p-4 pb-2 border-b border-border/50">
          <DialogTitle className="text-sm font-display flex items-center gap-2">
            🧠 ذاكرة الترجمة المحسّنة
            <Badge variant="secondary" className="text-[10px]">{matches.length} نتيجة</Badge>
            {grouped.exact.length > 0 && (
              <Badge variant="default" className="text-[10px] bg-emerald-500/20 text-emerald-600 border-emerald-500/30">{grouped.exact.length} مطابق</Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            ترجمات مشابهة من نصوص أخرى — تطابق بالكلمات والعبارات والسياق
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
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${similarityColor(match.similarity, match.matchType)}`}>
                      {Math.round(match.similarity * 100)}% {matchTypeLabel(match.matchType)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground truncate">{match.file}</span>
                    {match.matchedWords && match.matchedWords.length > 0 && (
                      <span className="text-[9px] text-muted-foreground/60">
                        كلمات: {match.matchedWords.slice(0, 4).join(', ')}
                      </span>
                    )}
                    <div className="mr-auto flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => { setEditingKey(match.key); setEditText(match.translation); }}
                        title="تعديل قبل التطبيق"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleApply(match)}
                      >
                        {copiedKey === match.key ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        تطبيق
                      </Button>
                    </div>
                  </div>
                  
                  {editingKey === match.key ? (
                    <div className="space-y-2">
                      <p className="text-xs text-foreground/70 leading-relaxed" dir="ltr">{match.original}</p>
                      <textarea
                        className="w-full text-sm font-body rounded-md border border-primary/30 bg-background p-2 min-h-[50px] resize-y focus:outline-none focus:ring-1 focus:ring-primary/50"
                        dir="rtl"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <Button size="sm" className="h-6 px-2 text-[10px]" onClick={() => handleEditApply(match)}>
                          <Check className="w-3 h-3" /> تطبيق المعدّل
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setEditingKey(null)}>
                          <X className="w-3 h-3" /> إلغاء
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-foreground/70 mb-1 leading-relaxed" dir="ltr">{match.original}</p>
                      <p className="text-xs text-primary/80 leading-relaxed" dir="rtl">{match.translation}</p>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
