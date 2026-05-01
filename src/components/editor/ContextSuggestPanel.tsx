import React, { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Sparkles, Brain, Copy, Pencil, X, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { utf16leByteLength } from "@/lib/byte-utils";
import type { ExtractedEntry } from "./types";

interface Suggestion {
  translation: string;
  style: "formal" | "natural" | "creative";
  styleLabel: string;
  reason: string;
  confidence: number;
}

interface CacheEntry {
  suggestions: Suggestion[];
  contextNote: string;
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

// In-memory cache shared across opens (cleared on full page refresh).
const cache = new Map<string, CacheEntry>();

export default function ContextSuggestPanel({ open, onClose, entry, entries, translations, glossary, onApplyTranslation }: Props) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [contextNote, setContextNote] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const targetKey = `${entry.msbtFile}:${entry.index}`;

  // Load from cache when reopened for the same entry
  useEffect(() => {
    if (!open) return;
    const cached = cache.get(targetKey);
    if (cached) {
      setSuggestions(cached.suggestions);
      setContextNote(cached.contextNote);
    } else {
      setSuggestions([]);
      setContextNote("");
    }
    setApplied(null);
    setEditingIdx(null);
  }, [open, targetKey]);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setApplied(null);
    setEditingIdx(null);

    try {
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

      const result: CacheEntry = {
        suggestions: data.suggestions,
        contextNote: data.contextNote || "",
      };
      cache.set(targetKey, result);
      setSuggestions(result.suggestions);
      setContextNote(result.contextNote);
    } catch (err: any) {
      toast({ title: "❌ خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [entry, entries, translations, glossary, targetKey]);

  const handleApply = (text: string, label: string) => {
    onApplyTranslation(targetKey, text);
    setApplied(text);
    toast({ title: "✅ تم تطبيق الاقتراح", description: label });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "📋 تم النسخ" });
  };

  const startEdit = (idx: number, text: string) => {
    setEditingIdx(idx);
    setEditText(text);
  };

  const applyEdit = (idx: number) => {
    setSuggestions(prev => prev.map((s, i) => i === idx ? { ...s, translation: editText } : s));
    setEditingIdx(null);
  };

  const getByteInfo = (text: string) => {
    const bytes = utf16leByteLength(text);
    const max = entry.maxBytes;
    const pct = max > 0 ? Math.round((bytes / max) * 100) : 0;
    const over = max > 0 && bytes > max;
    return { bytes, max, pct, over };
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="w-[calc(100vw-1rem)] max-w-2xl h-[92dvh] sm:h-[85vh] max-h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden"
        dir="rtl"
      >
        <DialogHeader className="p-4 pb-2 border-b border-border/50 shrink-0">
          <DialogTitle className="text-sm font-display flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            اقتراحات سياقية بالذكاء الاصطناعي
            {suggestions.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">{suggestions.length} اقتراح</Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            ترجمات مقترحة تراعي سياق المشهد والحوارات المحيطة
          </DialogDescription>
        </DialogHeader>

        {/* Target text */}
        <div className="px-4 py-2 border-b border-border/30 bg-muted/20 shrink-0">
          <p className="text-xs text-muted-foreground mb-1">النص الأصلي:</p>
          <p className="text-sm font-body" dir="ltr">{entry.original}</p>
          {translations[targetKey] && (
            <>
              <p className="text-xs text-muted-foreground mt-2 mb-1">الترجمة الحالية:</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-body text-primary/80 flex-1" dir="rtl">{translations[targetKey]}</p>
                {entry.maxBytes > 0 && (() => {
                  const info = getByteInfo(translations[targetKey]);
                  return (
                    <Badge variant="outline" className={`text-[9px] h-4 px-1.5 shrink-0 ${info.over ? 'border-destructive/50 text-destructive' : 'border-border/30'}`}>
                      {info.bytes}/{info.max}B
                    </Badge>
                  );
                })()}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="text-center py-12 space-y-3">
                <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
                <p className="text-sm text-muted-foreground">يتم تحليل السياق وتوليد الاقتراحات...</p>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">اضغط الزر أدناه لتوليد اقتراحات سياقية بالـ AI</p>
                <Button variant="default" size="sm" onClick={fetchSuggestions} className="mt-2">
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
                  const byteInfo = getByteInfo(s.translation);
                  const isEditing = editingIdx === i;

                  return (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 transition-colors ${
                        isApplied ? 'border-primary/50 bg-primary/5' : 'border-border/30 hover:border-border/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] h-5 px-2 ${style.color}`}>
                          {style.emoji} {s.styleLabel}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-5 px-2 bg-muted/50">
                          {Math.round(s.confidence * 100)}% ثقة
                        </Badge>
                        {entry.maxBytes > 0 && (
                          <Badge variant="outline" className={`text-[9px] h-5 px-1.5 ${byteInfo.over ? 'border-destructive/50 text-destructive bg-destructive/5' : 'border-border/30'}`}>
                            {byteInfo.bytes}/{byteInfo.max}B {byteInfo.over ? '⚠️' : '✓'}
                          </Badge>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            className="w-full text-sm font-body rounded-md border border-primary/30 bg-background p-2 min-h-[60px] resize-y focus:outline-none focus:ring-1 focus:ring-primary/50"
                            dir="rtl"
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                          />
                          <div className="flex items-center gap-2 flex-wrap">
                            {entry.maxBytes > 0 && (() => {
                              const editInfo = getByteInfo(editText);
                              return (
                                <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${editInfo.over ? 'border-destructive/50 text-destructive' : ''}`}>
                                  {editInfo.bytes}/{editInfo.max}B
                                </Badge>
                              );
                            })()}
                            <div className="mr-auto flex gap-1">
                              <Button size="sm" className="h-7 px-2 text-[10px]" onClick={() => applyEdit(i)}>
                                <Check className="w-3 h-3" /> حفظ
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => setEditingIdx(null)}>
                                <X className="w-3 h-3" /> إلغاء
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm font-body leading-relaxed mb-2" dir="rtl">{s.translation}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground mb-2">{s.reason}</p>

                      {/* Action buttons — always visible (no opacity tricks for mobile) */}
                      {!isEditing && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/20">
                          <Button
                            variant={isApplied ? "default" : "outline"}
                            size="sm"
                            className="h-7 px-2.5 text-[11px] flex-1 sm:flex-initial"
                            onClick={() => handleApply(s.translation, s.styleLabel)}
                          >
                            {isApplied ? <Check className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                            {isApplied ? 'مُطبّق' : 'تطبيق'}
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => startEdit(i, s.translation)}>
                            <Pencil className="w-3 h-3" /> تعديل
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleCopy(s.translation)} title="نسخ">
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="text-center pt-2">
                  <Button variant="outline" size="sm" onClick={fetchSuggestions} disabled={loading} className="text-xs">
                    <RefreshCw className="w-3 h-3" /> توليد اقتراحات جديدة
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
