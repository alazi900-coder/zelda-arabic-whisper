import React, { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Sparkles, Columns, Copy, Pencil, X, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { utf16leByteLength } from "@/lib/byte-utils";
import type { ExtractedEntry } from "./types";
import { categorizeFile } from "./types";

interface EngineResult {
  engine: string;
  label: string;
  emoji: string;
  translation: string;
  loading: boolean;
  error?: string;
}

// In-memory cache (cleared on full page refresh).
const cache = new Map<string, EngineResult[]>();

interface Props {
  open: boolean;
  onClose: () => void;
  entry: ExtractedEntry;
  entries: ExtractedEntry[];
  translations: Record<string, string>;
  glossary?: string;
  userGeminiKey: string;
  userClaudeKey: string;
  userBedrockApiKey: string;
  userBedrockRegion: string;
  myMemoryEmail: string;
  onApplyTranslation: (key: string, translation: string) => void;
}

export default function EngineComparePanel({
  open, onClose, entry, entries, translations, glossary,
  userGeminiKey, userClaudeKey, userBedrockApiKey, userBedrockRegion, myMemoryEmail, onApplyTranslation,
}: Props) {
  const [results, setResults] = useState<EngineResult[]>([]);
  const [applied, setApplied] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [editingEngine, setEditingEngine] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const targetKey = `${entry.msbtFile}:${entry.index}`;

  // Load cached results when reopening for the same entry
  useEffect(() => {
    if (!open) return;
    const cached = cache.get(targetKey);
    if (cached) {
      setResults(cached);
    } else {
      setResults([]);
    }
    setApplied(null);
    setEditingEngine(null);
  }, [open, targetKey]);

  const getByteInfo = (text: string) => {
    const bytes = utf16leByteLength(text);
    const max = entry.maxBytes;
    const over = max > 0 && bytes > max;
    return { bytes, max, over };
  };

  const fetchAllEngines = useCallback(async () => {
    setFetching(true);
    setApplied(null);
    setEditingEngine(null);

    const engines: { id: string; label: string; emoji: string }[] = [
      { id: "lovable", label: "Lovable AI", emoji: "🤖" },
      { id: "google", label: "Google Translate", emoji: "🔤" },
      { id: "mymemory", label: "MyMemory", emoji: "🌐" },
    ];
    if (userGeminiKey) {
      engines.push({ id: "gemini", label: "Gemini (شخصي)", emoji: "✨" });
    }
    if (userClaudeKey) {
      engines.push({ id: "claude", label: "Claude (شخصي)", emoji: "🧠" });
    }
    if (userBedrockApiKey) {
      engines.push({ id: "bedrock", label: "Amazon Bedrock", emoji: "☁️" });
    }

    const initialResults: EngineResult[] = engines.map(e => ({
      engine: e.id, label: e.label, emoji: e.emoji,
      translation: "", loading: true,
    }));
    setResults(initialResults);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const idx = entries.indexOf(entry);
    const contextEntries = [-2, -1, 1, 2]
      .map(offset => entries[idx + offset])
      .filter(n => n && translations[`${n.msbtFile}:${n.index}`]?.trim())
      .map(n => ({ key: `${n.msbtFile}:${n.index}`, original: n.original, translation: translations[`${n.msbtFile}:${n.index}`] }));

    const category = categorizeFile(entry.msbtFile, entry.label);

    const promises = engines.map(async (eng) => {
      try {
        const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/translate-entries`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entries: [{ key: targetKey, original: entry.original, label: entry.label, maxBytes: entry.maxBytes }],
            glossary: glossary || undefined,
            context: contextEntries.length > 0 ? contextEntries : undefined,
            userApiKey: eng.id === 'gemini' ? userGeminiKey : undefined,
            userClaudeKey: eng.id === 'claude' ? userClaudeKey : undefined,
            userBedrockApiKey: eng.id === 'bedrock' ? userBedrockApiKey : undefined,
            userBedrockRegion: eng.id === 'bedrock' ? userBedrockRegion : undefined,
            translationEngine: eng.id,
            translationQuality: 'quality',
            myMemoryEmail: eng.id === 'mymemory' ? myMemoryEmail : undefined,
            category,
            filePath: entry.msbtFile,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error || `خطأ ${response.status}`);
        }

        const data = await response.json();
        const translation = data.translations?.[targetKey] || "";

        setResults(prev => prev.map(r =>
          r.engine === eng.id ? { ...r, translation, loading: false } : r
        ));
      } catch (err: any) {
        setResults(prev => prev.map(r =>
          r.engine === eng.id ? { ...r, loading: false, error: err.message } : r
        ));
      }
    });

    await Promise.allSettled(promises);
    setFetching(false);
    // Cache the final results
    setResults(prev => {
      cache.set(targetKey, prev);
      return prev;
    });
  }, [entry, entries, translations, glossary, userGeminiKey, userClaudeKey, userBedrockApiKey, userBedrockRegion, myMemoryEmail, targetKey]);

  const handleApply = (text: string, label: string, engine: string) => {
    if (!text) return;
    onApplyTranslation(targetKey, text);
    setApplied(engine);
    toast({ title: "✅ تم تطبيق الترجمة", description: `من محرك ${label}` });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "📋 تم النسخ" });
  };

  const startEdit = (engine: string, text: string) => {
    setEditingEngine(engine);
    setEditText(text);
  };

  const applyEdit = (engine: string) => {
    setResults(prev => prev.map(r => r.engine === engine ? { ...r, translation: editText } : r));
    setEditingEngine(null);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="w-[calc(100vw-1rem)] max-w-3xl h-[92dvh] sm:h-[85vh] max-h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden"
        dir="rtl"
      >
        <DialogHeader className="p-4 pb-2 border-b border-border/50">
          <DialogTitle className="text-sm font-display flex items-center gap-2">
            <Columns className="w-4 h-4 text-primary" />
            مقارنة بين محركات الترجمة
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            مقارنة جنب-لجنب لاختيار أفضل ترجمة من محركات مختلفة
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-4 space-y-3">
            <div className="rounded-lg border border-border/30 bg-muted/20 p-3 space-y-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">النص الأصلي:</p>
                <p className="text-sm font-body break-words whitespace-pre-wrap" dir="ltr">{entry.original}</p>
              </div>
              {translations[targetKey] && (
                <div className="pt-2 border-t border-border/20">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[10px] text-muted-foreground">الترجمة الحالية:</p>
                    {entry.maxBytes > 0 && (() => {
                      const info = getByteInfo(translations[targetKey]);
                      return (
                        <Badge variant="outline" className={`text-[9px] h-4 px-1.5 shrink-0 ${info.over ? 'border-destructive/50 text-destructive' : ''}`}>
                          {info.bytes}/{info.max}B
                        </Badge>
                      );
                    })()}
                  </div>
                  <p className="text-sm font-body text-primary/80 break-words whitespace-pre-wrap" dir="rtl">{translations[targetKey]}</p>
                </div>
              )}
            </div>
            {results.length === 0 && !fetching && (
              <div className="text-center py-12 space-y-3">
                <Columns className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">اضغط الزر أدناه لجلب الترجمات من المحركات المختلفة</p>
                <Button variant="default" size="sm" onClick={fetchAllEngines} className="mt-2">
                  <Sparkles className="w-3.5 h-3.5" /> بدء المقارنة
                </Button>
              </div>
            )}
            {results.map((r) => {
              const isEditing = editingEngine === r.engine;
              const byteInfo = r.translation ? getByteInfo(r.translation) : null;

              return (
                <div
                  key={r.engine}
                  className={`rounded-lg border p-4 transition-colors ${
                    applied === r.engine ? 'border-primary/50 bg-primary/5' : 'border-border/30 hover:border-border/60'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Badge variant="outline" className="text-xs h-6 px-2.5 font-display">
                      {r.emoji} {r.label}
                    </Badge>
                    {!r.loading && byteInfo && entry.maxBytes > 0 && (
                      <Badge variant="outline" className={`text-[9px] h-5 px-1.5 ${byteInfo.over ? 'border-destructive/50 text-destructive bg-destructive/5' : ''}`}>
                        {byteInfo.bytes}/{byteInfo.max}B {byteInfo.over ? '⚠️' : '✓'}
                      </Badge>
                    )}
                  </div>

                  {r.loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جارٍ الترجمة...
                    </div>
                  ) : r.error ? (
                    <p className="text-sm text-destructive">❌ {r.error}</p>
                  ) : isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        className="w-full text-sm font-body rounded-md border border-primary/30 bg-background p-2 min-h-[60px] resize-y focus:outline-none focus:ring-1 focus:ring-primary/50"
                        dir="rtl"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        {entry.maxBytes > 0 && (() => {
                          const editInfo = getByteInfo(editText);
                          return (
                            <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${editInfo.over ? 'border-destructive/50 text-destructive' : ''}`}>
                              {editInfo.bytes}/{editInfo.max}B
                            </Badge>
                          );
                        })()}
                        <div className="mr-auto flex gap-1">
                          <Button size="sm" className="h-6 px-2 text-[10px]" onClick={() => applyEdit(r.engine)}>
                            <Check className="w-3 h-3" /> حفظ
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setEditingEngine(null)}>
                            <X className="w-3 h-3" /> إلغاء
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-body leading-relaxed mb-2" dir="rtl">
                        {r.translation || <span className="text-muted-foreground">لم يتم الحصول على ترجمة</span>}
                      </p>
                      {r.translation && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/20">
                          <Button
                            variant={applied === r.engine ? "default" : "outline"}
                            size="sm"
                            className="h-7 px-2.5 text-[11px] flex-1 sm:flex-initial"
                            onClick={() => handleApply(r.translation, r.label, r.engine)}
                          >
                            {applied === r.engine ? <Check className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                            {applied === r.engine ? 'مُطبّق' : 'تطبيق'}
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => startEdit(r.engine, r.translation)}>
                            <Pencil className="w-3 h-3" /> تعديل
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleCopy(r.translation)} title="نسخ">
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {!fetching && results.length > 0 && (
              <div className="text-center pt-2">
                <Button variant="outline" size="sm" onClick={() => { cache.delete(targetKey); setResults([]); fetchAllEngines(); }} className="text-xs">
                  <RefreshCw className="w-3 h-3" /> إعادة المقارنة
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
