import React, { useState, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Check, X, Sparkles, AlertTriangle, CheckCircle2, Filter, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { utf16leByteLength } from "@/lib/byte-utils";
import type { ExtractedEntry } from "./types";

interface ImproveSuggestion {
  key: string;
  original: string;
  current: string;
  improved: string;
  reason: string;
  severity: "low" | "medium" | "high";
  category?: string;
  approved: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  entries: ExtractedEntry[];
  translations: Record<string, string>;
  glossary?: string;
  isFilterActive: boolean;
  filteredEntries: ExtractedEntry[];
  onApplyImprovements: (updates: Record<string, string>) => void;
}

const SEVERITY_CONFIG = {
  high: { emoji: "🔴", label: "خطير", color: "bg-destructive/10 text-destructive border-destructive/20" },
  medium: { emoji: "🟡", label: "متوسط", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  low: { emoji: "🟢", label: "بسيط", color: "bg-green-500/10 text-green-600 border-green-500/20" },
};

const BATCH_SIZE = 10;

export default function SmartBulkImprovePanel({
  open, onClose, entries, translations, glossary,
  isFilterActive, filteredEntries, onApplyImprovements,
}: Props) {
  const [suggestions, setSuggestions] = useState<ImproveSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analyzed, setAnalyzed] = useState(0);
  const [total, setTotal] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "medium" | "low">("all");

  // Build entry lookup for byte info
  const entryMap = useMemo(() => {
    const map = new Map<string, ExtractedEntry>();
    entries.forEach(e => map.set(`${e.msbtFile}:${e.index}`, e));
    return map;
  }, [entries]);

  const analyze = useCallback(async () => {
    setLoading(true);
    setSuggestions([]);
    setProgress(0);

    const sourceEntries = isFilterActive ? filteredEntries : entries;
    const translatedEntries = sourceEntries.filter(e => {
      const key = `${e.msbtFile}:${e.index}`;
      const t = translations[key]?.trim();
      return t && t !== e.original;
    });

    if (translatedEntries.length === 0) {
      toast({ title: "⚠️ لا توجد ترجمات للتحليل" });
      setLoading(false);
      return;
    }

    setTotal(translatedEntries.length);
    const allSuggestions: ImproveSuggestion[] = [];
    const totalBatches = Math.ceil(translatedEntries.length / BATCH_SIZE);

    try {
      for (let b = 0; b < totalBatches; b++) {
        const batch = translatedEntries.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        setAnalyzed(Math.min((b + 1) * BATCH_SIZE, translatedEntries.length));
        setProgress(((b + 1) / totalBatches) * 100);

        const batchEntries = batch.map(e => ({
          key: `${e.msbtFile}:${e.index}`,
          original: e.original,
          translation: translations[`${e.msbtFile}:${e.index}`],
          maxBytes: e.maxBytes,
        }));

        const glossarySnippet = glossary
          ? glossary.split('\n').filter(l => l.trim() && l.includes('=')).slice(0, 50).join('\n')
          : undefined;

        const { data, error } = await supabase.functions.invoke('smart-improve', {
          body: { entries: batchEntries, glossary: glossarySnippet },
        });

        if (error) throw error;
        if (data?.improvements) {
          const newSuggestions = data.improvements.map((imp: any) => ({
            ...imp,
            approved: imp.severity === 'high',
          }));
          allSuggestions.push(...newSuggestions);
          setSuggestions([...allSuggestions]);
        }

        if (b < totalBatches - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (allSuggestions.length === 0) {
        toast({ title: "✅ جودة ممتازة!", description: "لم يتم العثور على ترجمات تحتاج تحسين" });
      }
    } catch (err: any) {
      toast({ title: "❌ خطأ في التحليل", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [entries, translations, glossary, isFilterActive, filteredEntries]);

  React.useEffect(() => {
    if (open && suggestions.length === 0 && !loading) {
      analyze();
    }
  }, [open]);

  const toggleApproval = (key: string) => {
    setSuggestions(prev => prev.map(s =>
      s.key === key ? { ...s, approved: !s.approved } : s
    ));
  };

  const filteredSuggestions = useMemo(() =>
    severityFilter === "all" ? suggestions : suggestions.filter(s => s.severity === severityFilter),
    [suggestions, severityFilter]
  );

  const approvedCount = suggestions.filter(s => s.approved).length;

  // Stats summary
  const stats = useMemo(() => ({
    high: suggestions.filter(s => s.severity === "high").length,
    medium: suggestions.filter(s => s.severity === "medium").length,
    low: suggestions.filter(s => s.severity === "low").length,
  }), [suggestions]);

  const handleApplyAll = () => {
    const updates: Record<string, string> = {};
    for (const s of suggestions) {
      if (s.approved) updates[s.key] = s.improved;
    }
    onApplyImprovements(updates);
    toast({ title: `✅ تم تطبيق ${approvedCount} تحسين` });
    onClose();
    setSuggestions([]);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setSuggestions([]); } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0" dir="rtl">
        <DialogHeader className="p-4 pb-2 border-b border-border/50">
          <DialogTitle className="text-sm font-display flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            تحسين جماعي ذكي
            {suggestions.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">{suggestions.length} اقتراح</Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            تحليل تلقائي لجميع الترجمات واقتراح تحسينات للنصوص الضعيفة
          </DialogDescription>
        </DialogHeader>

        {/* Stats & Filter bar */}
        {suggestions.length > 0 && !loading && (
          <div className="px-4 py-2 border-b border-border/30 bg-muted/10 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground ml-1">تصفية:</span>
            {(["all", "high", "medium", "low"] as const).map(sev => {
              const count = sev === "all" ? suggestions.length : stats[sev];
              const isActive = severityFilter === sev;
              const config = sev === "all" ? null : SEVERITY_CONFIG[sev];
              return (
                <Button
                  key={sev}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className={`h-6 px-2 text-[10px] ${isActive ? '' : 'opacity-70'}`}
                  onClick={() => setSeverityFilter(sev)}
                >
                  {config ? `${config.emoji} ${config.label}` : <><Filter className="w-3 h-3" /> الكل</>}
                  <Badge variant="outline" className="text-[9px] h-4 px-1 mr-1">{count}</Badge>
                </Button>
              );
            })}
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] mr-auto" onClick={() => { setSuggestions([]); analyze(); }}>
              <RotateCcw className="w-3 h-3" /> إعادة التحليل
            </Button>
          </div>
        )}

        {loading && (
          <div className="px-4 py-3 border-b border-border/30">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>جارٍ تحليل {analyzed} / {total} نص...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-3">
            {!loading && suggestions.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-primary/30 mx-auto" />
                <p className="text-sm text-muted-foreground">لا توجد اقتراحات بعد</p>
              </div>
            ) : (
              filteredSuggestions.map((s) => {
                const sev = SEVERITY_CONFIG[s.severity];
                const entryData = entryMap.get(s.key);
                const improvedBytes = utf16leByteLength(s.improved);
                const maxBytes = entryData?.maxBytes || 0;
                const overBytes = maxBytes > 0 && improvedBytes > maxBytes;

                return (
                  <div
                    key={s.key}
                    className={`rounded-lg border p-3 transition-colors ${
                      s.approved ? 'border-primary/30 bg-primary/5' : 'border-border/30 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] h-5 px-2 ${sev.color}`}>
                        {sev.emoji} {sev.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">{s.key.split(':')[0]}</span>
                      {maxBytes > 0 && (
                        <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${overBytes ? 'border-destructive/50 text-destructive' : ''}`}>
                          {improvedBytes}/{maxBytes}B {overBytes ? '⚠️' : ''}
                        </Badge>
                      )}
                      <Button
                        variant={s.approved ? "default" : "ghost"}
                        size="sm"
                        className="mr-auto h-6 px-2 text-[10px]"
                        onClick={() => toggleApproval(s.key)}
                      >
                        {s.approved ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {s.approved ? 'معتمد' : 'مرفوض'}
                      </Button>
                    </div>

                    {/* Original English text */}
                    <p className="text-[10px] text-muted-foreground mb-1.5 truncate" dir="ltr">
                      🔤 {s.original}
                    </p>

                    <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                      <div>
                        <p className="text-muted-foreground mb-0.5">الحالية:</p>
                        <p className="font-body bg-destructive/5 rounded p-1.5 line-through opacity-70" dir="rtl">{s.current}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">المقترحة:</p>
                        <p className="font-body bg-primary/5 rounded p-1.5" dir="rtl">{s.improved}</p>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> {s.reason}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {suggestions.length > 0 && !loading && (
          <DialogFooter className="p-4 border-t border-border/50 flex-row items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Button variant="ghost" size="sm" className="text-xs"
                onClick={() => setSuggestions(prev => prev.map(s => ({ ...s, approved: true })))}>
                تحديد الكل
              </Button>
              <Button variant="ghost" size="sm" className="text-xs"
                onClick={() => setSuggestions(prev => prev.map(s => ({ ...s, approved: false })))}>
                إلغاء الكل
              </Button>
              <span className="text-xs text-muted-foreground">{approvedCount} / {suggestions.length} معتمد</span>
            </div>
            <Button size="sm" onClick={handleApplyAll} disabled={approvedCount === 0} className="font-display">
              <Check className="w-3.5 h-3.5" /> تطبيق {approvedCount} تحسين
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
