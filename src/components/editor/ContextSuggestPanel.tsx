import React, { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Sparkles, Brain } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { ExtractedEntry } from "./types";

interface Suggestion {
  translation: string;
  style: "formal" | "natural" | "creative";
  styleLabel: string;
  reason: string;
  confidence: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  entry: ExtractedEntry;
  entries: ExtractedEntry[];
  translations: Record<string, string>;
  glossary?: string;
  onApplyTranslation: (key: string, translation: string) => void;
}

const STYLE_CONFIG: Record<string, { emoji: string; color: string }> = {
  formal: { emoji: "📜", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  natural: { emoji: "💬", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  creative: { emoji: "✨", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
};

export default function ContextSuggestPanel({ open, onClose, entry, entries, translations, glossary, onApplyTranslation }: Props) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [contextNote, setContextNote] = useState("");
  const [applied, setApplied] = useState<string | null>(null);

  const targetKey = `${entry.msbtFile}:${entry.index}`;

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setSuggestions([]);
    setContextNote("");
    setApplied(null);

    try {
      // Get surrounding entries from same file
      const sameFile = entries
        .filter(e => e.msbtFile === entry.msbtFile)
        .sort((a, b) => a.index - b.index);

      const currentIdx = sameFile.findIndex(e => e.index === entry.index);
      const start = Math.max(0, currentIdx - 3);
      const end = Math.min(sameFile.length, currentIdx + 4);

      const context = sameFile.slice(start, end).map(e => ({
        original: e.original,
        translation: translations[`${e.msbtFile}:${e.index}`] || undefined,
      }));

      const glossarySnippet = glossary
        ? glossary.split('\n').filter(l => l.trim() && l.includes('=')).slice(0, 40).join('\n')
        : undefined;

      const { data, error } = await supabase.functions.invoke('context-suggest', {
        body: {
          target: {
            original: entry.original,
            translation: translations[targetKey] || undefined,
          },
          context,
          glossary: glossarySnippet,
          file: entry.msbtFile,
        },
      });

      if (error) throw error;
      if (!data?.suggestions) throw new Error('No suggestions returned');

      setSuggestions(data.suggestions);
      setContextNote(data.contextNote || "");
    } catch (err: any) {
      toast({ title: "❌ خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [entry, entries, translations, glossary, targetKey]);

  // Auto-fetch on open
  React.useEffect(() => {
    if (open && suggestions.length === 0 && !loading) {
      fetchSuggestions();
    }
  }, [open]);

  const handleApply = (suggestion: Suggestion) => {
    onApplyTranslation(targetKey, suggestion.translation);
    setApplied(suggestion.translation);
    toast({ title: "✅ تم تطبيق الاقتراح", description: suggestion.styleLabel });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setSuggestions([]); } }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0" dir="rtl">
        <DialogHeader className="p-4 pb-2 border-b border-border/50">
          <DialogTitle className="text-sm font-display flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            اقتراحات سياقية بالذكاء الاصطناعي
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            ترجمات مقترحة تراعي سياق المشهد والحوارات المحيطة
          </DialogDescription>
        </DialogHeader>

        {/* Target text */}
        <div className="px-4 py-2 border-b border-border/30 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-1">النص الأصلي:</p>
          <p className="text-sm font-body" dir="ltr">{entry.original}</p>
          {translations[targetKey] && (
            <>
              <p className="text-xs text-muted-foreground mt-2 mb-1">الترجمة الحالية:</p>
              <p className="text-sm font-body text-primary/80" dir="rtl">{translations[targetKey]}</p>
            </>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="text-center py-12 space-y-3">
                <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
                <p className="text-sm text-muted-foreground">يتم تحليل السياق وتوليد الاقتراحات...</p>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">لا توجد اقتراحات بعد</p>
                <Button variant="outline" size="sm" onClick={fetchSuggestions} className="mt-3">
                  <Sparkles className="w-3.5 h-3.5" /> توليد اقتراحات
                </Button>
              </div>
            ) : (
              <>
                {contextNote && (
                  <div className="rounded-lg bg-accent/10 border border-accent/20 p-3 mb-3">
                    <p className="text-xs text-accent-foreground/80 font-body">
                      <strong>📝 ملاحظة السياق:</strong> {contextNote}
                    </p>
                  </div>
                )}

                {suggestions.map((s, i) => {
                  const style = STYLE_CONFIG[s.style] || STYLE_CONFIG.natural;
                  const isApplied = applied === s.translation;
                  return (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 transition-colors ${
                        isApplied ? 'border-primary/50 bg-primary/5' : 'border-border/30 hover:border-border/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={`text-[10px] h-5 px-2 ${style.color}`}>
                          {style.emoji} {s.styleLabel}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-5 px-2 bg-muted/50">
                          {Math.round(s.confidence * 100)}% ثقة
                        </Badge>
                        <Button
                          variant={isApplied ? "default" : "outline"}
                          size="sm"
                          className="mr-auto h-6 px-2 text-[10px]"
                          onClick={() => handleApply(s)}
                        >
                          {isApplied ? <Check className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                          {isApplied ? 'مُطبّق' : 'تطبيق'}
                        </Button>
                      </div>
                      <p className="text-sm font-body leading-relaxed mb-1.5" dir="rtl">{s.translation}</p>
                      <p className="text-[11px] text-muted-foreground">{s.reason}</p>
                    </div>
                  );
                })}

                <div className="text-center pt-2">
                  <Button variant="ghost" size="sm" onClick={fetchSuggestions} disabled={loading} className="text-xs">
                    <Sparkles className="w-3 h-3" /> توليد اقتراحات جديدة
                  </Button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
