import React, { useState, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, Loader2, Check, X, AlertTriangle, BookOpen, Wand2, Square,
  RotateCcw, Type, Search, Zap, Eye, Copy, ArrowRight, Filter, Download,
  Pencil, Undo2, ChevronDown, ChevronUp, FileText, Trash2, WifiOff, Wifi, Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  loadReviewMemory, markReviewed, exportReviewMemory,
  importReviewMemory, clearReviewMemory, isReviewedSync, type ReviewMemory,
} from "@/lib/enhance-memory";
import { scanAllLocally } from "@/lib/local-enhance-scanner";
import type { ExtractedEntry } from "./types";

interface TranslationAIEnhancePanelProps {
  entries: ExtractedEntry[];
  translations: Record<string, string>;
  onApplySuggestion: (key: string, newText: string) => void;
  glossary?: string;
}

interface EnhanceSuggestion {
  key: string;
  original: string;
  current: string;
  suggested: string;
  reason: string;
  type: "style" | "grammar" | "accuracy" | "consistency" | "missing_char" | "terminology" | "punctuation";
}

interface GrammarIssue {
  key: string;
  original: string;
  translation: string;
  issue: string;
  suggestion: string;
  severity?: "high" | "medium" | "low";
}

type Scope = "all" | "short" | "long" | "with_tags" | "no_arabic";

const BATCH_SIZE = 50;
const PARALLEL_REQUESTS = 3;

const MODEL_OPTIONS = [
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (سريع — مُوصى)" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (متوازن)" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (دقة عالية، أبطأ)" },
  { value: "gpt-5", label: "GPT-5 (دقة قصوى)" },
];

// --- Diff helper: word-level highlight ---
function diffWords(a: string, b: string): { type: "same" | "del" | "add"; text: string }[] {
  const aw = a.split(/(\s+)/);
  const bw = b.split(/(\s+)/);
  const m = aw.length, n = bw.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = aw[i] === bw[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: { type: "same" | "del" | "add"; text: string }[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (aw[i] === bw[j]) { out.push({ type: "same", text: aw[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: "del", text: aw[i] }); i++; }
    else { out.push({ type: "add", text: bw[j] }); j++; }
  }
  while (i < m) { out.push({ type: "del", text: aw[i++] }); }
  while (j < n) { out.push({ type: "add", text: bw[j++] }); }
  return out;
}

const DiffView: React.FC<{ before: string; after: string }> = ({ before, after }) => {
  const parts = useMemo(() => diffWords(before, after), [before, after]);
  return (
    <div className="text-sm leading-relaxed font-body" dir="rtl">
      {parts.map((p, i) =>
        p.type === "same" ? <span key={i}>{p.text}</span>
        : p.type === "del" ? <span key={i} className="bg-red-500/20 line-through text-red-600 rounded px-0.5">{p.text}</span>
        : <span key={i} className="bg-green-500/20 text-green-700 rounded px-0.5">{p.text}</span>
      )}
    </div>
  );
};

const TranslationAIEnhancePanel: React.FC<TranslationAIEnhancePanelProps> = ({
  entries,
  translations,
  onApplySuggestion,
  glossary,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<EnhanceSuggestion[]>([]);
  const [grammarIssues, setGrammarIssues] = useState<GrammarIssue[]>([]);
  const [activeTab, setActiveTab] = useState<string>("enhance");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [model, setModel] = useState<string>("gemini-3-flash-preview");
  const [showDiff, setShowDiff] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [appliedHistory, setAppliedHistory] = useState<{ key: string; previous: string; applied: string; ts: number }[]>([]);

  const [offlineMode, setOfflineMode] = useState(false);
  const [reviewMem, setReviewMem] = useState<ReviewMemory>({ approved: {}, dismissed: {} });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const abortRef = useRef(false);
  const processedKeysRef = useRef<Set<string>>(new Set());

  // Load persistent review memory once
  React.useEffect(() => {
    loadReviewMemory().then(setReviewMem);
  }, []);

  const resetProcessedKeys = useCallback(() => {
    processedKeysRef.current = new Set();
    setProcessedCount(0);
  }, []);

  // ----- Scope filter for which entries are sent to AI -----
  const scopeFilter = useCallback((e: ExtractedEntry, t: string): boolean => {
    if (!t?.trim()) return false;
    const key = `${e.msbtFile}:${e.index}`;
    // Skip already-reviewed entries (approved or dismissed) if translation unchanged
    if (isReviewedSync(reviewMem, key, t)) return false;
    switch (scope) {
      case "short": return t.length < 30;
      case "long": return t.length >= 100;
      case "with_tags": return /[\uE000-\uF8FF]|\[[A-Z][^\]]*\]/.test(e.original);
      case "no_arabic": return !/[\u0600-\u06FF]/.test(t);
      default: return true;
    }
  }, [scope, reviewMem]);

  const analyzeTranslations = async (mode: "enhance" | "grammar") => {
    const translatedEntries = entries.filter(e => {
      const key = `${e.msbtFile}:${e.index}`;
      const t = translations[key];
      return t?.trim() && !processedKeysRef.current.has(key) && scopeFilter(e, t);
    });

    if (translatedEntries.length === 0) {
      toast({ title: "لا توجد نصوص جديدة للفحص", description: "جرب تغيير النطاق أو اضغط 🔄 لإعادة الفحص" });
      return;
    }

    setIsAnalyzing(true);
    setActiveTab(mode);
    abortRef.current = false;

    // ----- OFFLINE local scan -----
    if (offlineMode) {
      const inputs = translatedEntries.map(e => ({
        key: `${e.msbtFile}:${e.index}`,
        original: e.original,
        translation: translations[`${e.msbtFile}:${e.index}`],
      }));
      const issues = scanAllLocally(inputs);
      for (const t of inputs) processedKeysRef.current.add(t.key);
      setProcessedCount(processedKeysRef.current.size);
      if (mode === "grammar") {
        setGrammarIssues(prev => [...prev, ...issues.map(i => ({
          key: i.key, original: i.original, translation: i.translation,
          issue: i.issue, suggestion: i.suggestion, severity: i.severity,
        }))]);
      } else {
        setSuggestions(prev => [...prev, ...issues.map(i => ({
          key: i.key, original: i.original, current: i.translation,
          suggested: i.suggestion, reason: i.issue, type: i.type as any,
        }))]);
      }
      setIsAnalyzing(false);
      toast({ title: `🔌 فحص محلي: ${issues.length} مشكلة` });
      return;
    }

    setProgress({ current: 0, total: translatedEntries.length });

    let allSuggestions: EnhanceSuggestion[] = [];
    let allIssues: GrammarIssue[] = [];
    let processed = 0;

    const batches: { textsToAnalyze: { key: string; original: string; translation: string }[] }[] = [];
    for (let i = 0; i < translatedEntries.length; i += BATCH_SIZE) {
      const batch = translatedEntries.slice(i, i + BATCH_SIZE);
      batches.push({
        textsToAnalyze: batch.map(e => ({
          key: `${e.msbtFile}:${e.index}`,
          original: e.original,
          translation: translations[`${e.msbtFile}:${e.index}`],
        })),
      });
    }

    for (let i = 0; i < batches.length; i += PARALLEL_REQUESTS) {
      if (abortRef.current) break;

      const chunk = batches.slice(i, i + PARALLEL_REQUESTS);
      const promises = chunk.map(async ({ textsToAnalyze }) => {
        try {
          const { data, error } = await supabase.functions.invoke('enhance-translations', {
            body: {
              entries: textsToAnalyze,
              mode,
              glossary: glossary?.slice(0, 5000),
              aiModel: model,
            },
          });
          if (error) throw error;
          if (data?.error) {
            toast({ title: data.error, variant: "destructive" });
            return { data: null, count: textsToAnalyze.length };
          }
          for (const t of textsToAnalyze) processedKeysRef.current.add(t.key);
          setProcessedCount(processedKeysRef.current.size);
          return { data, count: textsToAnalyze.length };
        } catch (err) {
          if (String(err).includes('429')) {
            toast({ title: "تم تجاوز حد الطلبات، جاري الانتظار...", variant: "destructive" });
            await new Promise(r => setTimeout(r, 5000));
            try {
              const { data } = await supabase.functions.invoke('enhance-translations', {
                body: { entries: textsToAnalyze, mode, glossary: glossary?.slice(0, 5000), aiModel: model },
              });
              for (const t of textsToAnalyze) processedKeysRef.current.add(t.key);
              setProcessedCount(processedKeysRef.current.size);
              return { data, count: textsToAnalyze.length };
            } catch { return { data: null, count: textsToAnalyze.length }; }
          }
          return { data: null, count: textsToAnalyze.length };
        }
      });

      const results = await Promise.all(promises);

      for (const { data, count } of results) {
        processed += count;
        if (!data) continue;
        if (mode === "enhance" && data.suggestions) {
          allSuggestions = [...allSuggestions, ...data.suggestions];
          setSuggestions(prev => [...prev, ...data.suggestions]);
        } else if (mode === "grammar" && data.issues) {
          allIssues = [...allIssues, ...data.issues];
          setGrammarIssues(prev => [...prev, ...data.issues]);
        }
      }

      setProgress({ current: Math.min(processed, translatedEntries.length), total: translatedEntries.length });
    }

    setIsAnalyzing(false);
    setProgress(null);

    const count = mode === "enhance" ? allSuggestions.length : allIssues.length;
    if (count === 0 && !abortRef.current) {
      toast({ title: mode === "enhance" ? "✅ الترجمات جيدة" : "✅ لا توجد أخطاء" });
    } else {
      toast({ title: `تم العثور على ${count} ${mode === "enhance" ? "اقتراح" : "خطأ"}` });
    }
  };

  const stopAnalysis = () => { abortRef.current = true; };

  const applyOne = (key: string, newText: string) => {
    const previous = translations[key] || "";
    onApplySuggestion(key, newText);
    setAppliedHistory(prev => [{ key, previous, applied: newText, ts: Date.now() }, ...prev].slice(0, 50));
  };

  const applySuggestion = (item: EnhanceSuggestion | GrammarIssue) => {
    const newText = 'suggested' in item ? item.suggested : item.suggestion;
    applyOne(item.key, newText);
    if ('suggested' in item) {
      setSuggestions(prev => prev.filter(s => s.key !== item.key));
    } else {
      setGrammarIssues(prev => prev.filter(g => g.key !== item.key));
    }
  };

  const undoLast = () => {
    const last = appliedHistory[0];
    if (!last) return;
    onApplySuggestion(last.key, last.previous);
    setAppliedHistory(prev => prev.slice(1));
    toast({ title: "↩️ تم التراجع" });
  };

  const startEdit = (key: string, current: string) => {
    setEditingKey(key);
    setEditingText(current);
  };

  const saveEdit = (item: EnhanceSuggestion | GrammarIssue) => {
    applyOne(item.key, editingText);
    setEditingKey(null);
    setEditingText("");
    if ('suggested' in item) {
      setSuggestions(prev => prev.filter(s => s.key !== item.key));
    } else {
      setGrammarIssues(prev => prev.filter(g => g.key !== item.key));
    }
  };

  const applyAll = () => {
    if (activeTab === "enhance") {
      const list = filteredSuggestions;
      for (const s of list) applyOne(s.key, s.suggested);
      toast({ title: `✅ تم تطبيق ${list.length} اقتراح` });
      const keys = new Set(list.map(s => s.key));
      setSuggestions(prev => prev.filter(s => !keys.has(s.key)));
    } else {
      const list = filteredIssues;
      for (const g of list) applyOne(g.key, g.suggestion);
      toast({ title: `✅ تم إصلاح ${list.length} خطأ` });
      const keys = new Set(list.map(g => g.key));
      setGrammarIssues(prev => prev.filter(g => !keys.has(g.key)));
    }
  };

  const dismissSuggestion = (key: string) => {
    setSuggestions(prev => prev.filter(s => s.key !== key));
    setGrammarIssues(prev => prev.filter(g => g.key !== key));
  };

  const dismissAll = () => {
    if (activeTab === "enhance") {
      const keys = new Set(filteredSuggestions.map(s => s.key));
      setSuggestions(prev => prev.filter(s => !keys.has(s.key)));
    } else {
      const keys = new Set(filteredIssues.map(g => g.key));
      setGrammarIssues(prev => prev.filter(g => !keys.has(g.key)));
    }
    toast({ title: "تم تجاهل النتائج" });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "تم النسخ" });
  };

  const exportCSV = () => {
    const isEnhance = activeTab === "enhance";
    const header = isEnhance
      ? "key,original,current,suggested,reason,type"
      : "key,original,translation,suggestion,issue,severity";
    const rows = isEnhance
      ? filteredSuggestions.map(s => [s.key, s.original, s.current, s.suggested, s.reason, s.type])
      : filteredIssues.map(g => [g.key, g.original, g.translation, g.suggestion, g.issue, g.severity || ""]);
    const csv = "\uFEFF" + [header, ...rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-${activeTab}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "📥 تم التصدير" });
  };

  const typeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    style: { label: "أسلوب", icon: <Wand2 className="w-3 h-3" />, color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
    grammar: { label: "قواعد", icon: <Type className="w-3 h-3" />, color: "bg-red-500/10 text-red-600 border-red-500/20" },
    accuracy: { label: "دقة", icon: <Eye className="w-3 h-3" />, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    consistency: { label: "اتساق", icon: <Search className="w-3 h-3" />, color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    missing_char: { label: "حرف ناقص", icon: <AlertTriangle className="w-3 h-3" />, color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
    terminology: { label: "مصطلح", icon: <BookOpen className="w-3 h-3" />, color: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
    punctuation: { label: "ترقيم", icon: <Type className="w-3 h-3" />, color: "bg-pink-500/10 text-pink-600 border-pink-500/20" },
  };

  // ---- Filters: type + severity + text search ----
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter(s => {
      if (filterType && s.type !== filterType) return false;
      if (searchQuery && !(`${s.key} ${s.original} ${s.current} ${s.suggested} ${s.reason}`).toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [suggestions, filterType, searchQuery]);

  const filteredIssues = useMemo(() => {
    return grammarIssues.filter(g => {
      if (severityFilter && g.severity !== severityFilter) return false;
      if (searchQuery && !(`${g.key} ${g.original} ${g.translation} ${g.suggestion} ${g.issue}`).toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [grammarIssues, severityFilter, searchQuery]);

  const typeCounts: Record<string, number> = {};
  for (const s of suggestions) typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;

  const severityCounts: Record<string, number> = {};
  for (const g of grammarIssues) {
    const k = g.severity || "medium";
    severityCounts[k] = (severityCounts[k] || 0) + 1;
  }

  const totalTranslated = entries.filter(e => translations[`${e.msbtFile}:${e.index}`]?.trim()).length;
  const inScopeTotal = entries.filter(e => {
    const t = translations[`${e.msbtFile}:${e.index}`];
    return t?.trim() && scopeFilter(e, t);
  }).length;
  const remaining = inScopeTotal - processedCount;

  const severityConfig: Record<string, { color: string; label: string; bg: string }> = {
    high: { color: "text-red-500", label: "خطير", bg: "bg-red-500/10 border-red-500/20" },
    medium: { color: "text-amber-500", label: "متوسط", bg: "bg-amber-500/10 border-amber-500/20" },
    low: { color: "text-blue-500", label: "بسيط", bg: "bg-blue-500/10 border-blue-500/20" },
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            تحسين الترجمة بالذكاء الاصطناعي
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSettings(s => !s)} title="إعدادات">
            {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CardTitle>

        {/* Stats bar */}
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          <div className="flex gap-3 text-[11px] text-muted-foreground flex-1 flex-wrap">
            <span>إجمالي: <strong className="text-foreground">{totalTranslated}</strong></span>
            <span>في النطاق: <strong className="text-foreground">{inScopeTotal}</strong></span>
            <span>تم فحصه: <strong className="text-foreground">{processedCount}</strong></span>
            <span>متبقي: <strong className={remaining > 0 ? "text-primary" : "text-green-500"}>{remaining}</strong></span>
          </div>
          {suggestions.length + grammarIssues.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {suggestions.length + grammarIssues.length} نتيجة
            </Badge>
          )}
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="mt-3 p-3 rounded-lg border bg-muted/20 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">النموذج</label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">نطاق الفحص</label>
                <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">كل الترجمات</SelectItem>
                    <SelectItem value="short" className="text-xs">قصيرة فقط (&lt; 30)</SelectItem>
                    <SelectItem value="long" className="text-xs">طويلة فقط (&ge; 100)</SelectItem>
                    <SelectItem value="with_tags" className="text-xs">تحتوي على وسوم</SelectItem>
                    <SelectItem value="no_arabic" className="text-xs">لا تحتوي عربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
              <input type="checkbox" checked={showDiff} onChange={(e) => setShowDiff(e.target.checked)} className="accent-primary" />
              عرض الفروقات (Diff) ملوّنة
            </label>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => analyzeTranslations("enhance")} disabled={isAnalyzing} className="gap-1.5 h-10">
            {isAnalyzing && activeTab === "enhance" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            <div className="text-right">
              <p className="text-xs font-bold">تحسين الصياغة</p>
              <p className="text-[10px] text-muted-foreground">أسلوب + مصطلحات + دقة</p>
            </div>
          </Button>
          <Button variant="outline" size="sm" onClick={() => analyzeTranslations("grammar")} disabled={isAnalyzing} className="gap-1.5 h-10">
            {isAnalyzing && activeTab === "grammar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
            <div className="text-right">
              <p className="text-xs font-bold">فحص القواعد</p>
              <p className="text-[10px] text-muted-foreground">إملاء + نحو + ترقيم</p>
            </div>
          </Button>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2 flex-wrap">
          {isAnalyzing && (
            <Button variant="destructive" size="sm" onClick={stopAnalysis} className="gap-1.5">
              <Square className="w-3 h-3" /> إيقاف
            </Button>
          )}
          {!isAnalyzing && processedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { resetProcessedKeys(); setSuggestions([]); setGrammarIssues([]); setFilterType(null); setSeverityFilter(null); }} className="gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> إعادة فحص
            </Button>
          )}
          {appliedHistory.length > 0 && (
            <Button variant="ghost" size="sm" onClick={undoLast} className="gap-1.5" title="تراجع آخر إصلاح">
              <Undo2 className="w-3.5 h-3.5" /> تراجع ({appliedHistory.length})
            </Button>
          )}
          {(suggestions.length > 0 || grammarIssues.length > 0) && !isAnalyzing && (
            <>
              <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1.5" title="تصدير CSV">
                <Download className="w-3.5 h-3.5" /> CSV
              </Button>
              <Button size="sm" variant="ghost" onClick={dismissAll} className="gap-1.5 text-muted-foreground" title="تجاهل المعروض">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="default" onClick={applyAll} className="gap-1.5 mr-auto">
                <Zap className="w-4 h-4" />
                تطبيق الكل ({activeTab === "enhance" ? filteredSuggestions.length : filteredIssues.length})
              </Button>
            </>
          )}
        </div>

        {/* Progress bar */}
        {progress && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>جاري الفحص...</span>
              <span className="font-mono">{progress.current} / {progress.total}</span>
            </div>
            <Progress value={(progress.current / progress.total) * 100} className="h-2" />
          </div>
        )}

        {/* Search inside results */}
        {(suggestions.length > 0 || grammarIssues.length > 0) && (
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="ابحث داخل النتائج..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs pr-8"
            />
          </div>
        )}

        {/* Type filter (enhance) */}
        {suggestions.length > 0 && activeTab === "enhance" && (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={filterType === null ? "default" : "outline"} className="cursor-pointer text-[10px]" onClick={() => setFilterType(null)}>
              الكل ({suggestions.length})
            </Badge>
            {Object.entries(typeCounts).map(([type, count]) => {
              const config = typeConfig[type];
              return (
                <Badge key={type} variant={filterType === type ? "default" : "outline"}
                  className={`cursor-pointer text-[10px] gap-1 ${filterType !== type ? config?.color || '' : ''}`}
                  onClick={() => setFilterType(filterType === type ? null : type)}>
                  {config?.icon}{config?.label || type} ({count})
                </Badge>
              );
            })}
          </div>
        )}

        {/* Severity filter (grammar) */}
        {grammarIssues.length > 0 && activeTab === "grammar" && (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={severityFilter === null ? "default" : "outline"} className="cursor-pointer text-[10px]" onClick={() => setSeverityFilter(null)}>
              الكل ({grammarIssues.length})
            </Badge>
            {(["high", "medium", "low"] as const).map(sev => severityCounts[sev] ? (
              <Badge key={sev} variant={severityFilter === sev ? "default" : "outline"}
                className={`cursor-pointer text-[10px] gap-1 ${severityFilter !== sev ? severityConfig[sev].bg : ''}`}
                onClick={() => setSeverityFilter(severityFilter === sev ? null : sev)}>
                {severityConfig[sev].label} ({severityCounts[sev]})
              </Badge>
            ) : null)}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full h-9">
            <TabsTrigger value="enhance" className="flex-1 text-xs gap-1">
              <Wand2 className="w-3 h-3" /> تحسينات
              {suggestions.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1">{suggestions.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="grammar" className="flex-1 text-xs gap-1">
              <BookOpen className="w-3 h-3" /> أخطاء
              {grammarIssues.length > 0 && <Badge variant="destructive" className="text-[10px] h-4 px-1">{grammarIssues.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* === Enhance results === */}
          <TabsContent value="enhance">
            {filteredSuggestions.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3 pr-1">
                  {filteredSuggestions.map((s, i) => {
                    const config = typeConfig[s.type];
                    const isEditing = editingKey === s.key;
                    return (
                      <div key={`${s.key}-${i}`} className="rounded-xl border bg-card p-3 sm:p-4 space-y-3 transition-all hover:shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={`text-[10px] gap-1 ${config?.color || ''}`}>
                                {config?.icon}{config?.label || s.type}
                              </Badge>
                              <span className="text-[9px] text-muted-foreground font-mono truncate" dir="ltr">{s.key}</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{s.reason}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:bg-primary/10" onClick={() => startEdit(s.key, s.suggested)} title="تعديل قبل التطبيق">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:bg-green-500/10" onClick={() => applySuggestion(s)} title="تطبيق">
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:bg-destructive/10" onClick={() => dismissSuggestion(s.key)} title="تجاهل">
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="bg-muted/30 rounded-lg p-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] text-muted-foreground">النص الأصلي:</p>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(s.original)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed" dir="ltr">{s.original}</p>
                        </div>

                        {showDiff ? (
                          <div className="p-2.5 rounded-lg bg-card border">
                            <p className="text-[10px] text-muted-foreground mb-1 font-bold">الفرق:</p>
                            <DiffView before={s.current} after={s.suggested} />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                              <p className="text-[10px] text-red-500 mb-1 font-bold">الحالي:</p>
                              <p className="text-sm leading-relaxed" dir="rtl">{s.current}</p>
                            </div>
                            <div className="flex items-center justify-center"><ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" /></div>
                            <div className="p-2.5 rounded-lg bg-green-500/5 border border-green-500/20">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] text-green-600 font-bold">المقترح:</p>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(s.suggested)}>
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                              <p className="text-sm leading-relaxed" dir="rtl">{s.suggested}</p>
                            </div>
                          </div>
                        )}

                        {isEditing && (
                          <div className="space-y-2 p-2.5 rounded-lg border border-primary/30 bg-primary/5">
                            <p className="text-[10px] text-primary font-bold">تعديل قبل التطبيق:</p>
                            <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} dir="rtl" className="text-sm min-h-[80px]" />
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)} className="h-7 text-xs">إلغاء</Button>
                              <Button size="sm" onClick={() => saveEdit(s)} className="h-7 text-xs gap-1">
                                <Check className="w-3 h-3" /> حفظ وتطبيق
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              !isAnalyzing && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Wand2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>{suggestions.length === 0 ? "اضغط 'تحسين الصياغة' لفحص الترجمات" : "لا توجد نتائج لهذا الفلتر"}</p>
                </div>
              )
            )}
          </TabsContent>

          {/* === Grammar results === */}
          <TabsContent value="grammar">
            {filteredIssues.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3 pr-1">
                  {filteredIssues.map((g, i) => {
                    const isEditing = editingKey === g.key;
                    return (
                      <div key={`${g.key}-${i}`} className="rounded-xl border border-red-500/20 bg-card p-3 sm:p-4 space-y-3 transition-all hover:shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                              <span className="text-sm font-bold text-red-500 break-words">{g.issue}</span>
                              {g.severity && (
                                <Badge variant="outline" className={`text-[10px] ${severityConfig[g.severity]?.color}`}>
                                  {severityConfig[g.severity]?.label}
                                </Badge>
                              )}
                              <span className="text-[9px] text-muted-foreground font-mono truncate" dir="ltr">{g.key}</span>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:bg-primary/10" onClick={() => startEdit(g.key, g.suggestion)} title="تعديل">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:bg-green-500/10" onClick={() => applySuggestion(g)} title="تطبيق">
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:bg-destructive/10" onClick={() => dismissSuggestion(g.key)} title="تجاهل">
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="bg-muted/30 rounded-lg p-2.5">
                          <p className="text-[10px] text-muted-foreground mb-1">النص الأصلي:</p>
                          <p className="text-xs text-muted-foreground leading-relaxed" dir="ltr">{g.original}</p>
                        </div>

                        {showDiff ? (
                          <div className="p-2.5 rounded-lg bg-card border">
                            <p className="text-[10px] text-muted-foreground mb-1 font-bold">الفرق:</p>
                            <DiffView before={g.translation} after={g.suggestion} />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                              <p className="text-[10px] text-red-500 mb-1 font-bold">به خطأ:</p>
                              <p className="text-sm leading-relaxed" dir="rtl">{g.translation}</p>
                            </div>
                            <div className="flex items-center justify-center"><ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" /></div>
                            <div className="p-2.5 rounded-lg bg-green-500/5 border border-green-500/20">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] text-green-600 font-bold">التصحيح:</p>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(g.suggestion)}>
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                              <p className="text-sm leading-relaxed" dir="rtl">{g.suggestion}</p>
                            </div>
                          </div>
                        )}

                        {isEditing && (
                          <div className="space-y-2 p-2.5 rounded-lg border border-primary/30 bg-primary/5">
                            <p className="text-[10px] text-primary font-bold">تعديل قبل التطبيق:</p>
                            <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} dir="rtl" className="text-sm min-h-[80px]" />
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)} className="h-7 text-xs">إلغاء</Button>
                              <Button size="sm" onClick={() => saveEdit(g)} className="h-7 text-xs gap-1">
                                <Check className="w-3 h-3" /> حفظ وتطبيق
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              !isAnalyzing && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>اضغط 'فحص القواعد' للبحث عن أخطاء إملائية ونحوية</p>
                </div>
              )
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TranslationAIEnhancePanel;
