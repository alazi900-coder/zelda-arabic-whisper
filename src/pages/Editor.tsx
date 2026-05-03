import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight, Loader2, Filter, Sparkles, Tag, Upload, FileDown, LogIn, BookOpen,
  Eye, EyeOff, RotateCcw, ChevronLeft, ChevronRight, BarChart3, Replace, Columns, Key, Search,
  FileText, BookMarked, Pin,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { useEditorState } from "@/hooks/useEditorState";
import { PAGE_SIZE, isTechnicalText, type ExtractedEntry } from "@/components/editor/types";
import DebouncedInput from "@/components/editor/DebouncedInput";
import CategoryProgress from "@/components/editor/CategoryProgress";
import QualityStatsPanel from "@/components/editor/QualityStatsPanel";
import EntryCard from "@/components/editor/EntryCard";
import ReviewPanel from "@/components/editor/ReviewPanel";
import QuickReviewMode from "@/components/editor/QuickReviewMode";
import PaginationControls from "@/components/editor/PaginationControls";
import FindReplacePanel from "@/components/editor/FindReplacePanel";
import DiffView from "@/components/editor/DiffView";
import BuildStatsDialog from "@/components/editor/BuildStatsDialog";
import BuildConfirmDialog from "@/components/editor/BuildConfirmDialog";
import FixPreviewDialog from "@/components/editor/FixPreviewDialog";
import GlossaryApplyPreview, { type GlossaryChange } from "@/components/editor/GlossaryApplyPreview";
import SceneContextPanel from "@/components/editor/SceneContextPanel";
import InconsistencyDetector from "@/components/editor/InconsistencyDetector";
import ContextSuggestPanel from "@/components/editor/ContextSuggestPanel";
import EngineComparePanel from "@/components/editor/EngineComparePanel";
import SmartBulkImprovePanel from "@/components/editor/SmartBulkImprovePanel";
import FeatureTourDialog from "@/components/editor/FeatureTourDialog";
import KeyboardShortcutsDialog from "@/components/editor/KeyboardShortcutsDialog";
import EditorStatsCards from "@/components/editor/EditorStatsCards";
import EditorToolbar from "@/components/editor/EditorToolbar";
import PageTranslationCompare from "@/components/editor/PageTranslationCompare";
import AdvancedReviewPanel from "@/components/editor/AdvancedReviewPanel";
import QuickAlternativesPanel from "@/components/editor/QuickAlternativesPanel";
import QualityReportExport from "@/components/editor/QualityReportExport";
import TranslationEnhancePanel, { type EnhanceResult } from "@/components/editor/TranslationEnhancePanel";
import TranslationAIEnhancePanel from "@/components/editor/TranslationAIEnhancePanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROMPT_PRESETS } from "@/components/editor/promptPresets";
import hyruleWorld from "@/assets/hyrule-world.jpg";
import linkHero from "@/assets/link-hero.png";
import { classifyDifficulty, DIFFICULTY_CONFIG, useDifficultyStats } from "@/hooks/useDifficultyClassifier";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const Editor = () => {
  const editor = useEditorState();
  const isMobile = useIsMobile();
  const [showDiffView, setShowDiffView] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [showFilterTranslateConfirm, setShowFilterTranslateConfirm] = React.useState(false);
  const [glossaryPreviewChanges, setGlossaryPreviewChanges] = React.useState<GlossaryChange[]>([]);
  const [showGlossaryPreview, setShowGlossaryPreview] = React.useState(false);
  const [glossaryApplyConfirm, setGlossaryApplyConfirm] = React.useState<'all' | 'filtered' | null>(null);
  const [selectedGlossaryLibs, setSelectedGlossaryLibs] = React.useState<Set<string>>(() => new Set([
    'default', 'totk', 'totk-items', 'materials', 'ui', 'locations', 'creatures', 'abilities'
  ]));
  const [showSceneContext, setShowSceneContext] = React.useState(false);
  const [sceneContextEntry, setSceneContextEntry] = React.useState<any>(null);
  const [showInconsistencies, setShowInconsistencies] = React.useState(false);
  const [filterDifficulty, setFilterDifficulty] = React.useState<string>("all");
  const [polishing, setPolishing] = React.useState(false);

  const [showContextSuggest, setShowContextSuggest] = React.useState(false);
  const [contextSuggestEntry, setContextSuggestEntry] = React.useState<any>(null);
  const openContextSuggest = React.useCallback((entry: any) => { setContextSuggestEntry(entry); setShowContextSuggest(true); }, []);

  const [translatorNotes, setTranslatorNotes] = React.useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('zelda-editor-notes');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const handleUpdateNote = React.useCallback((key: string, note: string) => {
    setTranslatorNotes(prev => {
      const next = { ...prev };
      if (note) next[key] = note; else delete next[key];
      try { localStorage.setItem('zelda-editor-notes', JSON.stringify(next)); } catch (e) { console.warn('localStorage notes:', e); }
      return next;
    });
  }, []);

  const [showFeatureTour, setShowFeatureTour] = React.useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = React.useState(false);
  const [showEngineCompare, setShowEngineCompare] = React.useState(false);
  const [engineCompareEntry, setEngineCompareEntry] = React.useState<any>(null);
  const [showSmartImprove, setShowSmartImprove] = React.useState(false);
  const [enhanceResults, setEnhanceResults] = React.useState<EnhanceResult[]>([]);
  const [enhancing, setEnhancing] = React.useState(false);

  const openEngineCompare = React.useCallback((entry: any) => { setEngineCompareEntry(entry); setShowEngineCompare(true); }, []);

  const handleEnhanceWithContext = React.useCallback(async () => {
    if (!editor.state || enhancing) return;
    const targetEntries = editor.isFilterActive ? editor.filteredEntries : editor.state.entries;
    const translatedEntries = targetEntries.filter(e => {
      const key = `${e.msbtFile}:${e.index}`;
      const t = editor.state!.translations[key]?.trim();
      return t && t !== e.original;
    }).slice(0, 15);

    if (translatedEntries.length === 0) {
      toast({ title: "⚠️ لا توجد ترجمات لتحسينها" });
      return;
    }
    setEnhancing(true);
    setEnhanceResults([]);
    try {
      const entries = translatedEntries.map(e => ({
        key: `${e.msbtFile}:${e.index}`,
        original: e.original,
        translation: editor.state!.translations[`${e.msbtFile}:${e.index}`],
        fileName: e.msbtFile,
      }));
      const glossaryContext = editor.activeGlossary
        ? editor.activeGlossary.split('\n').filter(l => l.trim() && l.includes('=')).slice(0, 80).join('\n')
        : undefined;
      const { data, error } = await supabase.functions.invoke('enhance-translations', {
        body: { entries, mode: 'enhance', glossary: glossaryContext },
      });
      if (error) throw error;
      const results: EnhanceResult[] = data?.results || [];
      setEnhanceResults(results);
      if (results.length === 0) {
        toast({ title: "✅ الترجمات سليمة", description: "لم يُكتشف فرص تحسين واضحة" });
      } else {
        toast({ title: `✨ تم تحليل ${translatedEntries.length} نص`, description: `${results.length} اقتراح تحسين متاح` });
      }
    } catch (err: any) {
      toast({ title: "❌ خطأ في التحليل", description: err.message, variant: "destructive" });
    } finally {
      setEnhancing(false);
    }
  }, [editor.state, editor.isFilterActive, editor.filteredEntries, editor.activeGlossary, enhancing]);

  const handleApplyEnhanceSuggestion = React.useCallback((key: string, newText: string) => {
    editor.updateTranslation(key, newText);
    setEnhanceResults(prev => prev.filter(r => r.key !== key));
    toast({ title: "✅ تم تطبيق الاقتراح" });
  }, [editor]);

  const handleApplyAllEnhanceSuggestions = React.useCallback(() => {
    let applied = 0;
    for (const r of enhanceResults) {
      const best = r.preferredSuggestion || r.suggestions[0]?.text;
      if (best) {
        editor.updateTranslation(r.key, best);
        applied++;
      }
    }
    setEnhanceResults([]);
    toast({ title: `✅ تم تطبيق ${applied} اقتراح` });
  }, [enhanceResults, editor]);

  const handleSmartImproveApply = React.useCallback((updates: Record<string, string>) => {
    if (!editor.state || !editor.updateTranslation) return;
    Object.entries(updates).forEach(([k, v]) => editor.updateTranslation(k, v));
  }, [editor.state, editor.updateTranslation]);

  const difficultyStats = useDifficultyStats(editor.state?.entries || []);

  useKeyboardShortcuts({
    onSave: editor.handleCloudSave,
    onSearch: () => { const s = document.querySelector<HTMLInputElement>('[data-search-input]'); s?.focus(); },
    onFindReplace: () => editor.setShowFindReplace(true),
    onTranslate: () => editor.handleAutoTranslate(),
    onBuild: () => editor.handlePreBuild(),
    onQuickReview: () => editor.setQuickReviewMode(!editor.quickReviewMode),
    onNextPage: () => editor.setCurrentPage(Math.min(editor.totalPages - 1, editor.currentPage + 1)),
    onPrevPage: () => editor.setCurrentPage(Math.max(0, editor.currentPage - 1)),
  }, !!editor.state);

  const handleDragOver = React.useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragLeave = React.useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  const handleDrop = React.useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer) await editor.handleDropImport(e.dataTransfer);
  }, [editor.handleDropImport]);

  const untranslatedCount = React.useMemo(() => {
    if (!editor.state) return 0;
    const entries = editor.isFilterActive ? editor.filteredEntries : editor.state.entries;
    return entries.filter(e => {
      const key = `${e.msbtFile}:${e.index}`;
      const t = editor.state!.translations[key]?.trim();
      return !t || t === e.original || t === e.original.trim();
    }).length;
  }, [editor.state, editor.filteredEntries, editor.isFilterActive]);

  const handlePolishArabic = React.useCallback(async () => {
    if (!editor.state || polishing) return;
    const targetEntries = editor.isFilterActive ? editor.filteredEntries : editor.state.entries;
    const translatedEntries = targetEntries.filter(e => {
      const key = `${e.msbtFile}:${e.index}`;
      const t = editor.state!.translations[key]?.trim();
      return t && t !== e.original;
    }).slice(0, 15);

    if (translatedEntries.length === 0) { toast({ title: "⚠️ لا توجد ترجمات لتحسينها" }); return; }
    setPolishing(true);
    try {
      const entries = translatedEntries.map(e => ({
        key: `${e.msbtFile}:${e.index}`, original: e.original,
        translation: editor.state!.translations[`${e.msbtFile}:${e.index}`],
      }));
      const glossaryContext = editor.activeGlossary
        ? editor.activeGlossary.split('\n').filter(l => l.trim() && l.includes('=')).slice(0, 50).join('\n')
        : undefined;
      const { data, error } = await supabase.functions.invoke('polish-arabic', { body: { entries, glossary: glossaryContext } });
      if (error) throw error;
      if (!data?.results) throw new Error('No results');
      const changedResults = data.results.filter((r: any) => r.changed);
      if (changedResults.length === 0) {
        toast({ title: "✅ الترجمات سليمة", description: "لم يتم العثور على أخطاء تحتاج تصحيح" });
      } else {
        editor.setFixPreview({
          title: `تحسين الصياغة العربية (${changedResults.length} نص)`,
          items: changedResults.map((r: any) => {
            const parts = r.key.split(':');
            return { key: r.key, label: `${r.categoryLabel || ''} ${r.reason || 'تحسين الصياغة'}`.trim(), file: parts[0] || '', oldText: r.current, newText: r.improved };
          }),
          updates: Object.fromEntries(changedResults.map((r: any) => [r.key, r.improved])),
        });
      }
    } catch (err: any) {
      toast({ title: "❌ خطأ في تحسين الصياغة", description: err.message, variant: "destructive" });
    } finally { setPolishing(false); }
  }, [editor.state, editor.isFilterActive, editor.filteredEntries, editor.activeGlossary, polishing]);

  const openSceneContext = React.useCallback((entry: any) => { setSceneContextEntry(entry); setShowSceneContext(true); }, []);

  // Perf fix (C1): pre-build per-file entry maps once instead of filtering+sorting
  // state.entries (~5000) inside the entries .map() loop (was 50× per render).
  // IMPORTANT: this hook MUST be called before any early return to keep hook
  // order stable across renders (Rules of Hooks).
  const entriesByFile = React.useMemo(() => {
    const map = new Map<string, ExtractedEntry[]>();
    if (!editor.state) return map;
    for (const e of editor.state.entries) {
      const arr = map.get(e.msbtFile);
      if (arr) arr.push(e);
      else map.set(e.msbtFile, [e]);
    }
    // Sort each file's entries once by index
    for (const arr of map.values()) arr.sort((a, b) => a.index - b.index);
    return map;
  }, [editor.state?.entries]);

  if (!editor.state) {
    return (
      <div className="min-h-screen py-6 md:py-10 px-3 md:px-4 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06] bg-cover bg-center"
          style={{ backgroundImage: `url(${hyruleWorld})` }}
          aria-hidden
        />
        <div className="relative max-w-3xl mx-auto text-center space-y-4 mt-4">
          <img
            src={linkHero}
            alt=""
            className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full ring-2 ring-amber-500/40 object-cover shadow-lg"
          />
          <h2 className="font-display text-xl sm:text-2xl font-bold">🏰 لا توجد بيانات للتحرير</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            ابدأ مغامرتك برفع ملف اللغة وملف القاموس في صفحة المعالجة لاستخراج النصوص.
          </p>
          <Link to="/process">
            <Button className="font-display gap-2">
              <Upload className="w-4 h-4" /> اذهب لصفحة المعالجة
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen py-4 md:py-8 px-3 md:px-4 relative" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        {isDragging && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-4 border-dashed border-primary/50 pointer-events-none">
            <div className="text-center space-y-3">
              <Upload className="w-16 h-16 text-primary mx-auto animate-bounce" />
              <p className="text-2xl font-display font-bold text-primary">أفلت ملف JSON هنا</p>
              <p className="text-sm text-muted-foreground font-body">سيتم استيراد الترجمات تلقائياً</p>
            </div>
          </div>
        )}
        <div className="max-w-6xl mx-auto">
          <Link to="/process" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 md:mb-6 font-body text-sm">
            <ArrowRight className="w-4 h-4" /> العودة للمعالجة
          </Link>

          <div className="flex items-center gap-2 mb-1 md:mb-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-display font-bold">محرر الترجمة ✍️</h1>
            <Button variant="outline" size="sm" onClick={() => setShowFeatureTour(true)} className="font-body text-xs h-7 px-2">❓ دليل الأدوات</Button>
            <Button variant="outline" size="sm" onClick={() => setShowKeyboardShortcuts(true)} className="font-body text-xs h-7 px-2">⌨️ اختصارات</Button>
            {difficultyStats.totalMinutes > 0 && !isMobile && (
              <span className="text-[10px] text-muted-foreground font-body mr-auto">⏱️ الوقت المقدّر: {Math.round(difficultyStats.totalMinutes)} دقيقة</span>
            )}
            <QualityReportExport
              totalEntries={editor.state.entries.length}
              translatedCount={editor.translatedCount}
              qualityStats={editor.qualityStats}
              needsImproveCount={editor.needsImproveCount}
              categoryProgress={editor.categoryProgress}
            />
          </div>
          <p className="text-sm md:text-base text-muted-foreground mb-4 font-body">عدّل النصوص العربية يدوياً أو استخدم الترجمة التلقائية</p>

          {/* Stats + Translate Buttons */}
          <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-6">
            <EditorStatsCards
              totalEntries={editor.state.entries.length}
              translatedCount={editor.translatedCount}
              qualityTotal={editor.qualityStats.total}
              protectedCount={editor.state.protectedEntries?.size || 0}
              showQualityStats={editor.showQualityStats}
              setShowQualityStats={editor.setShowQualityStats}
              isMobile={isMobile}
            />
            {editor.translating ? (
              <Button size={isMobile ? "default" : "lg"} variant="destructive" onClick={editor.handleStopTranslate} className="font-display font-bold px-4 md:px-6">
                <Loader2 className="w-4 h-4 animate-spin" /> إيقاف ⏹️
              </Button>
            ) : (
              <Button size={isMobile ? "default" : "lg"} variant="default" onClick={() => {
                if (editor.isFilterActive) setShowFilterTranslateConfirm(true);
                else editor.handleAutoTranslate();
              }} disabled={editor.translating} className="font-display font-bold px-4 md:px-6">
                <Sparkles className="w-4 h-4" /> {editor.isFilterActive ? `ترجمة المحدد (${untranslatedCount}) 🎯` : 'ترجمة تلقائية 🤖'}
              </Button>
            )}
            <Button size={isMobile ? "default" : "lg"} variant="outline" onClick={() => editor.setShowRetranslateConfirm(true)} disabled={editor.translating} className="font-display font-bold px-4 md:px-6 border-accent/30 text-accent hover:text-accent">
              <RotateCcw className="w-4 h-4" /> إعادة ترجمة الصفحة 🔄
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size={isMobile ? "default" : "lg"} variant="outline" disabled={editor.translating} className="font-display font-bold px-4 md:px-6">
                  <FileText className="w-4 h-4" /> ترجمة الصفحة 📄
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border z-50">
                <DropdownMenuLabel className="text-xs">الصفحة الحالية</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => editor.handleTranslatePage(false, false)} disabled={editor.translating}>
                  <Sparkles className="w-4 h-4" /> ترجمة بـ AI 🤖
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.handleTranslatePage(false, true)} disabled={editor.translating}>
                  <Sparkles className="w-4 h-4" /> من الذاكرة فقط 🧠
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.handleTranslateFromGlossaryOnly()} disabled={editor.translating}>
                  <BookMarked className="w-4 h-4" /> من القاموس فقط 📖
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">جميع الصفحات</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => {
                  if (editor.isFilterActive) setShowFilterTranslateConfirm(true);
                  else editor.handleAutoTranslate();
                }} disabled={editor.translating}>
                  <Sparkles className="w-4 h-4" /> ترجمة جميع غير المترجمة 🌍
                  {editor.isFilterActive ? ` (${editor.filterLabel})` : ''}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Page Translation Compare Dialog (ported from Xenoblade) */}
          <PageTranslationCompare
            open={editor.showPageCompare}
            originals={editor.pageTranslationOriginals}
            oldTranslations={editor.oldPageTranslations}
            newTranslations={editor.pendingPageTranslations}
            onApply={editor.applyPageTranslations}
            onDiscard={editor.discardPageTranslations}
          />

          {/* Advanced AI Review Results Panel (7 new AI actions) */}
          <AdvancedReviewPanel
            action={editor.advancedAction}
            findings={editor.advancedFindings}
            onApply={editor.applyAdvancedFinding}
            onDismiss={editor.dismissAdvancedFinding}
            onApplyAll={editor.applyAllAdvancedFindings}
            onDismissAll={editor.dismissAllAdvanced}
          />

          {/* Quick Alternatives Panel (3 style-variants for single entry) */}
          <QuickAlternativesPanel
            data={editor.quickAlternatives}
            onApply={editor.applyQuickAlternative}
            onClose={() => editor.setQuickAlternatives(null)}
          />

          {/* Translation Engine Selector */}
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="p-3 md:p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-display font-bold">محرك الترجمة</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: 'lovable', label: '🤖 Lovable AI', disabled: false },
                    { key: 'gemini', label: '✨ Gemini (شخصي)', disabled: !editor.userGeminiKey },
                    { key: 'claude', label: '🧠 Claude (شخصي)', disabled: !editor.userClaudeKey },
                    { key: 'bedrock', label: '☁️ Amazon Bedrock', disabled: !editor.userBedrockApiKey },
                    { key: 'google', label: '🔤 Google Translate', disabled: false },
                    { key: 'mymemory', label: '🌐 MyMemory', disabled: false },
                  ].map(eng => (
                    <Button key={eng.key} variant={editor.translationEngine === eng.key ? 'default' : 'outline'} size="sm"
                      onClick={() => editor.setTranslationEngine(eng.key as any)} className="text-xs font-body" disabled={eng.disabled}>
                      {eng.label}
                    </Button>
                  ))}
                </div>
              </div>
              {(editor.translationEngine === 'gemini' || editor.translationEngine === 'lovable') && (
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-display font-bold">نموذج Gemini</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant={editor.geminiModel === 'gemini-2.0-flash' ? 'default' : 'outline'} size="sm" onClick={() => editor.setGeminiModel('gemini-2.0-flash')} className="text-xs font-body">⚡ 2.0 Flash</Button>
                    <Button variant={editor.geminiModel === 'gemini-2.5-flash' ? 'default' : 'outline'} size="sm" onClick={() => editor.setGeminiModel('gemini-2.5-flash')} className="text-xs font-body">✨ 2.5 Flash</Button>
                    <Button variant={editor.geminiModel === 'gemini-2.5-pro' ? 'default' : 'outline'} size="sm" onClick={() => editor.setGeminiModel('gemini-2.5-pro')} className="text-xs font-body">💎 2.5 Pro</Button>
                  </div>
                  <span className="text-xs text-muted-foreground font-body">
                    {editor.geminiModel === 'gemini-2.0-flash'
                      ? 'أسرع نموذج — مجاني (1500/يوم)'
                      : editor.geminiModel === 'gemini-2.5-flash'
                      ? 'توازن بين السرعة والجودة'
                      : 'أعلى جودة — أبطأ قليلاً'}
                  </span>
                </div>
              )}
              {(editor.translationEngine === 'claude' || editor.translationEngine === 'bedrock') && (
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-display font-bold">{editor.translationEngine === 'bedrock' ? 'جودة Bedrock' : 'جودة Claude'}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant={editor.translationQuality === 'fast' ? 'default' : 'outline'} size="sm" onClick={() => editor.setTranslationQuality('fast')} className="text-xs font-body">⚡ سريعة (Haiku)</Button>
                    <Button variant={editor.translationQuality === 'quality' ? 'default' : 'outline'} size="sm" onClick={() => editor.setTranslationQuality('quality')} className="text-xs font-body">💎 عالية الجودة (Sonnet)</Button>
                  </div>
                </div>
              )}
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <Key className="w-4 h-4 text-primary" />
                  <span className="text-sm font-display font-bold">🔑 مفتاح Gemini API</span>
                </div>
                <div className="flex gap-2 flex-1">
                  <input type="password" placeholder="الصق مفتاح API هنا للترجمة المجانية..." value={editor.userGeminiKey}
                    onChange={(e) => { editor.setUserGeminiKey(e.target.value); if (e.target.value) editor.setTranslationEngine('gemini'); }}
                    className="flex-1 px-3 py-1.5 rounded bg-background border border-border font-body text-sm" dir="ltr" />
                  {editor.userGeminiKey && (
                    <Button variant="ghost" size="sm" onClick={() => { editor.setUserGeminiKey(''); if (editor.translationEngine === 'gemini') editor.setTranslationEngine('lovable'); }} className="text-xs text-destructive shrink-0">مسح</Button>
                  )}
                </div>
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline hover:text-primary/80 shrink-0">احصل على مفتاح مجاني ↗</a>
              </div>
              {editor.userGeminiKey && <p className="text-xs text-secondary font-body">مفتاح Gemini مفعّل{editor.translationEngine === 'gemini' ? ' — سيُستخدم للترجمة' : ''}</p>}
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <Key className="w-4 h-4 text-primary" />
                  <span className="text-sm font-display font-bold">🔑 مفتاح Claude API</span>
                </div>
                <div className="flex gap-2 flex-1">
                  <input type="password" placeholder="الصق مفتاح Anthropic API هنا..." value={editor.userClaudeKey}
                    onChange={(e) => { editor.setUserClaudeKey(e.target.value); if (e.target.value) editor.setTranslationEngine('claude'); }}
                    className="flex-1 px-3 py-1.5 rounded bg-background border border-border font-body text-sm" dir="ltr" />
                  {editor.userClaudeKey && (
                    <Button variant="ghost" size="sm" onClick={() => { editor.setUserClaudeKey(''); if (editor.translationEngine === 'claude') editor.setTranslationEngine('lovable'); }} className="text-xs text-destructive shrink-0">مسح</Button>
                  )}
                </div>
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline hover:text-primary/80 shrink-0">احصل على مفتاح ↗</a>
              </div>
              {editor.userClaudeKey && <p className="text-xs text-secondary font-body">مفتاح Claude مفعّل{editor.translationEngine === 'claude' ? ' — سيُستخدم للترجمة' : ''}</p>}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 shrink-0">
                  <Key className="w-4 h-4 text-primary" />
                  <span className="text-sm font-display font-bold">☁️ مفتاح Amazon Bedrock API</span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                  <div className="flex gap-2 flex-1">
                    <input type="password" placeholder="Bedrock API Key..." value={editor.userBedrockApiKey}
                      onChange={(e) => { editor.setUserBedrockApiKey(e.target.value); if (e.target.value) editor.setTranslationEngine('bedrock'); }}
                      className="flex-1 px-3 py-1.5 rounded bg-background border border-border font-body text-sm" dir="ltr" />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                  <span className="text-xs font-body text-muted-foreground shrink-0">المنطقة:</span>
                  <select value={editor.userBedrockRegion} onChange={(e) => editor.setUserBedrockRegion(e.target.value)}
                    className="px-3 py-1.5 rounded bg-background border border-border font-body text-sm" dir="ltr">
                    <option value="us-east-1">US East (N. Virginia)</option>
                    <option value="us-west-2">US West (Oregon)</option>
                    <option value="eu-west-1">EU (Ireland)</option>
                    <option value="eu-central-1">EU (Frankfurt)</option>
                    <option value="eu-north-1">EU (Stockholm)</option>
                    <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                    <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                    <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                    <option value="me-south-1">Middle East (Bahrain)</option>
                    <option value="me-central-1">Middle East (UAE)</option>
                  </select>
                  {editor.userBedrockApiKey && (
                    <Button variant="ghost" size="sm" onClick={() => { editor.setUserBedrockApiKey(''); if (editor.translationEngine === 'bedrock') editor.setTranslationEngine('lovable'); }} className="text-xs text-destructive shrink-0">مسح</Button>
                  )}
                  <a href="https://console.aws.amazon.com/bedrock/home#/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline hover:text-primary/80 shrink-0">إنشاء مفتاح API ↗</a>
                </div>
              </div>
              {editor.userBedrockApiKey && <p className="text-xs text-secondary font-body">مفتاح Bedrock مفعّل{editor.translationEngine === 'bedrock' ? ' — سيُستخدم للترجمة' : ''}</p>}
              {editor.translationEngine === 'mymemory' && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                    <span className="text-xs font-body text-muted-foreground shrink-0">📧 بريد إلكتروني (اختياري — يرفع الحد لـ 50,000 حرف/يوم):</span>
                    <input type="email" placeholder="your@email.com" value={editor.myMemoryEmail} onChange={(e) => editor.setMyMemoryEmail(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded bg-background border border-border font-body text-sm" dir="ltr" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-body text-muted-foreground">
                      <span>الاستهلاك اليومي</span>
                      <span>{editor.myMemoryCharsUsed.toLocaleString()} / {editor.myMemoryDailyLimit.toLocaleString()} حرف</span>
                    </div>
                    <Progress value={editor.myMemoryDailyLimit > 0 ? (editor.myMemoryCharsUsed / editor.myMemoryDailyLimit) * 100 : 0} className="h-2" />
                  </div>
                </div>
              )}

              {/* Custom prompt instructions (PR4) */}
              <div className="flex flex-col gap-2 border-t border-border/50 pt-3 mt-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex flex-col">
                    <span className="text-sm font-display font-bold">📝 تعليمات إضافية للمترجم</span>
                    <span className="text-xs text-muted-foreground font-body">
                      نصّ حرّ يُلحَق بكل برومت AI. اختر قالباً جاهزاً لزيلدا أو اكتب نصّك.
                    </span>
                  </div>
                  {editor.customPromptInstructions && (
                    <Button variant="ghost" size="sm" onClick={() => editor.setCustomPromptInstructions('')} className="text-xs text-destructive shrink-0 h-7">
                      مسح
                    </Button>
                  )}
                </div>
                <Select
                  value=""
                  onValueChange={(id) => {
                    const preset = PROMPT_PRESETS.find(p => p.id === id);
                    if (preset) editor.setCustomPromptInstructions(preset.text);
                  }}
                >
                  <SelectTrigger className="w-full text-sm font-body" dir="rtl">
                    <SelectValue placeholder="اختر قالباً جاهزاً..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PROMPT_PRESETS.map(p => (
                      <SelectItem key={p.id} value={p.id} className="font-body">
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <textarea
                  value={editor.customPromptInstructions}
                  onChange={(e) => editor.setCustomPromptInstructions(e.target.value.slice(0, 4000))}
                  placeholder="اكتب أي قواعد إضافية تريد أن يلتزم بها المترجم (مثلاً: أبقِ أسماء Sheikah بالإنجليزية، استخدم نبرة فصحى للأميرة Zelda، إلخ)..."
                  rows={3}
                  className="w-full px-3 py-2 rounded bg-background border border-border font-body text-sm resize-y"
                  dir="rtl"
                />
                {editor.customPromptInstructions && (
                  <p className="text-[10px] text-muted-foreground font-body text-left" dir="ltr">
                    {editor.customPromptInstructions.length} / 4000
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Category Progress */}
          <CategoryProgress
            categoryProgress={editor.categoryProgress} filterCategory={editor.filterCategory} setFilterCategory={editor.setFilterCategory}
            damagedTagsCount={editor.qualityStats.damagedTags} onFilterDamagedTags={() => editor.toggleFilterStatus("damaged-tags")}
            isDamagedTagsActive={editor.filterStatus.has("damaged-tags")} onFixDamagedTags={() => editor.handleFixDamagedTags(editor.qualityStats.damagedTagKeys)}
            onLocalFixDamagedTags={() => editor.handleLocalFixAllDamagedTags(editor.qualityStats.damagedTagKeys)} isFixing={editor.translating}
            onRedistributeTags={editor.handleRedistributeTags} tagsCount={editor.tagsCount}
          />

          {/* Progress Bar */}
          <div className="space-y-2 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-sm font-display font-bold text-foreground">نسبة الإنجاز</span>
              <span className="text-sm font-body text-muted-foreground">
                {editor.translatedCount} / {editor.state.entries.length} ({editor.state.entries.length > 0 ? Math.round((editor.translatedCount / editor.state.entries.length) * 100) : 0}%)
              </span>
            </div>
            <Progress value={editor.state.entries.length > 0 ? (editor.translatedCount / editor.state.entries.length) * 100 : 0} className="h-2.5" />
          </div>

          {/* Status Messages */}
          {editor.lastSaved && <Card className="mb-4 border-secondary/30 bg-secondary/5"><CardContent className="p-4 text-center font-display">{editor.lastSaved}</CardContent></Card>}
          {editor.translateProgress && <Card className="mb-4 border-secondary/30 bg-secondary/5"><CardContent className="p-4 text-center font-display">{editor.translateProgress}</CardContent></Card>}
          {editor.buildProgress && (
            <Card className="mb-4 border-secondary/30 bg-secondary/5 cursor-pointer" onClick={() => editor.buildStats && editor.setBuildStats(editor.buildStats)}>
              <CardContent className="p-4 text-center font-display">
                {editor.buildProgress}
                {editor.buildStats && <span className="text-xs text-muted-foreground mr-2"> (اضغط للتفاصيل)</span>}
              </CardContent>
            </Card>
          )}
          {editor.cloudStatus && <Card className="mb-4 border-primary/30 bg-primary/5"><CardContent className="p-4 text-center font-display">{editor.cloudStatus}</CardContent></Card>}
          {editor.tmStats && (
            <Card className="mb-4 border-secondary/30 bg-secondary/5">
              <CardContent className="p-4 text-center font-display">🧠 ذاكرة الترجمة: أُعيد استخدام {editor.tmStats.reused} ترجمة — أُرسل {editor.tmStats.sent} للذكاء الاصطناعي</CardContent>
            </Card>
          )}

          {/* Review Results */}
          <ReviewPanel
            reviewResults={editor.reviewResults} shortSuggestions={editor.shortSuggestions} improveResults={editor.improveResults}
            suggestingShort={editor.suggestingShort} filterCategory={editor.filterCategory} filterFile={editor.filterFile}
            filterStatus={editor.filterStatus} search={editor.search}
            handleSuggestShorterTranslations={editor.handleSuggestShorterTranslations} handleApplyShorterTranslation={editor.handleApplyShorterTranslation}
            handleApplyAllShorterTranslations={editor.handleApplyAllShorterTranslations} handleApplyImprovement={editor.handleApplyImprovement}
            handleApplyAllImprovements={editor.handleApplyAllImprovements} setReviewResults={editor.setReviewResults}
            setShortSuggestions={editor.setShortSuggestions} setImproveResults={editor.setImproveResults}
          />

          {(enhanceResults.length > 0 || enhancing) && (
            <TranslationEnhancePanel
              results={enhanceResults}
              analyzing={enhancing}
              onApplySuggestion={handleApplyEnhanceSuggestion}
              onApplyAll={handleApplyAllEnhanceSuggestions}
              onClose={() => setEnhanceResults([])}
            />
          )}

          {editor.state && (
            <div className="mb-4">
              <TranslationAIEnhancePanel
                entries={editor.isFilterActive ? editor.filteredEntries : editor.state.entries}
                translations={editor.state.translations}
                glossary={editor.activeGlossary}
                onApplySuggestion={editor.updateTranslation}
              />
            </div>
          )}

          {!editor.user && (
            <Card className="mb-4 border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-3 p-4"><LogIn className="w-4 h-4" /> سجّل دخولك للمزامنة</CardContent>
            </Card>
          )}

          {/* Filter Bar */}
          <div className="mb-6 p-3 md:p-4 bg-card rounded border border-border">
            <div className="flex gap-2 md:gap-3 items-center">
              <DebouncedInput placeholder="ابحث عن نصوص..." value={editor.search} onChange={(val) => editor.setSearch(val)}
                className="flex-1 min-w-[120px] px-3 py-2 rounded bg-background border border-border font-body text-sm" />
              <Button variant={editor.isPinned ? "default" : "outline"} size="sm" onClick={editor.togglePin}
                className={`font-body text-xs shrink-0 ${editor.isPinned ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
                title={editor.isPinned ? 'إلغاء تثبيت الصفحة — العودة للتصفية الديناميكية' : 'تثبيت الصفحة — تجميد النتائج الحالية أثناء التعديل'}>
                <Pin className={`w-3 h-3 ${editor.isPinned ? 'fill-current' : ''}`} /> {editor.isPinned ? 'مثبّت' : 'تثبيت'}
              </Button>
              {isMobile ? (
                <Button variant={editor.filtersOpen ? "secondary" : "outline"} size="sm" onClick={() => editor.setFiltersOpen(!editor.filtersOpen)} className="font-body text-xs shrink-0">
                  <Filter className="w-3 h-3" /> فلاتر
                </Button>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: "translated", label: "✅ مترجم" }, { value: "untranslated", label: "⬜ غير مترجم" },
                      { value: "problems", label: "🚨 مشاكل" }, { value: "needs-improve", label: `⚠️ تحسين (${editor.needsImproveCount.total})` },
                      { value: "too-short", label: `📏 قصير (${editor.needsImproveCount.tooShort})` },
                      { value: "too-long", label: `📐 طويل (${editor.needsImproveCount.tooLong})` },
                      { value: "stuck-chars", label: `🔤 ملتصق (${editor.needsImproveCount.stuck})` },
                      { value: "mixed-lang", label: `🌐 مختلط (${editor.needsImproveCount.mixed})` },
                      { value: "has-tags", label: `🔧 رموز تقنية (${editor.tagsCount})` }, { value: "no-tags", label: "✨ بدون رموز" },
                      { value: "duplicates", label: `🔁 مكرر (${editor.qualityStats.duplicateTranslations})` },
                      { value: "punctuation", label: `❓ ترقيم (${editor.qualityStats.punctuationMismatch})` },
                      { value: "unclosed-brackets", label: `🔓 أقواس (${editor.qualityStats.unclosedBrackets})` },
                    ].map(f => (
                      <Button key={f.value} variant={editor.filterStatus.has(f.value) ? "default" : "outline"} size="sm"
                        onClick={() => editor.toggleFilterStatus(f.value)} className="text-xs h-7 px-2 font-body">{f.label}</Button>
                    ))}
                    {editor.filterStatus.size > 0 && (
                      <Button variant="ghost" size="sm" onClick={editor.clearFilterStatus} className="text-xs h-7 px-2 font-body text-destructive">✕ مسح</Button>
                    )}
                  </div>
                  <select value={editor.filterFile} onChange={e => editor.setFilterFile(e.target.value)} className="px-3 py-2 rounded bg-background border border-border font-body text-sm max-w-[200px]">
                    <option value="all">كل الملفات</option>
                    {editor.msbtFiles.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select value={editor.filterTechnical} onChange={e => editor.setFilterTechnical(e.target.value as any)} className="px-3 py-2 rounded bg-background border border-border font-body text-sm">
                    <option value="all">الكل</option>
                    <option value="exclude">بدون تقني</option>
                    <option value="only">تقني فقط</option>
                  </select>
                  <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} className="px-3 py-2 rounded bg-background border border-border font-body text-sm">
                    <option value="all">كل الصعوبات</option>
                    <option value="simple">🟢 بسيط ({difficultyStats.simple})</option>
                    <option value="medium">🟡 متوسط ({difficultyStats.medium})</option>
                    <option value="complex">🔴 معقد ({difficultyStats.complex})</option>
                  </select>
                  <Button variant={editor.quickReviewMode ? "secondary" : "outline"} size="sm" onClick={() => { editor.setQuickReviewMode(!editor.quickReviewMode); editor.setQuickReviewIndex(0); }} className="font-body text-xs">
                    <Eye className="w-3 h-3" /> مراجعة سريعة
                  </Button>
                  <Button variant={editor.showFindReplace ? "secondary" : "outline"} size="sm" onClick={() => editor.setShowFindReplace(!editor.showFindReplace)} className="font-body text-xs">
                    <Replace className="w-3 h-3" /> بحث واستبدال
                  </Button>
                  <Button variant={showDiffView ? "secondary" : "outline"} size="sm" onClick={() => setShowDiffView(!showDiffView)} className="font-body text-xs">
                    <Columns className="w-3 h-3" /> مقارنة
                  </Button>
                </>
              )}
            </div>
            {isMobile && editor.filtersOpen && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: "translated", label: "✅ مترجم" }, { value: "untranslated", label: "⬜ غير مترجم" },
                    { value: "problems", label: "🚨 مشاكل" }, { value: "needs-improve", label: "⚠️ تحسين" },
                    { value: "stuck-chars", label: "🔤 ملتصق" }, { value: "mixed-lang", label: "🌐 مختلط" },
                    { value: "has-tags", label: "🔧 رموز تقنية" }, { value: "no-tags", label: "✨ بدون رموز" },
                    { value: "duplicates", label: "🔁 مكرر" }, { value: "punctuation", label: "❓ ترقيم" },
                    { value: "unclosed-brackets", label: "🔓 أقواس" },
                  ].map(f => (
                    <Button key={f.value} variant={editor.filterStatus.has(f.value) ? "default" : "outline"} size="sm"
                      onClick={() => editor.toggleFilterStatus(f.value)} className="text-xs h-7 px-2 font-body">{f.label}</Button>
                  ))}
                  {editor.filterStatus.size > 0 && (
                    <Button variant="ghost" size="sm" onClick={editor.clearFilterStatus} className="text-xs h-7 px-2 font-body text-destructive">✕ مسح</Button>
                  )}
                </div>
                <select value={editor.filterFile} onChange={e => editor.setFilterFile(e.target.value)} className="w-full px-3 py-2 rounded bg-background border border-border font-body text-sm">
                  <option value="all">كل الملفات</option>
                  {editor.msbtFiles.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Needs Improvement Badges */}
          {editor.needsImproveCount.total > 0 && !isMobile && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs font-display text-muted-foreground">⚠️ تحتاج تحسين:</span>
              {editor.needsImproveCount.tooShort > 0 && (
                <Button variant={editor.filterStatus.has("too-short") ? "default" : "outline"} size="sm" onClick={() => editor.toggleFilterStatus("too-short")} className="text-xs h-6 px-2 border-accent/30 text-accent">
                  📏 قصيرة: {editor.needsImproveCount.tooShort}
                </Button>
              )}
              {editor.needsImproveCount.tooLong > 0 && (
                <Button variant={editor.filterStatus.has("too-long") ? "default" : "outline"} size="sm" onClick={() => editor.toggleFilterStatus("too-long")} className="text-xs h-6 px-2 border-destructive/30 text-destructive">
                  📐 طويلة: {editor.needsImproveCount.tooLong}
                </Button>
              )}
              {editor.needsImproveCount.stuck > 0 && (
                <Button variant={editor.filterStatus.has("stuck-chars") ? "default" : "outline"} size="sm" onClick={() => editor.toggleFilterStatus("stuck-chars")} className="text-xs h-6 px-2 border-secondary/30 text-secondary">
                  🔤 ملتصقة: {editor.needsImproveCount.stuck}
                </Button>
              )}
              {editor.needsImproveCount.mixed > 0 && (
                <Button variant={editor.filterStatus.has("mixed-lang") ? "default" : "outline"} size="sm" onClick={() => editor.toggleFilterStatus("mixed-lang")} className="text-xs h-6 px-2 border-primary/30 text-primary">
                  🌐 مختلطة: {editor.needsImproveCount.mixed}
                </Button>
              )}
            </div>
          )}

          {/* Glossary indicator */}
          {editor.glossaryTermCount > 0 && (
            <div className="mb-4 rounded-lg bg-primary/5 border border-primary/15">
              <div className="flex items-center gap-2 px-3 py-1.5">
                <BookOpen className="w-3.5 h-3.5 text-primary/70" />
                <span className="text-xs text-primary/80 font-body">📖 القاموس: <strong>{editor.glossaryTermCount}</strong> مصطلح</span>
                <Button variant={editor.glossaryEnabled ? "secondary" : "outline"} size="sm" onClick={() => editor.setGlossaryEnabled(!editor.glossaryEnabled)} className="mr-auto h-6 px-2 text-xs font-body">
                  {editor.glossaryEnabled ? <><Eye className="w-3 h-3" /> مفعّل</> : <><EyeOff className="w-3 h-3" /> معطّل</>}
                </Button>
                {editor.glossaryEnabled && (
                  <>
                    {editor.isFilterActive && (
                      <Button variant="outline" size="sm" onClick={() => setGlossaryApplyConfirm('filtered')} className="h-6 px-2 text-xs font-body border-accent/30 text-accent-foreground hover:bg-accent/20" title="تطبيق مصطلحات القاموس على الترجمات المفلترة فقط">
                        <Filter className="w-3 h-3" /> تطبيق المفلتر
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setGlossaryApplyConfirm('all')} className="h-6 px-2 text-xs font-body border-primary/20 text-primary/80 hover:bg-primary/10" title="تطبيق مصطلحات القاموس على جميع الترجمات">
                      <Replace className="w-3 h-3" /> تطبيق الكل
                    </Button>
                  </>
                )}
              </div>
              {editor.glossaryCoverage && editor.state && (
                <div className="px-3 pb-2 pt-1 border-t border-primary/10">
                  <div className="grid grid-cols-2 gap-2 text-xs font-body">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">تغطية المصدر</span>
                      <div className="flex items-center gap-1.5">
                        <Progress value={editor.glossaryCoverage.coveragePercent} className="h-2 flex-1" />
                        <span className="text-primary font-semibold min-w-[3ch] text-left">{editor.glossaryCoverage.coveragePercent}%</span>
                      </div>
                      <span className="text-muted-foreground/70 text-[10px]">{editor.glossaryCoverage.matchedInSource} / {editor.glossaryCoverage.totalTerms} مصطلح موجود</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">اتساق الترجمة</span>
                      <div className="flex items-center gap-1.5">
                        <Progress value={editor.glossaryCoverage.consistencyPercent} className="h-2 flex-1" />
                        <span className={`font-semibold min-w-[3ch] text-left ${editor.glossaryCoverage.consistencyPercent < 50 ? 'text-destructive' : editor.glossaryCoverage.consistencyPercent < 80 ? 'text-accent' : 'text-primary'}`}>
                          {editor.glossaryCoverage.consistencyPercent}%
                        </span>
                      </div>
                      <span className="text-muted-foreground/70 text-[10px]">{editor.glossaryCoverage.translatedWithGlossary} / {editor.glossaryCoverage.translatedTotal} ترجمة متوافقة</span>
                    </div>
                  </div>
                  {editor.glossaryCoverage.topMatched.length > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger className="text-[10px] text-primary/60 hover:text-primary/90 mt-1.5 flex items-center gap-1 cursor-pointer">
                        <BarChart3 className="w-3 h-3" /> عرض تفاصيل المصطلحات
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1.5 space-y-1">
                        <div className="text-[10px] text-muted-foreground">
                          <span className="font-semibold text-primary">✅ مصطلحات مطابقة ({editor.glossaryCoverage.matchedInSource}):</span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {editor.glossaryCoverage.topMatched.map((t, i) => (
                              <span key={i} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">{t.eng} → {t.arb}</span>
                            ))}
                            {editor.glossaryCoverage.matchedInSource > 20 && <span className="text-muted-foreground/50">+{editor.glossaryCoverage.matchedInSource - 20} أخرى</span>}
                          </div>
                        </div>
                        {editor.glossaryCoverage.topUnmatched.length > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            <span className="font-semibold text-accent">⚠️ غير موجودة في النصوص ({editor.glossaryCoverage.totalTerms - editor.glossaryCoverage.matchedInSource}):</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {editor.glossaryCoverage.topUnmatched.map((t, i) => (
                                <span key={i} className="bg-accent/10 text-accent px-1.5 py-0.5 rounded text-[10px]">{t.eng}</span>
                              ))}
                              {(editor.glossaryCoverage.totalTerms - editor.glossaryCoverage.matchedInSource) > 10 && (
                                <span className="text-muted-foreground/50">+{editor.glossaryCoverage.totalTerms - editor.glossaryCoverage.matchedInSource - 10} أخرى</span>
                              )}
                            </div>
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}
              {/* Glossary Export Buttons */}
              <div className="flex items-center gap-2 px-3 py-1.5 border-t border-primary/10">
                <span className="text-[10px] text-muted-foreground">تصدير القاموس:</span>
                <Button variant="outline" size="sm" onClick={() => editor.handleExportGlossary('csv')} className="h-5 px-2 text-[10px] font-body">CSV</Button>
                <Button variant="outline" size="sm" onClick={() => editor.handleExportGlossary('json')} className="h-5 px-2 text-[10px] font-body">JSON</Button>
              </div>
              {/* Smart Glossary Suggestions */}
              {editor.smartGlossarySuggestions.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-1 px-3 py-1.5 border-t border-primary/10 text-[10px] text-amber-600 hover:text-amber-700 cursor-pointer w-full">
                    <Sparkles className="w-3 h-3" /> اقتراحات ذكية ({editor.smartGlossarySuggestions.length} مصطلح متكرر غير مضاف)
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-2 space-y-1">
                    {editor.smartGlossarySuggestions.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{s.term}</span>
                        <span className="text-muted-foreground">({s.count}x)</span>
                        <input type="text" placeholder="الترجمة..." className="flex-1 px-2 py-0.5 rounded border border-border text-[10px] bg-background" dir="rtl"
                          onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) { editor.handleAddToGlossary(s.term, (e.target as HTMLInputElement).value.trim()); (e.target as HTMLInputElement).value = ''; } }}
                        />
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">اكتب الترجمة واضغط Enter لإضافتها للقاموس</p>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}

          {/* Cloud & Actions Toolbar */}
          <EditorToolbar
            isMobile={isMobile} editor={editor} untranslatedCount={untranslatedCount}
            polishing={polishing} handlePolishArabic={handlePolishArabic}
            setShowInconsistencies={setShowInconsistencies} setShowSmartImprove={setShowSmartImprove}
            enhancing={enhancing} handleEnhanceWithContext={handleEnhanceWithContext}
          />

          {/* Build Options */}
          <Card className="mb-3 border-border">
            <CardContent className="p-3 sm:p-4">
              <h3 className="font-display font-bold mb-2 text-xs sm:text-sm">⚙️ خيارات البناء</h3>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-body">
                  <input type="checkbox" checked={editor.arabicNumerals} onChange={(e) => editor.setArabicNumerals(e.target.checked)} className="rounded border-border" />
                  تحويل الأرقام إلى هندية (٠١٢٣٤٥٦٧٨٩)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-body">
                  <input type="checkbox" checked={editor.mirrorPunctuation} onChange={(e) => editor.setMirrorPunctuation(e.target.checked)} className="rounded border-border" />
                  عكس علامات الترقيم (؟ ، ؛)
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Arabic Processing + Build Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 sm:mb-6">
            <Button size="sm" variant="secondary" onClick={editor.handleApplyArabicProcessing} disabled={editor.applyingArabic} className="flex-1 font-display font-semibold text-xs sm:text-sm h-9 sm:h-10">
              {editor.applyingArabic ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />} تطبيق المعالجة العربية ✨
            </Button>
            <Button size="sm" onClick={editor.handlePreBuild} disabled={editor.building} className="flex-1 font-display font-semibold text-xs sm:text-sm h-9 sm:h-10">
              {editor.building ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <FileDown className="w-3.5 h-3.5 mr-1.5" />} بناء الملف النهائي
            </Button>
          </div>

          {/* Quality Stats Panel */}
          {editor.showQualityStats && (
            <QualityStatsPanel qualityStats={editor.qualityStats} translatedCount={editor.translatedCount}
              setFilterStatus={editor.setFilterStatus} setShowQualityStats={editor.setShowQualityStats}
              onExportReport={editor.exportQualityReport} onFixAllPunctuation={editor.handleFixAllPunctuation}
              onFixAllBrackets={editor.handleFixAllBrackets} onFixAllDiacritics={editor.handleFixAllDiacritics}
              onFixAllSpaces={editor.handleFixAllSpaces} onFixAllHamza={editor.handleFixAllHamza} />
          )}

          {/* Quick Review Mode */}
          {editor.quickReviewMode && (
            <QuickReviewMode filteredEntries={editor.filteredEntries} quickReviewIndex={editor.quickReviewIndex}
              setQuickReviewIndex={editor.setQuickReviewIndex} setQuickReviewMode={editor.setQuickReviewMode}
              translations={editor.state.translations} qualityProblemKeys={editor.qualityStats.problemKeys}
              updateTranslation={editor.updateTranslation} entries={editor.state.entries} glossary={editor.state.glossary} />
          )}

          {/* Find & Replace */}
          {editor.showFindReplace && editor.state && (
            <FindReplacePanel entries={editor.state.entries} translations={editor.state.translations}
              onReplace={editor.handleBulkReplace} onClose={() => editor.setShowFindReplace(false)} />
          )}

          {/* Diff View */}
          {showDiffView && editor.state && (
            <DiffView entries={editor.filteredEntries} translations={editor.state.translations} onClose={() => setShowDiffView(false)} />
          )}

          {/* Pagination Header */}
          {editor.displayedEntries.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                عرض {editor.currentPage * PAGE_SIZE + 1}-{Math.min((editor.currentPage + 1) * PAGE_SIZE, editor.displayedEntries.length)} من {editor.displayedEntries.length} نص{editor.isPinned ? ' 📌' : ''}
              </p>
              <PaginationControls currentPage={editor.currentPage} totalPages={editor.totalPages} totalItems={editor.displayedEntries.length} pageSize={PAGE_SIZE} setCurrentPage={editor.setCurrentPage} />
            </div>
          )}

          {/* Entries List */}
          <div className="space-y-2">
            {editor.displayedEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد نصوص مطابقة</p>
            ) : (
              editor.paginatedEntries
                .filter(entry => filterDifficulty === 'all' || classifyDifficulty(entry).level === filterDifficulty)
                .map((entry) => {
                  const key = `${entry.msbtFile}:${entry.index}`;
                  const difficulty = classifyDifficulty(entry);
                  const diffConf = DIFFICULTY_CONFIG[difficulty.level];
                  // Use pre-built per-file map (C1 fix): O(1) lookup vs O(N) filter+sort
                  const sameFileEntries = entriesByFile.get(entry.msbtFile) || [];
                  const tm: { key: string; translation: string }[] = [];
                  if (editor.state) {
                    for (const e of sameFileEntries) {
                      if (e.index === entry.index) continue;
                      const t = editor.state.translations[`${e.msbtFile}:${e.index}`] || '';
                      if (t.trim()) {
                        tm.push({ key: `${e.msbtFile}:${e.index}`, translation: t });
                        if (tm.length >= 5) break;
                      }
                    }
                  }
                  const entryIdx = sameFileEntries.findIndex(e => e.index === entry.index);
                  const adjacentContext = {
                    prev: entryIdx > 0 ? sameFileEntries[entryIdx - 1].original.slice(0, 60) : undefined,
                    next: entryIdx < sameFileEntries.length - 1 ? sameFileEntries[entryIdx + 1].original.slice(0, 60) : undefined,
                  };
                  const extraToolButtons = [
                    { onClick: () => openSceneContext(entry), icon: "🎬", title: "عرض سياق المشهد", cls: "bg-muted/40 text-muted-foreground hover:bg-muted" },
                    { onClick: () => openContextSuggest(entry), icon: "💡", title: "اقتراحات سياقية بالـ AI", cls: "bg-primary/10 text-primary hover:bg-primary/20" },
                    { onClick: () => openEngineCompare(entry), icon: "⚖️", title: "مقارنة بين المحركات", cls: "bg-secondary/10 text-secondary hover:bg-secondary/20" },
                  ];
                  return (
                    <div key={key} className="relative">
                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${diffConf.bgColor} ${diffConf.color} border border-current/10`} title={`${difficulty.reasons.join('، ')} • ~${difficulty.estimatedMinutes} دقيقة`}>
                          {diffConf.emoji} {diffConf.label}
                        </span>
                      </div>
                      <EntryCard entry={entry} translation={editor.state?.translations[key] || ''} glossary={editor.state?.glossary}
                        adjacentContext={adjacentContext} isProtected={editor.state?.protectedEntries?.has(key) || false}
                        hasProblem={editor.qualityStats.problemKeys.has(key)} isDamagedTag={editor.qualityStats.damagedTagKeys.has(key)}
                        isMobile={isMobile} translatingSingle={editor.translatingSingle} improvingTranslations={editor.improvingTranslations}
                        previousTranslations={editor.previousTranslations} isTranslationTooShort={editor.isTranslationTooShort}
                        isTranslationTooLong={editor.isTranslationTooLong} hasStuckChars={editor.hasStuckChars} isMixedLanguage={editor.isMixedLanguage}
                        updateTranslation={editor.updateTranslation} handleTranslateSingle={editor.handleTranslateSingle}
                        handleImproveSingleTranslation={editor.handleImproveSingleTranslation} handleUndoTranslation={editor.handleUndoTranslation}
                        handleFixReversed={editor.handleFixReversed} handleLocalFixDamagedTag={editor.handleLocalFixDamagedTag}
                        translationMemory={tm} translatorNotes={translatorNotes} onUpdateNote={handleUpdateNote}
                        extraToolButtons={extraToolButtons} />
                    </div>
                  );
                })
            )}
          </div>

          {/* Pagination Footer */}
          <PaginationControls currentPage={editor.currentPage} totalPages={editor.totalPages} totalItems={editor.filteredEntries.length} pageSize={PAGE_SIZE} setCurrentPage={editor.setCurrentPage} />
        </div>

        {/* Dialogs */}
        <BuildStatsDialog stats={editor.buildStats} onClose={() => editor.setBuildStats(null)} />

        <AlertDialog open={editor.showRetranslateConfirm} onOpenChange={editor.setShowRetranslateConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>إعادة ترجمة الصفحة؟</AlertDialogTitle>
              <AlertDialogDescription>
                {(() => {
                  const count = editor.paginatedEntries.filter(e => {
                    const key = `${e.msbtFile}:${e.index}`;
                    return editor.state?.translations[key]?.trim() && !isTechnicalText(e.original);
                  }).length;
                  return `سيتم استبدال ${count} ترجمة موجودة في هذه الصفحة بترجمات جديدة. يمكنك التراجع عن هذا الإجراء لاحقاً.`;
                })()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={() => { editor.setShowRetranslateConfirm(false); editor.handleRetranslatePage(); }}>إعادة الترجمة</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showFilterTranslateConfirm} onOpenChange={setShowFilterTranslateConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>🎯 ترجمة النصوص المحددة بالفلتر</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2 text-right">
                <p>الفلتر نشط — سيتم ترجمة <strong>{untranslatedCount}</strong> نص غير مترجم فقط من أصل <strong>{editor.filteredEntries.length}</strong> نص ظاهر.</p>
                <p className="text-xs text-muted-foreground">النصوص خارج الفلتر لن تتأثر. يمكنك إزالة الفلتر لترجمة الكل.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setShowFilterTranslateConfirm(false); editor.handleAutoTranslate(); }}>ترجمة {untranslatedCount} نص 🚀</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <BuildConfirmDialog open={editor.showBuildConfirm} onOpenChange={editor.setShowBuildConfirm} preview={editor.buildPreview} onConfirm={editor.handleBuild} building={editor.building} />

        {editor.fixPreview && (
          <FixPreviewDialog open={!!editor.fixPreview} onClose={() => editor.setFixPreview(null)} onApply={editor.handleApplyFixPreview}
            title={editor.fixPreview.title} items={editor.fixPreview.items} />
        )}

        {/* Glossary Apply Confirmation with Library Selection */}
        <Dialog open={!!glossaryApplyConfirm} onOpenChange={(v) => !v && setGlossaryApplyConfirm(null)}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="font-display text-base">تطبيق مصطلحات القاموس</DialogTitle>
              <DialogDescription className="font-body text-sm">
                {(() => {
                  const targetEntries = glossaryApplyConfirm === 'filtered' ? editor.filteredEntries : (editor.state?.entries || []);
                  const translatedEntries = targetEntries.filter(e => {
                    const key = `${e.msbtFile}:${e.index}`;
                    const t = editor.state?.translations[key]?.trim();
                    return t && t !== e.original;
                  });
                  return `سيتم فحص ${translatedEntries.length} نص مترجم ${glossaryApplyConfirm === 'filtered' ? '(من المفلتر)' : '(من الكل)'}`;
                })()}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <p className="text-xs text-muted-foreground font-body">اختر القواميس المراد تطبيقها:</p>
              {[
                { id: 'default', label: 'القاموس الأساسي' }, { id: 'totk', label: 'قاموس TOTK' },
                { id: 'totk-items', label: 'قاموس العناصر' }, { id: 'materials', label: 'المواد والأسلحة' },
                { id: 'ui', label: 'الواجهة والقوائم' }, { id: 'locations', label: 'المواقع والشخصيات' },
                { id: 'creatures', label: 'المخلوقات والوحوش' }, { id: 'abilities', label: 'القدرات والتأثيرات' },
              ].map(lib => (
                <label key={lib.id} className="flex items-center gap-2 text-sm font-body cursor-pointer hover:bg-accent/10 rounded px-2 py-1.5 transition-colors">
                  <input type="checkbox" checked={selectedGlossaryLibs.has(lib.id)}
                    onChange={() => { setSelectedGlossaryLibs(prev => { const next = new Set(prev); if (next.has(lib.id)) next.delete(lib.id); else next.add(lib.id); return next; }); }}
                    className="rounded border-border accent-primary w-4 h-4" />
                  <span>{lib.label}</span>
                </label>
              ))}
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" size="sm" className="h-6 text-xs font-body"
                  onClick={() => setSelectedGlossaryLibs(new Set(['default','totk','totk-items','materials','ui','locations','creatures','abilities']))}>تحديد الكل</Button>
                <Button variant="ghost" size="sm" className="h-6 text-xs font-body" onClick={() => setSelectedGlossaryLibs(new Set())}>إلغاء الكل</Button>
              </div>
            </div>
            <DialogFooter className="flex-row gap-2">
              <Button variant="outline" size="sm" className="font-body" onClick={() => setGlossaryApplyConfirm(null)}>إلغاء</Button>
              <Button size="sm" className="font-body" disabled={selectedGlossaryLibs.size === 0} onClick={async () => {
                const libUrls: Record<string, string> = {
                  'default': '/zelda-glossary.txt', 'totk': '/zelda-totk-glossary.txt',
                  'totk-items': '/zelda-totk-items-glossary.txt', 'materials': '/zelda-materials-glossary.txt',
                  'ui': '/zelda-ui-glossary.txt', 'locations': '/zelda-locations-characters-glossary.txt',
                  'creatures': '/zelda-creatures-glossary.txt', 'abilities': '/zelda-abilities-glossary.txt',
                };
                const useLoadedGlossary = selectedGlossaryLibs.size === 8 && editor.state?.glossary?.trim();
                let glossaryText = '';
                if (useLoadedGlossary) { glossaryText = editor.state!.glossary!; }
                else {
                  const urls = Array.from(selectedGlossaryLibs).map(id => libUrls[id]).filter(Boolean);
                  try {
                    const responses = await Promise.all(urls.map(u => fetch(u)));
                    const texts = await Promise.all(responses.map(r => r.ok ? r.text() : Promise.resolve('')));
                    glossaryText = texts.filter(Boolean).join('\n');
                  } catch { return; }
                }
                const entries = glossaryApplyConfirm === 'filtered' ? editor.filteredEntries : (editor.state?.entries || []);
                const changes = editor.generateGlossaryPreview(entries, glossaryText);
                if (changes && changes.length > 0) { setGlossaryPreviewChanges(changes); setShowGlossaryPreview(true); }
                setGlossaryApplyConfirm(null);
              }}>متابعة ({selectedGlossaryLibs.size} قاموس)</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <GlossaryApplyPreview open={showGlossaryPreview} onClose={() => setShowGlossaryPreview(false)} changes={glossaryPreviewChanges}
          onApply={(approvedKeys) => editor.applyApprovedGlossaryChanges(glossaryPreviewChanges, approvedKeys)} />

        {sceneContextEntry && editor.state && (
          <SceneContextPanel open={showSceneContext} onClose={() => setShowSceneContext(false)} entry={sceneContextEntry}
            entries={editor.state.entries} translations={editor.state.translations} />
        )}
        {editor.state && (
          <InconsistencyDetector open={showInconsistencies} onClose={() => setShowInconsistencies(false)} entries={editor.state.entries}
            translations={editor.state.translations} glossary={editor.state.glossary} onApplyFix={editor.updateTranslation} />
        )}
        {contextSuggestEntry && editor.state && (
          <ContextSuggestPanel open={showContextSuggest} onClose={() => setShowContextSuggest(false)} entry={contextSuggestEntry}
            entries={editor.state.entries} translations={editor.state.translations} glossary={editor.state.glossary} onApplyTranslation={editor.updateTranslation} />
        )}
        <FeatureTourDialog open={showFeatureTour} onClose={() => setShowFeatureTour(false)} />
        <KeyboardShortcutsDialog open={showKeyboardShortcuts} onClose={() => setShowKeyboardShortcuts(false)} />
        {engineCompareEntry && editor.state && (
          <EngineComparePanel open={showEngineCompare} onClose={() => setShowEngineCompare(false)} entry={engineCompareEntry}
            entries={editor.state.entries} translations={editor.state.translations} glossary={editor.state.glossary}
            userGeminiKey={editor.userGeminiKey} userClaudeKey={editor.userClaudeKey} userBedrockApiKey={editor.userBedrockApiKey} userBedrockRegion={editor.userBedrockRegion} myMemoryEmail={editor.myMemoryEmail} onApplyTranslation={editor.updateTranslation} />
        )}
        {editor.state && (
          <SmartBulkImprovePanel open={showSmartImprove} onClose={() => setShowSmartImprove(false)} entries={editor.state.entries}
            translations={editor.state.translations} glossary={editor.state.glossary} isFilterActive={editor.isFilterActive}
            filteredEntries={editor.filteredEntries} onApplyImprovements={handleSmartImproveApply} />
        )}
        {/* Deep Tag Scan Report Dialog */}
        <Dialog open={!!editor.deepScanReport} onOpenChange={(v) => !v && editor.setDeepScanReport(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">🔍 تقرير الفحص العميق للوسوم</DialogTitle>
              <DialogDescription>
                نتائج الفحص الآلي لجميع النصوص المُترجمة التي تحتوي على وسوم تقنية.
              </DialogDescription>
            </DialogHeader>
            {editor.deepScanReport && (
              <div className="overflow-y-auto space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded bg-muted/30 border border-border/40">
                    <div className="text-2xl font-bold text-foreground">{editor.deepScanReport.scanned}</div>
                    <div className="text-xs text-muted-foreground">نص مفحوص</div>
                  </div>
                  <div className="p-3 rounded bg-primary/10 border border-primary/30">
                    <div className="text-2xl font-bold text-primary">{editor.deepScanReport.fixed}</div>
                    <div className="text-xs text-muted-foreground">أُصلح تلقائياً</div>
                  </div>
                  <div className="p-3 rounded bg-destructive/10 border border-destructive/30">
                    <div className="text-2xl font-bold text-destructive">{editor.deepScanReport.notFixable}</div>
                    <div className="text-xs text-muted-foreground">يحتاج يدوياً</div>
                  </div>
                </div>
                {Object.keys(editor.deepScanReport.perFile).length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-xs text-muted-foreground">📁 إصلاحات حسب الملف:</h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {Object.entries(editor.deepScanReport.perFile)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([file, count]) => (
                          <div key={file} className="flex justify-between items-center text-xs px-2 py-1 rounded bg-muted/20">
                            <span className="truncate" dir="ltr">{file}</span>
                            <span className="text-primary font-mono shrink-0">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                {editor.deepScanReport.examples.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-xs text-muted-foreground">📝 معاينة الإصلاحات (أول 5):</h4>
                    <div className="space-y-2">
                      {editor.deepScanReport.examples.map((ex, i) => (
                        <div key={i} className="text-xs p-2 rounded border border-border/40 bg-muted/10 space-y-1">
                          <div className="text-muted-foreground text-[10px]">{ex.key}</div>
                          <div><span className="text-destructive">قبل:</span> <span dir="rtl">{ex.before}</span></div>
                          <div><span className="text-primary">بعد:</span> <span dir="rtl">{ex.after}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {editor.deepScanReport.manualReview && editor.deepScanReport.manualReview.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-xs text-amber-600">⚠️ يحتاج مراجعة يدوية ({editor.deepScanReport.manualReview.length}):</h4>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {editor.deepScanReport.manualReview.map((m, i) => (
                        <div key={i} className="text-xs p-2 rounded border border-amber-500/30 bg-amber-500/5 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground text-[10px] truncate" dir="ltr">{m.file} • {m.label}</span>
                            <span className="text-amber-600 text-[10px] shrink-0">{m.reason}</span>
                          </div>
                          <div className="text-foreground/80 truncate" dir="rtl">{m.current}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">افتح كل نص في المحرر لإصلاحه يدوياً (تكرار وسوم أو ترتيب يحتاج قرار بشري).</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => editor.setDeepScanReport(null)}>إغلاق</Button>
              {editor.deepScanReport?.pendingUpdates && (
                <Button onClick={() => { editor.applyDeepScanFixes(); }} className="gap-1">
                  ✅ تطبيق الإصلاحات ({Object.keys(editor.deepScanReport.pendingUpdates).length})
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default Editor;
