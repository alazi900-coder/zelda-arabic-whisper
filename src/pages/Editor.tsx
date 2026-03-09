import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight, Download, FileText, Loader2, Filter, Sparkles, Save, Tag,
  Upload, FileDown, Cloud, CloudUpload, LogIn, BookOpen, AlertTriangle,
  Eye, EyeOff, RotateCcw, CheckCircle2, ShieldCheck, ChevronLeft, ChevronRight,
  BarChart3, Menu, MoreVertical, Replace, Columns, Key,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

import { useEditorState } from "@/hooks/useEditorState";
import { PAGE_SIZE, isTechnicalText } from "@/components/editor/types";
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

  // Drag & Drop handlers
  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = React.useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer) {
      await editor.handleDropImport(e.dataTransfer);
    }
  }, [editor.handleDropImport]);
  // حساب عدد النصوص غير المترجمة (يحترم الفلتر النشط)
  const untranslatedCount = React.useMemo(() => {
    if (!editor.state) return 0;
    const entries = editor.isFilterActive ? editor.filteredEntries : editor.state.entries;
    return entries.filter(e => {
      const key = `${e.msbtFile}:${e.index}`;
      const t = editor.state!.translations[key]?.trim();
      return !t || t === e.original || t === e.original.trim();
    }).length;
  }, [editor.state, editor.filteredEntries, editor.isFilterActive]);

  if (!editor.state) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-muted-foreground mb-4">لا توجد بيانات للتحرير. يرجى استخراج النصوص أولاً.</p>
          <Link to="/process"><Button className="font-display">اذهب لصفحة المعالجة</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div
        className="min-h-screen py-4 md:py-8 px-3 md:px-4 relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drop overlay */}
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

          <h1 className="text-2xl md:text-3xl font-display font-bold mb-1 md:mb-2">محرر الترجمة ✍️</h1>
          <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6 font-body">عدّل النصوص العربية يدوياً أو استخدم الترجمة التلقائية</p>

          {/* Stats Cards */}
          <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-6">
            <Card className="flex-1 min-w-[100px]">
              <CardContent className="flex items-center gap-2 md:gap-3 p-3 md:p-4">
                <FileText className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                <div>
                  <p className="text-base md:text-lg font-display font-bold">{editor.state.entries.length}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">إجمالي النصوص</p>
                </div>
              </CardContent>
            </Card>
            <Card className="flex-1 min-w-[100px]">
              <CardContent className="flex items-center gap-2 md:gap-3 p-3 md:p-4">
                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-secondary" />
                <div>
                  <p className="text-base md:text-lg font-display font-bold">{editor.translatedCount}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">مترجم</p>
                </div>
              </CardContent>
            </Card>
            {!isMobile && (
              <>
                <Card className="flex-1 min-w-[140px]">
                  <CardContent className="flex items-center gap-3 p-4">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    <div>
                      <p className="text-lg font-display font-bold">{editor.qualityStats.total}</p>
                      <p className="text-xs text-muted-foreground">مشاكل جودة</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => editor.setShowQualityStats(!editor.showQualityStats)} className="ml-auto text-xs">
                      {editor.showQualityStats ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </CardContent>
                </Card>
                <Card className="flex-1 min-w-[140px]">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Tag className="w-5 h-5 text-accent" />
                    <div>
                      <p className="text-lg font-display font-bold">{editor.state.protectedEntries?.size || 0} / {editor.state.entries.length}</p>
                      <p className="text-xs text-muted-foreground">محمي من العكس</p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {editor.translating ? (
              <Button size={isMobile ? "default" : "lg"} variant="destructive" onClick={editor.handleStopTranslate} className="font-display font-bold px-4 md:px-6">
                <Loader2 className="w-4 h-4 animate-spin" /> إيقاف ⏹️
              </Button>
            ) : (
              <Button size={isMobile ? "default" : "lg"} variant="default" onClick={() => {
                if (editor.isFilterActive) {
                  setShowFilterTranslateConfirm(true);
                } else {
                  editor.handleAutoTranslate();
                }
              }} disabled={editor.translating} className="font-display font-bold px-4 md:px-6">
                <Sparkles className="w-4 h-4" /> {editor.isFilterActive ? `ترجمة المحدد (${untranslatedCount}) 🎯` : 'ترجمة تلقائية 🤖'}
              </Button>
            )}
            <Button size={isMobile ? "default" : "lg"} variant="outline" onClick={() => editor.setShowRetranslateConfirm(true)} disabled={editor.translating} className="font-display font-bold px-4 md:px-6 border-accent/30 text-accent hover:text-accent">
              <RotateCcw className="w-4 h-4" /> إعادة ترجمة الصفحة 🔄
            </Button>
          </div>

          {/* Translation Engine Selector + Gemini API Key */}
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="p-3 md:p-4 space-y-3">
              {/* Engine selector */}
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-display font-bold">محرك الترجمة</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                   <Button
                    variant={editor.translationEngine === 'lovable' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => editor.setTranslationEngine('lovable')}
                    className="text-xs font-body"
                  >
                    🤖 Lovable AI
                  </Button>
                  <Button
                    variant={editor.translationEngine === 'gemini' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => editor.setTranslationEngine('gemini')}
                    className="text-xs font-body"
                    disabled={!editor.userGeminiKey}
                  >
                    ✨ Gemini (شخصي)
                  </Button>
                  <Button
                    variant={editor.translationEngine === 'mymemory' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => editor.setTranslationEngine('mymemory')}
                    className="text-xs font-body"
                  >
                    🌐 MyMemory (مجاني)
                  </Button>
                </div>
              </div>
              {/* Translation Quality Selector */}
              {editor.translationEngine !== 'mymemory' && (
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-display font-bold">جودة الترجمة</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant={editor.translationQuality === 'fast' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => editor.setTranslationQuality('fast')}
                      className="text-xs font-body"
                    >
                      ⚡ سريعة (Flash)
                    </Button>
                    <Button
                      variant={editor.translationQuality === 'quality' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => editor.setTranslationQuality('quality')}
                      className="text-xs font-body"
                    >
                      💎 عالية الجودة (Pro)
                    </Button>
                  </div>
                  <span className="text-xs text-muted-foreground font-body">
                    {editor.translationQuality === 'quality' ? 'أدق لكن أبطأ — يستخدم Gemini Pro' : 'أسرع وأخف — يستخدم Gemini Flash'}
                  </span>
                </div>
              )}
              {/* Gemini API Key */}
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <Key className="w-4 h-4 text-primary" />
                  <span className="text-sm font-display font-bold">🔑 مفتاح Gemini API</span>
                </div>
                <div className="flex gap-2 flex-1">
                  <input
                    type="password"
                    placeholder="الصق مفتاح API هنا للترجمة المجانية..."
                    value={editor.userGeminiKey}
                    onChange={(e) => {
                      editor.setUserGeminiKey(e.target.value);
                      if (e.target.value) editor.setTranslationEngine('gemini');
                    }}
                    className="flex-1 px-3 py-1.5 rounded bg-background border border-border font-body text-sm"
                    dir="ltr"
                  />
                  {editor.userGeminiKey && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      editor.setUserGeminiKey('');
                      if (editor.translationEngine === 'gemini') editor.setTranslationEngine('lovable');
                    }} className="text-xs text-destructive shrink-0">
                      مسح
                    </Button>
                  )}
                </div>
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline hover:text-primary/80 shrink-0">
                  احصل على مفتاح مجاني ↗
                </a>
              </div>
              {editor.userGeminiKey && (
                <p className="text-xs text-secondary font-body">✅ مفتاح Gemini مفعّل{editor.translationEngine === 'gemini' ? ' — سيُستخدم للترجمة' : ''}</p>
              )}
              {/* MyMemory Email & Quota */}
              {editor.translationEngine === 'mymemory' && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                    <span className="text-xs font-body text-muted-foreground shrink-0">📧 بريد إلكتروني (اختياري — يرفع الحد لـ 50,000 حرف/يوم):</span>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={editor.myMemoryEmail}
                      onChange={(e) => editor.setMyMemoryEmail(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded bg-background border border-border font-body text-sm"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-body text-muted-foreground">
                      <span>الاستهلاك اليومي</span>
                      <span>{editor.myMemoryCharsUsed.toLocaleString()} / {editor.myMemoryDailyLimit.toLocaleString()} حرف</span>
                    </div>
                    <Progress
                      value={editor.myMemoryDailyLimit > 0 ? (editor.myMemoryCharsUsed / editor.myMemoryDailyLimit) * 100 : 0}
                      className={`h-2 ${editor.myMemoryCharsUsed / editor.myMemoryDailyLimit > 0.9 ? '[&>div]:bg-destructive' : editor.myMemoryCharsUsed / editor.myMemoryDailyLimit > 0.7 ? '[&>div]:bg-accent' : ''}`}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Progress */}
          <CategoryProgress
            categoryProgress={editor.categoryProgress}
            filterCategory={editor.filterCategory}
            setFilterCategory={editor.setFilterCategory}
            damagedTagsCount={editor.qualityStats.damagedTags}
            onFilterDamagedTags={() => editor.toggleFilterStatus("damaged-tags")}
            isDamagedTagsActive={editor.filterStatus.has("damaged-tags")}
            onFixDamagedTags={() => editor.handleFixDamagedTags(editor.qualityStats.damagedTagKeys)}
            onLocalFixDamagedTags={() => editor.handleLocalFixAllDamagedTags(editor.qualityStats.damagedTagKeys)}
            isFixing={editor.translating}
            onRedistributeTags={editor.handleRedistributeTags}
            tagsCount={editor.tagsCount}
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
          {editor.lastSaved && (
            <Card className="mb-4 border-secondary/30 bg-secondary/5"><CardContent className="p-4 text-center font-display">{editor.lastSaved}</CardContent></Card>
          )}
          {editor.translateProgress && (
            <Card className="mb-4 border-secondary/30 bg-secondary/5"><CardContent className="p-4 text-center font-display">{editor.translateProgress}</CardContent></Card>
          )}
          {editor.buildProgress && (
            <Card className="mb-4 border-secondary/30 bg-secondary/5 cursor-pointer" onClick={() => editor.buildStats && editor.setBuildStats(editor.buildStats)}>
              <CardContent className="p-4 text-center font-display">
                {editor.buildProgress}
                {editor.buildStats && <span className="text-xs text-muted-foreground mr-2"> (اضغط للتفاصيل)</span>}
              </CardContent>
            </Card>
          )}
          {editor.cloudStatus && (
            <Card className="mb-4 border-primary/30 bg-primary/5"><CardContent className="p-4 text-center font-display">{editor.cloudStatus}</CardContent></Card>
          )}
          {editor.tmStats && (
            <Card className="mb-4 border-secondary/30 bg-secondary/5">
              <CardContent className="p-4 text-center font-display">
                🧠 ذاكرة الترجمة: أُعيد استخدام {editor.tmStats.reused} ترجمة — أُرسل {editor.tmStats.sent} للذكاء الاصطناعي
              </CardContent>
            </Card>
          )}

          {/* Review Results */}
          <ReviewPanel
            reviewResults={editor.reviewResults}
            shortSuggestions={editor.shortSuggestions}
            improveResults={editor.improveResults}
            suggestingShort={editor.suggestingShort}
            filterCategory={editor.filterCategory}
            filterFile={editor.filterFile}
            filterStatus={editor.filterStatus}
            search={editor.search}
            handleSuggestShorterTranslations={editor.handleSuggestShorterTranslations}
            handleApplyShorterTranslation={editor.handleApplyShorterTranslation}
            handleApplyAllShorterTranslations={editor.handleApplyAllShorterTranslations}
            handleApplyImprovement={editor.handleApplyImprovement}
            handleApplyAllImprovements={editor.handleApplyAllImprovements}
            setReviewResults={editor.setReviewResults}
            setShortSuggestions={editor.setShortSuggestions}
            setImproveResults={editor.setImproveResults}
          />

          {!editor.user && (
            <Card className="mb-4 border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-3 p-4"><LogIn className="w-4 h-4" /> سجّل دخولك للمزامنة</CardContent>
            </Card>
          )}

          {/* Filter Bar */}
          <div className="mb-6 p-3 md:p-4 bg-card rounded border border-border">
            <div className="flex gap-2 md:gap-3 items-center">
              <DebouncedInput
                placeholder="ابحث عن نصوص..."
                value={editor.search}
                onChange={(val) => editor.setSearch(val)}
                className="flex-1 min-w-[120px] px-3 py-2 rounded bg-background border border-border font-body text-sm"
              />
              {isMobile ? (
                <Button variant={editor.filtersOpen ? "secondary" : "outline"} size="sm" onClick={() => editor.setFiltersOpen(!editor.filtersOpen)} className="font-body text-xs shrink-0">
                  <Filter className="w-3 h-3" /> فلاتر
                </Button>
               ) : (
                <>
                   <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: "translated", label: "✅ مترجم" },
                      { value: "untranslated", label: "⬜ غير مترجم" },
                      { value: "problems", label: "🚨 مشاكل" },
                      { value: "needs-improve", label: `⚠️ تحسين (${editor.needsImproveCount.total})` },
                      { value: "too-short", label: `📏 قصير (${editor.needsImproveCount.tooShort})` },
                      { value: "too-long", label: `📐 طويل (${editor.needsImproveCount.tooLong})` },
                      { value: "stuck-chars", label: `🔤 ملتصق (${editor.needsImproveCount.stuck})` },
                      { value: "mixed-lang", label: `🌐 مختلط (${editor.needsImproveCount.mixed})` },
                      { value: "has-tags", label: `🔧 رموز تقنية (${editor.tagsCount})` },
                      { value: "no-tags", label: "✨ بدون رموز" },
                      { value: "duplicates", label: `🔁 مكرر (${editor.qualityStats.duplicateTranslations})` },
                      { value: "punctuation", label: `❓ ترقيم (${editor.qualityStats.punctuationMismatch})` },
                      { value: "unclosed-brackets", label: `🔓 أقواس (${editor.qualityStats.unclosedBrackets})` },
                    ].map(f => (
                      <Button
                        key={f.value}
                        variant={editor.filterStatus.has(f.value) ? "default" : "outline"}
                        size="sm"
                        onClick={() => editor.toggleFilterStatus(f.value)}
                        className="text-xs h-7 px-2 font-body"
                      >
                        {f.label}
                      </Button>
                    ))}
                    {editor.filterStatus.size > 0 && (
                      <Button variant="ghost" size="sm" onClick={editor.clearFilterStatus} className="text-xs h-7 px-2 font-body text-destructive">
                        ✕ مسح
                      </Button>
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
                    { value: "translated", label: "✅ مترجم" },
                    { value: "untranslated", label: "⬜ غير مترجم" },
                    { value: "problems", label: "🚨 مشاكل" },
                    { value: "needs-improve", label: "⚠️ تحسين" },
                    { value: "stuck-chars", label: "🔤 ملتصق" },
                    { value: "mixed-lang", label: "🌐 مختلط" },
                    { value: "has-tags", label: "🔧 رموز تقنية" },
                    { value: "no-tags", label: "✨ بدون رموز" },
                    { value: "duplicates", label: "🔁 مكرر" },
                    { value: "punctuation", label: "❓ ترقيم" },
                    { value: "unclosed-brackets", label: "🔓 أقواس" },
                  ].map(f => (
                    <Button
                      key={f.value}
                      variant={editor.filterStatus.has(f.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => editor.toggleFilterStatus(f.value)}
                      className="text-xs h-7 px-2 font-body"
                    >
                      {f.label}
                    </Button>
                  ))}
                  {editor.filterStatus.size > 0 && (
                    <Button variant="ghost" size="sm" onClick={editor.clearFilterStatus} className="text-xs h-7 px-2 font-body text-destructive">
                      ✕ مسح
                    </Button>
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
                <Button variant={editor.filterStatus.has("too-short") ? "default" : "outline"} size="sm" onClick={() => editor.toggleFilterStatus("too-short")} className="text-xs h-6 px-2 border-amber-500/30 text-amber-600">
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
                <span className="text-xs text-primary/80 font-body">
                  📖 القاموس: <strong>{editor.glossaryTermCount}</strong> مصطلح
                </span>
                <Button
                  variant={editor.glossaryEnabled ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => editor.setGlossaryEnabled(!editor.glossaryEnabled)}
                  className="mr-auto h-6 px-2 text-xs font-body"
                >
                   {editor.glossaryEnabled ? (
                    <><Eye className="w-3 h-3" /> مفعّل</>
                  ) : (
                    <><EyeOff className="w-3 h-3" /> معطّل</>
                  )}
                </Button>
                {editor.glossaryEnabled && (
                  <>
                    {editor.isFilterActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setGlossaryApplyConfirm('filtered')}
                        className="h-6 px-2 text-xs font-body border-accent/30 text-accent-foreground hover:bg-accent/20"
                        title="تطبيق مصطلحات القاموس على الترجمات المفلترة فقط"
                      >
                        <Filter className="w-3 h-3" /> تطبيق المفلتر
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGlossaryApplyConfirm('all')}
                      className="h-6 px-2 text-xs font-body border-primary/20 text-primary/80 hover:bg-primary/10"
                      title="تطبيق مصطلحات القاموس على جميع الترجمات"
                    >
                      <Replace className="w-3 h-3" /> تطبيق الكل
                    </Button>
                  </>
                )}
              </div>
              {/* Coverage Stats */}
              {editor.glossaryCoverage && editor.state && (
                <div className="px-3 pb-2 pt-1 border-t border-primary/10">
                  <div className="grid grid-cols-2 gap-2 text-xs font-body">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">تغطية المصدر</span>
                      <div className="flex items-center gap-1.5">
                        <Progress value={editor.glossaryCoverage.coveragePercent} className="h-2 flex-1" />
                        <span className="text-primary font-semibold min-w-[3ch] text-left">
                          {editor.glossaryCoverage.coveragePercent}%
                        </span>
                      </div>
                      <span className="text-muted-foreground/70 text-[10px]">
                        {editor.glossaryCoverage.matchedInSource} / {editor.glossaryCoverage.totalTerms} مصطلح موجود
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">اتساق الترجمة</span>
                      <div className="flex items-center gap-1.5">
                        <Progress
                          value={editor.glossaryCoverage.consistencyPercent}
                          className={`h-2 flex-1 ${editor.glossaryCoverage.consistencyPercent < 50 ? '[&>div]:bg-destructive' : editor.glossaryCoverage.consistencyPercent < 80 ? '[&>div]:bg-yellow-500' : ''}`}
                        />
                        <span className={`font-semibold min-w-[3ch] text-left ${editor.glossaryCoverage.consistencyPercent < 50 ? 'text-destructive' : editor.glossaryCoverage.consistencyPercent < 80 ? 'text-yellow-600' : 'text-primary'}`}>
                          {editor.glossaryCoverage.consistencyPercent}%
                        </span>
                      </div>
                      <span className="text-muted-foreground/70 text-[10px]">
                        {editor.glossaryCoverage.translatedWithGlossary} / {editor.glossaryCoverage.translatedTotal} ترجمة متوافقة
                      </span>
                    </div>
                  </div>
                  {editor.glossaryCoverage.topMatched.length > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger className="text-[10px] text-primary/60 hover:text-primary/90 mt-1.5 flex items-center gap-1 cursor-pointer">
                        <BarChart3 className="w-3 h-3" /> عرض تفاصيل المصطلحات
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1.5 space-y-1">
                        <div className="text-[10px] text-muted-foreground">
                          <span className="font-semibold text-green-600">✅ مصطلحات مطابقة ({editor.glossaryCoverage.matchedInSource}):</span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {editor.glossaryCoverage.topMatched.map((t, i) => (
                              <span key={i} className="bg-green-500/10 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded text-[10px]">
                                {t.eng} → {t.arb}
                              </span>
                            ))}
                            {editor.glossaryCoverage.matchedInSource > 20 && (
                              <span className="text-muted-foreground/50">+{editor.glossaryCoverage.matchedInSource - 20} أخرى</span>
                            )}
                          </div>
                        </div>
                        {editor.glossaryCoverage.topUnmatched.length > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            <span className="font-semibold text-orange-600">⚠️ غير موجودة في النصوص ({editor.glossaryCoverage.totalTerms - editor.glossaryCoverage.matchedInSource}):</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {editor.glossaryCoverage.topUnmatched.map((t, i) => (
                                <span key={i} className="bg-orange-500/10 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded text-[10px]">
                                  {t.eng}
                                </span>
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
            </div>
          )}

          {/* Cloud & Actions */}
          {isMobile ? (
            <div className="flex flex-wrap gap-2 mb-6">
              <Button variant="outline" size="sm" onClick={editor.handleCloudSave} disabled={!editor.user || editor.cloudSyncing} className="font-body text-xs">
                {editor.cloudSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} حفظ
              </Button>
              <Button variant="outline" size="sm" onClick={editor.handleCloudLoad} disabled={!editor.user || editor.cloudSyncing} className="font-body text-xs">
                <Cloud className="w-3 h-3" /> تحميل
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="font-body text-xs"><Download className="w-3 h-3" /> ملفات</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border z-50">
                  <DropdownMenuItem onClick={editor.handleExportTranslations}><Download className="w-4 h-4" /> تصدير JSON{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.handleExportEnglishOnly()}><FileText className="w-4 h-4" /> تصدير الإنجليزية كاملاً ({untranslatedCount}) 🇬🇧</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.handleExportEnglishOnly(1000)}><FileText className="w-4 h-4" /> تصدير مقسّم (1000/ملف) 🇬🇧</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.handleExportEnglishOnly(500)}><FileText className="w-4 h-4" /> تصدير مقسّم (500/ملف) 🇬🇧</DropdownMenuItem>
                  <DropdownMenuItem onClick={editor.handleImportTranslations}><Upload className="w-4 h-4" /> استيراد JSON{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={editor.handleExportCSV}><FileDown className="w-4 h-4" /> تصدير CSV{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</DropdownMenuItem>
                  <DropdownMenuItem onClick={editor.handleImportCSV}><Upload className="w-4 h-4" /> استيراد CSV{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={editor.handleImportGlossary}><BookOpen className="w-4 h-4" /> تحميل قاموس مخصص</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs">📖 القواميس المدمجة</DropdownMenuLabel>
                  <DropdownMenuItem onClick={editor.handleLoadDefaultGlossary}>🗡️ القاموس الأساسي</DropdownMenuItem>
                  <DropdownMenuItem onClick={editor.handleLoadTOTKGlossary}>🌿 قاموس TOTK</DropdownMenuItem>
                  <DropdownMenuItem onClick={editor.handleLoadTOTKItemsGlossary}>🎒 قاموس العناصر</DropdownMenuItem>
                  <DropdownMenuItem onClick={editor.handleLoadMaterialsGlossary}>⚔️ قاموس المواد والأسلحة</DropdownMenuItem>
                   <DropdownMenuItem onClick={editor.handleLoadUIGlossary}>🖥️ قاموس الواجهة والقوائم</DropdownMenuItem>
                   <DropdownMenuItem onClick={editor.handleLoadLocationsGlossary}>🗺️ قاموس المواقع والشخصيات</DropdownMenuItem>
                   <DropdownMenuItem onClick={editor.handleLoadCreaturesGlossary}>🐉 قاموس المخلوقات والوحوش</DropdownMenuItem>
                   <DropdownMenuItem onClick={editor.handleLoadAbilitiesGlossary}>✨ قاموس القدرات والتأثيرات</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={editor.handleLoadAllGlossaries}>📚 تحميل الكل ودمجهم</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="font-body text-xs" disabled={!editor.user}><Cloud className="w-3 h-3" /> سحابة</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border z-50">
                  <DropdownMenuLabel className="text-xs">المزامنة السحابية</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={editor.handleSaveGlossaryToCloud} disabled={!editor.user || editor.cloudSyncing}><CloudUpload className="w-4 h-4" /> حفظ القاموس</DropdownMenuItem>
                  <DropdownMenuItem onClick={editor.handleLoadGlossaryFromCloud} disabled={!editor.user || editor.cloudSyncing}><Cloud className="w-4 h-4" /> تحميل القاموس</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="font-body text-xs"><MoreVertical className="w-3 h-3" /> أدوات</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border z-50">
                  <DropdownMenuItem onClick={editor.handleApplyArabicProcessing} disabled={editor.applyingArabic}><Sparkles className="w-4 h-4" /> تطبيق المعالجة العربية ✨</DropdownMenuItem>
                  <DropdownMenuItem onClick={editor.handleFixAllReversed}><RotateCcw className="w-4 h-4" /> تصحيح الكل (معكوس)</DropdownMenuItem>
                  <DropdownMenuItem onClick={editor.handleReviewTranslations} disabled={editor.reviewing || editor.translatedCount === 0}><ShieldCheck className="w-4 h-4" /> مراجعة ذكية 🔍</DropdownMenuItem>
                  <DropdownMenuItem onClick={editor.handleImproveTranslations} disabled={editor.improvingTranslations || editor.translatedCount === 0}><Sparkles className="w-4 h-4" /> تحسين الترجمات ✨</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={editor.handleFixAllStuckCharacters} disabled={editor.needsImproveCount.stuck === 0}><AlertTriangle className="w-4 h-4" /> إصلاح الأحرف الملتصقة 🔤</DropdownMenuItem>
                  <DropdownMenuItem onClick={editor.handleFixMixedLanguage} disabled={editor.fixingMixed || editor.needsImproveCount.mixed === 0}>
                    {editor.fixingMixed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />} إصلاح النصوص المختلطة 🌐
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="mb-6 flex gap-3 flex-wrap">
              <Button variant="outline" onClick={editor.handleExportTranslations} className="font-body"><Download className="w-4 h-4" /> تصدير JSON{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="font-body"><FileText className="w-4 h-4" /> تصدير الإنجليزية ({untranslatedCount}) 🇬🇧{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-card border-border z-50">
                  <DropdownMenuItem onClick={() => editor.handleExportEnglishOnly()}>📄 تصدير كامل في ملف واحد</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs">📦 تصدير مقسّم</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => editor.handleExportEnglishOnly(1000)}>1000 نص لكل ملف</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.handleExportEnglishOnly(500)}>500 نص لكل ملف</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.handleExportEnglishOnly(200)}>200 نص لكل ملف</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={editor.handleImportTranslations} className="font-body"><Upload className="w-4 h-4" /> استيراد JSON{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</Button>
              <Button variant="outline" onClick={editor.handleExportCSV} className="font-body"><FileDown className="w-4 h-4" /> تصدير CSV{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</Button>
              <Button variant="outline" onClick={editor.handleImportCSV} className="font-body"><Upload className="w-4 h-4" /> استيراد CSV{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</Button>
              <Button variant="outline" onClick={editor.handleImportGlossary} className="font-body"><BookOpen className="w-4 h-4" /> تحميل قاموس مخصص</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="font-body border-primary/30 text-primary hover:text-primary">📖 القواميس المدمجة</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-card border-border z-50">
                  <DropdownMenuItem onClick={editor.handleLoadDefaultGlossary}>🗡️ القاموس الأساسي (زيلدا)</DropdownMenuItem>
                  <DropdownMenuItem onClick={editor.handleLoadTOTKGlossary}>🌿 قاموس TOTK الإضافي</DropdownMenuItem>
                  <DropdownMenuItem onClick={editor.handleLoadTOTKItemsGlossary}>🎒 قاموس العناصر والأسلحة</DropdownMenuItem>
                  <DropdownMenuItem onClick={editor.handleLoadMaterialsGlossary}>⚔️ قاموس المواد والأسلحة</DropdownMenuItem>
                   <DropdownMenuItem onClick={editor.handleLoadUIGlossary}>🖥️ قاموس الواجهة والقوائم</DropdownMenuItem>
                   <DropdownMenuItem onClick={editor.handleLoadLocationsGlossary}>🗺️ قاموس المواقع والشخصيات</DropdownMenuItem>
                   <DropdownMenuItem onClick={editor.handleLoadCreaturesGlossary}>🐉 قاموس المخلوقات والوحوش</DropdownMenuItem>
                   <DropdownMenuItem onClick={editor.handleLoadAbilitiesGlossary}>✨ قاموس القدرات والتأثيرات</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={editor.handleLoadAllGlossaries}>📚 تحميل الكل ودمجهم</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={editor.handleSaveGlossaryToCloud} disabled={!editor.user || editor.cloudSyncing} className="font-body border-secondary/30 text-secondary hover:text-secondary">
                {editor.cloudSyncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CloudUpload className="w-4 h-4 mr-2" />} حفظ القاموس ☁️
              </Button>
              <Button variant="outline" onClick={editor.handleLoadGlossaryFromCloud} disabled={!editor.user || editor.cloudSyncing} className="font-body border-secondary/30 text-secondary hover:text-secondary">
                {editor.cloudSyncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Cloud className="w-4 h-4 mr-2" />} تحميل من السحابة ☁️
              </Button>
              <Button variant="outline" onClick={editor.handleFixAllReversed} className="font-body border-accent/30 text-accent hover:text-accent">
                <RotateCcw className="w-4 h-4" /> تصحيح الكل (عربي معكوس)
              </Button>
              <Button variant="outline" onClick={editor.handleReviewTranslations} disabled={editor.reviewing || editor.translatedCount === 0} className="font-body border-green-500/30 text-green-600 hover:text-green-700">
                {editor.reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} مراجعة ذكية 🔍
              </Button>
              <Button variant="outline" onClick={editor.handleImproveTranslations} disabled={editor.improvingTranslations || editor.translatedCount === 0} className="font-body border-secondary/30 text-secondary hover:text-secondary">
                {editor.improvingTranslations ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} تحسين الترجمات ✨
              </Button>
              <Button variant="outline" onClick={editor.handleFixMixedLanguage} disabled={editor.fixingMixed || editor.needsImproveCount.mixed === 0} className="font-body border-primary/30 text-primary hover:text-primary">
                {editor.fixingMixed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />} إصلاح النصوص المختلطة 🌐
              </Button>
            </div>
          )}

          {/* Build Options */}
          <Card className="mb-4 border-border">
            <CardContent className="p-4">
              <h3 className="font-display font-bold mb-3 text-sm">⚙️ خيارات البناء</h3>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-body">
                  <input type="checkbox" checked={editor.arabicNumerals} onChange={(e) => editor.setArabicNumerals(e.target.checked)} className="rounded border-border" />
                  تحويل الأرقام إلى هندية (٠١٢٣٤٥٦٧٨٩)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-body">
                  <input type="checkbox" checked={editor.mirrorPunctuation} onChange={(e) => editor.setMirrorPunctuation(e.target.checked)} className="rounded border-border" />
                  عكس علامات الترقيم (؟ ، ؛)
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Arabic Processing + Build Buttons */}
          <div className="flex gap-3 mb-6">
            <Button size="lg" variant="secondary" onClick={editor.handleApplyArabicProcessing} disabled={editor.applyingArabic} className="flex-1 font-display font-bold">
              {editor.applyingArabic ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />} تطبيق المعالجة العربية ✨
            </Button>
            <Button size="lg" onClick={editor.handlePreBuild} disabled={editor.building} className="flex-1 font-display font-bold">
              {editor.building ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />} بناء الملف النهائي
            </Button>
          </div>

          {/* Quality Stats Panel */}
          {editor.showQualityStats && (
            <QualityStatsPanel
              qualityStats={editor.qualityStats}
              translatedCount={editor.translatedCount}
              setFilterStatus={editor.setFilterStatus}
              setShowQualityStats={editor.setShowQualityStats}
              onExportReport={editor.exportQualityReport}
              onFixAllPunctuation={editor.handleFixAllPunctuation}
              onFixAllBrackets={editor.handleFixAllBrackets}
              onFixAllDiacritics={editor.handleFixAllDiacritics}
              onFixAllSpaces={editor.handleFixAllSpaces}
              onFixAllHamza={editor.handleFixAllHamza}
            />
          )}

          {/* Quick Review Mode */}
          {editor.quickReviewMode && (
            <QuickReviewMode
              filteredEntries={editor.filteredEntries}
              quickReviewIndex={editor.quickReviewIndex}
              setQuickReviewIndex={editor.setQuickReviewIndex}
              setQuickReviewMode={editor.setQuickReviewMode}
              translations={editor.state.translations}
              qualityProblemKeys={editor.qualityStats.problemKeys}
              updateTranslation={editor.updateTranslation}
            />
          )}

          {/* Find & Replace */}
          {editor.showFindReplace && editor.state && (
            <FindReplacePanel
              entries={editor.state.entries}
              translations={editor.state.translations}
              onReplace={editor.handleBulkReplace}
              onClose={() => editor.setShowFindReplace(false)}
            />
          )}

          {/* Diff View */}
          {showDiffView && editor.state && (
            <DiffView
              entries={editor.filteredEntries}
              translations={editor.state.translations}
              onClose={() => setShowDiffView(false)}
            />
          )}

          {/* Pagination Header */}
          {editor.filteredEntries.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                عرض {editor.currentPage * PAGE_SIZE + 1}-{Math.min((editor.currentPage + 1) * PAGE_SIZE, editor.filteredEntries.length)} من {editor.filteredEntries.length} نص
              </p>
              <PaginationControls currentPage={editor.currentPage} totalPages={editor.totalPages} totalItems={editor.filteredEntries.length} pageSize={PAGE_SIZE} setCurrentPage={editor.setCurrentPage} />
            </div>
          )}

          {/* Entries List */}
          <div className="space-y-2">
            {editor.filteredEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد نصوص مطابقة</p>
            ) : (
              editor.paginatedEntries.map((entry) => {
                const key = `${entry.msbtFile}:${entry.index}`;
                // Build small TM from same file's existing translations
                const tm = editor.state ? editor.state.entries
                  .filter(e => e.msbtFile === entry.msbtFile && e.index !== entry.index)
                  .map(e => ({ key: `${e.msbtFile}:${e.index}`, translation: editor.state!.translations[`${e.msbtFile}:${e.index}`] || '' }))
                  .filter(t => t.translation.trim())
                  .slice(0, 5) : [];
                return (
                  <EntryCard
                    key={key}
                    entry={entry}
                    translation={editor.state?.translations[key] || ''}
                    glossary={editor.state?.glossary}
                    isProtected={editor.state?.protectedEntries?.has(key) || false}
                    hasProblem={editor.qualityStats.problemKeys.has(key)}
                    isDamagedTag={editor.qualityStats.damagedTagKeys.has(key)}
                    isMobile={isMobile}
                    translatingSingle={editor.translatingSingle}
                    improvingTranslations={editor.improvingTranslations}
                    previousTranslations={editor.previousTranslations}
                    isTranslationTooShort={editor.isTranslationTooShort}
                    isTranslationTooLong={editor.isTranslationTooLong}
                    hasStuckChars={editor.hasStuckChars}
                    isMixedLanguage={editor.isMixedLanguage}
                    updateTranslation={editor.updateTranslation}
                    handleTranslateSingle={editor.handleTranslateSingle}
                    handleImproveSingleTranslation={editor.handleImproveSingleTranslation}
                    handleUndoTranslation={editor.handleUndoTranslation}
                    handleFixReversed={editor.handleFixReversed}
                    handleLocalFixDamagedTag={editor.handleLocalFixDamagedTag}
                    translationMemory={tm}
                  />
                );
              })
            )}
          </div>

          {/* Pagination Footer */}
          <PaginationControls currentPage={editor.currentPage} totalPages={editor.totalPages} totalItems={editor.filteredEntries.length} pageSize={PAGE_SIZE} setCurrentPage={editor.setCurrentPage} />
        </div>

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

        {/* Filter Translate Confirmation */}
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
              <AlertDialogAction onClick={() => { setShowFilterTranslateConfirm(false); editor.handleAutoTranslate(); }}>
                ترجمة {untranslatedCount} نص 🚀
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <BuildConfirmDialog
          open={editor.showBuildConfirm}
          onOpenChange={editor.setShowBuildConfirm}
          preview={editor.buildPreview}
          onConfirm={editor.handleBuild}
          building={editor.building}
        />

        {editor.fixPreview && (
          <FixPreviewDialog
            open={!!editor.fixPreview}
            onClose={() => editor.setFixPreview(null)}
            onApply={editor.handleApplyFixPreview}
            title={editor.fixPreview.title}
            items={editor.fixPreview.items}
          />
        )}

        {/* Glossary Apply Confirmation */}
        <AlertDialog open={!!glossaryApplyConfirm} onOpenChange={(v) => !v && setGlossaryApplyConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">تطبيق مصطلحات القاموس</AlertDialogTitle>
              <AlertDialogDescription className="font-body text-sm space-y-2" dir="rtl">
                {(() => {
                  const targetEntries = glossaryApplyConfirm === 'filtered' ? editor.filteredEntries : (editor.state?.entries || []);
                  const translatedEntries = targetEntries.filter(e => {
                    const key = `${e.msbtFile}:${e.index}`;
                    const t = editor.state?.translations[key]?.trim();
                    return t && t !== e.original;
                  });
                  return (
                    <>
                      <p>سيتم فحص <strong>{translatedEntries.length}</strong> نص مترجم {glossaryApplyConfirm === 'filtered' ? '(من المفلتر)' : '(من الكل)'} بحثاً عن مصطلحات إنجليزية قابلة للاستبدال من القاموس ({editor.glossaryTermCount} مصطلح).</p>
                      <p className="text-muted-foreground">ستظهر لك معاينة للتغييرات قبل تطبيقها فعلياً.</p>
                    </>
                  );
                })()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-body">إلغاء</AlertDialogCancel>
              <AlertDialogAction className="font-body" onClick={() => {
                const entries = glossaryApplyConfirm === 'filtered' ? editor.filteredEntries : (editor.state?.entries || []);
                const changes = glossaryApplyConfirm === 'filtered'
                  ? editor.handleApplyGlossaryToFiltered(entries)
                  : editor.handleApplyGlossaryToAll();
                if (changes && changes.length > 0) {
                  setGlossaryPreviewChanges(changes);
                  setShowGlossaryPreview(true);
                }
                setGlossaryApplyConfirm(null);
              }}>
                متابعة
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <GlossaryApplyPreview
          open={showGlossaryPreview}
          onClose={() => setShowGlossaryPreview(false)}
          changes={glossaryPreviewChanges}
          onApply={(approvedKeys) => editor.applyApprovedGlossaryChanges(glossaryPreviewChanges, approvedKeys)}
        />
      </div>
    </TooltipProvider>
  );
};

export default Editor;
