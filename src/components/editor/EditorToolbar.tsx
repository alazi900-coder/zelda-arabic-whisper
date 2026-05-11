import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Download, Upload, FileText, FileDown, BookOpen, Cloud, CloudUpload,
  Loader2, RotateCcw, ShieldCheck, Sparkles, Filter, Wand2, Search,
  Layers, MoreVertical, Save, Lightbulb, FlaskConical, SkipForward,
  ChevronDown, ChevronUp, Undo2, Wrench,
} from "lucide-react";
import type { useEditorState } from "@/hooks/useEditorState";

type EditorState = ReturnType<typeof useEditorState>;
type GroupKey = "nav" | "cloud" | "io" | "glossary" | "fix" | "clean" | "ai";
const ALL_GROUPS: GroupKey[] = ["nav", "cloud", "io", "glossary", "fix", "clean", "ai"];

interface EditorToolbarProps {
  isMobile: boolean;
  editor: EditorState;
  untranslatedCount: number;
  polishing: boolean;
  handlePolishArabic: () => void;
  setShowInconsistencies: (v: boolean) => void;
  setShowSmartImprove: (v: boolean) => void;
  enhancing?: boolean;
  handleEnhanceWithContext?: () => void;
  onJumpToUntranslated?: () => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  isMobile, editor, untranslatedCount, polishing,
  handlePolishArabic, setShowInconsistencies, setShowSmartImprove,
  enhancing, handleEnhanceWithContext, onJumpToUntranslated,
}) => {
  if (isMobile) {
    return (
      <div className="flex flex-wrap gap-2 mb-4">
        <Button asChild variant="outline" size="sm" className="font-body text-xs border-emerald-500/40 text-emerald-700 hover:text-emerald-800">
          <Link to="/quality-lab"><FlaskConical className="w-3 h-3" /> المختبر</Link>
        </Button>
        {onJumpToUntranslated && (
          <Button variant="outline" size="sm" onClick={onJumpToUntranslated} className="font-body text-xs border-amber-500/40 text-amber-700 hover:text-amber-800" title="القفز للنص التالي غير المترجم">
            <SkipForward className="w-3 h-3" /> التالي غير المترجم
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={editor.handleCloudSave} disabled={!editor.user || editor.cloudSyncing} className="font-body text-xs">
          {editor.cloudSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} حفظ
        </Button>
        <Button variant="outline" size="sm" onClick={editor.handleCloudLoad} disabled={!editor.user || editor.cloudSyncing} className="font-body text-xs">
          <Cloud className="w-3 h-3" /> تحميل
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="font-body text-xs"><Download className="w-3 h-3" /> تصدير / استيراد</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border z-50">
            <DropdownMenuItem onClick={editor.handleExportTranslations}><Download className="w-4 h-4" /> تصدير JSON{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.handleExportEnglishOnly()}><FileText className="w-4 h-4" /> تصدير الإنجليزية كاملاً ({untranslatedCount}) 🇬🇧</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.handleExportEnglishOnly(1000)}><FileText className="w-4 h-4" /> تصدير مقسّم (1000/ملف) 🇬🇧</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.handleExportEnglishOnly(500)}><FileText className="w-4 h-4" /> تصدير مقسّم (500/ملف) 🇬🇧</DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleImportTranslations}><Upload className="w-4 h-4" /> استيراد JSON{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleImportEnglishTxt}><Upload className="w-4 h-4" /> استيراد الإنجليزية TXT 🇬🇧{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={editor.handleExportCSV}><FileDown className="w-4 h-4" /> تصدير CSV{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleImportCSV}><Upload className="w-4 h-4" /> استيراد CSV{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="font-body text-xs"><BookOpen className="w-3 h-3" /> القواميس</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border z-50">
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
            <DropdownMenuItem onClick={editor.handleUndoArabicProcessing} disabled={editor.applyingArabic}><Undo2 className="w-4 h-4" /> تراجع عن المعالجة العربية ↺</DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleFixAllReversed}><RotateCcw className="w-4 h-4" /> تصحيح الكل (معكوس)</DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleReviewTranslations} disabled={editor.reviewing || editor.translatedCount === 0}><ShieldCheck className="w-4 h-4" /> مراجعة ذكية 🔍</DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleImproveTranslations} disabled={editor.improvingTranslations || editor.translatedCount === 0}><Sparkles className="w-4 h-4" /> تحسين الترجمات ✨</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">🧹 تنظيف النصوص (مع مراجعة قبل التطبيق)</DropdownMenuLabel>
            <DropdownMenuItem onClick={editor.handleFixAllDiacritics} disabled={editor.translatedCount === 0}>🔡 إزالة التشكيلات</DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleFixAllBrackets} disabled={editor.translatedCount === 0}>🏷️ إصلاح أقواس الوسوم [Color:Red]</DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleFixAllLonelyLam} disabled={editor.translatedCount === 0}>🔠 إصلاح اللام المنفردة (ل → لا)</DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleFixAllTaaHaa} disabled={editor.translatedCount === 0}>🔤 إصلاح تاء مربوطة/هاء (ه → ة)</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={editor.handleFixAllStuckCharacters} disabled={editor.needsImproveCount.stuck === 0}>🔤 إصلاح الأحرف الملتصقة</DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleFixMixedLanguage} disabled={editor.fixingMixed || editor.needsImproveCount.mixed === 0}>
              {editor.fixingMixed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />} إصلاح النصوص المختلطة 🌐
            </DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleDeepTagScan} className="text-amber-600 focus:text-amber-700">
              🔍 فحص عميق للوسوم وإصلاحها
            </DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleScanTagsAndLineBreaks} className="text-blue-600 focus:text-blue-700">
              <Wrench className="w-4 h-4" /> إصلاح الرموز التقنية وفواصل السطور 🛠️
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">🆕 أدوات متقدمة</DropdownMenuLabel>
            <DropdownMenuItem onClick={handlePolishArabic} disabled={polishing || editor.translatedCount === 0}>
              {polishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} تحسين الصياغة العربية ✍️
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">🤖 مراجعات AI متقدمة</DropdownMenuLabel>
            <DropdownMenuItem onClick={editor.handleSmartReview} disabled={editor.advancedBusy === 'smart-review' || editor.translatedCount === 0}>
              {editor.advancedBusy === 'smart-review' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>🔬</>} مراجعة ذكية عميقة
            </DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleGrammarCheck} disabled={editor.advancedBusy === 'grammar-check' || editor.translatedCount === 0}>
              {editor.advancedBusy === 'grammar-check' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>✍️</>} فحص نحوي متخصّص
            </DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleContextReview} disabled={editor.advancedBusy === 'context-review' || editor.translatedCount === 0}>
              {editor.advancedBusy === 'context-review' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>🎭</>} مراجعة مع سياق المشاهد
            </DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleAutoCorrect} disabled={editor.advancedBusy === 'auto-correct' || editor.translatedCount === 0}>
              {editor.advancedBusy === 'auto-correct' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>🔧</>} تصحيح إملائي/نحوي جماعي
            </DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleDetectWeak} disabled={editor.advancedBusy === 'detect-weak' || editor.translatedCount === 0}>
              {editor.advancedBusy === 'detect-weak' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>⚠️</>} كشف الترجمات الضعيفة
            </DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleContextRetranslate} disabled={editor.advancedBusy === 'context-retranslate' || editor.translatedCount === 0}>
              {editor.advancedBusy === 'context-retranslate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>🎬</>} إعادة ترجمة مع سياق
            </DropdownMenuItem>
            {handleEnhanceWithContext && (
              <DropdownMenuItem onClick={handleEnhanceWithContext} disabled={enhancing || editor.translatedCount === 0}>
                {enhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />} تحسين بالسياق 💡
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setShowInconsistencies(true)} disabled={editor.translatedCount === 0}>
              <Search className="w-4 h-4" /> كشف التناقضات 🔍
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowSmartImprove(true)} disabled={editor.translatedCount === 0}>
              <Layers className="w-4 h-4" /> تحسين جماعي ذكي 🧠
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return <DesktopToolbar
    editor={editor}
    untranslatedCount={untranslatedCount}
    polishing={polishing}
    handlePolishArabic={handlePolishArabic}
    setShowInconsistencies={setShowInconsistencies}
    setShowSmartImprove={setShowSmartImprove}
    enhancing={enhancing}
    handleEnhanceWithContext={handleEnhanceWithContext}
    onJumpToUntranslated={onJumpToUntranslated}
  />;
};

const STORAGE_KEY = "editor-toolbar-collapsed-groups-v1";

const DesktopToolbar: React.FC<Omit<EditorToolbarProps, "isMobile">> = ({
  editor, untranslatedCount, polishing, handlePolishArabic,
  setShowInconsistencies, setShowSmartImprove, enhancing,
  handleEnhanceWithContext, onJumpToUntranslated,
}) => {
  const [collapsedAll, setCollapsedAll] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>(() => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {} as Record<GroupKey, boolean>;
  });

  const persist = (next: Record<GroupKey, boolean>) => {
    setCollapsed(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const toggleGroup = (k: GroupKey) => persist({ ...collapsed, [k]: !collapsed[k] });
  const toggleAll = () => {
    const next = !collapsedAll;
    setCollapsedAll(next);
    const map: Record<GroupKey, boolean> = {} as Record<GroupKey, boolean>;
    ALL_GROUPS.forEach(g => { map[g] = next; });
    persist(map);
  };
  const isHidden = (k: GroupKey) => !!collapsed[k];

  const GroupHeader = ({ k, label }: { k: GroupKey; label: string }) => (
    <button
      type="button"
      onClick={() => toggleGroup(k)}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 font-body whitespace-nowrap"
      title={isHidden(k) ? "توسيع المجموعة" : "طيّ المجموعة"}
    >
      {isHidden(k) ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      <span>{label}</span>
    </button>
  );

  const Divider = () => <div className="h-8 w-px bg-border/60 mx-1 self-center" aria-hidden />;

  return (
    <div
      dir="rtl"
      className="mb-6 p-3 rounded-lg border border-border/60 bg-card/40 [&_button]:whitespace-nowrap"
    >
      {/* رأس الشريط مع زر الطي العام */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/40">
        <div className="text-xs text-muted-foreground font-body">شريط الأدوات</div>
        <Button variant="ghost" size="sm" onClick={toggleAll} className="font-body text-xs h-7">
          {collapsedAll ? <><ChevronDown className="w-3 h-3" /> توسيع الكل</> : <><ChevronUp className="w-3 h-3" /> طيّ الكل</>}
        </Button>
      </div>

      <div className="flex flex-wrap items-stretch gap-2">
        {/* المجموعة 1: التنقل */}
        <div className="flex flex-col gap-1">
          <GroupHeader k="nav" label="التنقل" />
          {!isHidden("nav") && (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm" className="font-body border-emerald-500/40 text-emerald-700 hover:text-emerald-800" title="افتح الترجمات الحاليّة في مختبر جودة الترجمة">
                <Link to="/quality-lab"><FlaskConical className="w-4 h-4" /> المختبر</Link>
              </Button>
              {onJumpToUntranslated && (
                <Button variant="outline" size="sm" onClick={onJumpToUntranslated} className="font-body border-amber-500/40 text-amber-700 hover:text-amber-800" title="القفز للنص التالي غير المترجم">
                  <SkipForward className="w-4 h-4" /> التالي غير المترجم
                </Button>
              )}
            </div>
          )}
        </div>

        <Divider />

        {/* المجموعة 2: السحابة */}
        <div className="flex flex-col gap-1">
          <GroupHeader k="cloud" label="السحابة" />
          {!isHidden("cloud") && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={editor.handleCloudSave} disabled={!editor.user || editor.cloudSyncing} className="font-body">
                {editor.cloudSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ
              </Button>
              <Button variant="outline" size="sm" onClick={editor.handleCloudLoad} disabled={!editor.user || editor.cloudSyncing} className="font-body">
                <Cloud className="w-4 h-4" /> تحميل
              </Button>
            </div>
          )}
        </div>

        <Divider />

        {/* المجموعة 3: التصدير والاستيراد */}
        <div className="flex flex-col gap-1">
          <GroupHeader k="io" label="تصدير / استيراد" />
          {!isHidden("io") && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="font-body"><Download className="w-4 h-4" /> تصدير / استيراد</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border z-50">
                <DropdownMenuLabel className="text-xs">📤 التصدير</DropdownMenuLabel>
                <DropdownMenuItem onClick={editor.handleExportTranslations}><Download className="w-4 h-4" /> تصدير JSON{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.handleExportEnglishOnly()}><FileText className="w-4 h-4" /> تصدير الإنجليزية كاملاً ({untranslatedCount}) 🇬🇧</DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.handleExportEnglishOnly(1000)}><FileText className="w-4 h-4" /> تصدير مقسّم (1000/ملف)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.handleExportEnglishOnly(500)}><FileText className="w-4 h-4" /> تصدير مقسّم (500/ملف)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.handleExportEnglishOnly(200)}><FileText className="w-4 h-4" /> تصدير مقسّم (200/ملف)</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleExportCSV}><FileDown className="w-4 h-4" /> تصدير CSV{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">📥 الاستيراد</DropdownMenuLabel>
                <DropdownMenuItem onClick={editor.handleImportTranslations}><Upload className="w-4 h-4" /> استيراد JSON{editor.isFilterActive ? ` (${editor.filterLabel})` : ''}</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleImportEnglishTxt}><Upload className="w-4 h-4" /> استيراد الإنجليزية TXT 🇬🇧</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleImportCSV}><Upload className="w-4 h-4" /> استيراد CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* المجموعة 4: القواميس */}
        <div className="flex flex-col gap-1">
          <GroupHeader k="glossary" label="القواميس" />
          {!isHidden("glossary") && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="font-body border-primary/30 text-primary hover:text-primary"><BookOpen className="w-4 h-4" /> القواميس</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border z-50">
                <DropdownMenuItem onClick={editor.handleImportGlossary}><BookOpen className="w-4 h-4" /> تحميل قاموس مخصص</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">📖 القواميس المدمجة</DropdownMenuLabel>
                <DropdownMenuItem onClick={editor.handleLoadDefaultGlossary}>🗡️ القاموس الأساسي (زيلدا)</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleLoadTOTKGlossary}>🌿 قاموس TOTK</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleLoadTOTKItemsGlossary}>🎒 قاموس العناصر</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleLoadMaterialsGlossary}>⚔️ قاموس المواد والأسلحة</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleLoadUIGlossary}>🖥️ قاموس الواجهة</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleLoadLocationsGlossary}>🗺️ قاموس المواقع والشخصيات</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleLoadCreaturesGlossary}>🐉 قاموس المخلوقات</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleLoadAbilitiesGlossary}>✨ قاموس القدرات</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={editor.handleLoadAllGlossaries}>📚 تحميل الكل ودمجهم</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={editor.handleSaveGlossaryToCloud} disabled={!editor.user || editor.cloudSyncing}><CloudUpload className="w-4 h-4" /> حفظ القاموس للسحابة</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleLoadGlossaryFromCloud} disabled={!editor.user || editor.cloudSyncing}><Cloud className="w-4 h-4" /> تحميل القاموس من السحابة</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <Divider />

        {/* المجموعة 5: إصلاحات سريعة */}
        <div className="flex flex-col gap-1">
          <GroupHeader k="fix" label="إصلاحات سريعة" />
          {!isHidden("fix") && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={editor.handleFixAllReversed} className="font-body border-accent/30 text-accent hover:text-accent">
                <RotateCcw className="w-4 h-4" /> تصحيح المعكوس
              </Button>
              <Button variant="outline" size="sm" onClick={editor.handleUndoArabicProcessing} disabled={editor.applyingArabic} className="font-body border-orange-500/40 text-orange-700 hover:text-orange-800" title="عكس آثار 'تطبيق المعالجة العربية' وإرجاع النصوص لشكلها القابل للقراءة">
                {editor.applyingArabic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} تراجع عن المعالجة العربية ↺
              </Button>
              <Button variant="outline" size="sm" onClick={editor.handleScanTagsAndLineBreaks} className="font-body border-blue-500/40 text-blue-700 hover:text-blue-800" title="فحص ثمّ استعادة الرموز التقنيّة (PUA) وفواصل الأسطر (\n) في كلّ الترجمات">
                <Wrench className="w-4 h-4" /> إصلاح الرموز وفواصل الأسطر 🛠️
              </Button>
              <Button variant="outline" size="sm" onClick={editor.handleFixMixedLanguage} disabled={editor.fixingMixed || editor.needsImproveCount.mixed === 0} className="font-body border-primary/30 text-primary hover:text-primary">
                {editor.fixingMixed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />} إصلاح المختلطة 🌐
              </Button>
            </div>
          )}
        </div>

        {/* المجموعة 6: تنظيف النصوص */}
        <div className="flex flex-col gap-1">
          <GroupHeader k="clean" label="تنظيف النصوص" />
          {!isHidden("clean") && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="font-body border-amber-500/40 text-amber-700 hover:text-amber-800">🧹 تنظيف النصوص</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border z-50">
                <DropdownMenuLabel className="text-xs">مع مراجعة قبل التطبيق</DropdownMenuLabel>
                <DropdownMenuItem onClick={editor.handleFixAllDiacritics} disabled={editor.translatedCount === 0}>🔡 إزالة التشكيلات</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleFixAllBrackets} disabled={editor.translatedCount === 0}>🏷️ إصلاح أقواس الوسوم</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleFixAllLonelyLam} disabled={editor.translatedCount === 0}>🔠 اللام المنفردة (ل → لا)</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleFixAllTaaHaa} disabled={editor.translatedCount === 0}>🔤 تاء مربوطة/هاء (ه → ة)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={editor.handleFixAllStuckCharacters} disabled={editor.needsImproveCount.stuck === 0}>🔤 الأحرف الملتصقة</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleDeepTagScan} className="text-amber-600 focus:text-amber-700">🔍 فحص عميق للوسوم</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <Divider />

        {/* المجموعة 7: الذكاء الاصطناعي */}
        <div className="flex flex-col gap-1">
          <GroupHeader k="ai" label="الذكاء الاصطناعي" />
          {!isHidden("ai") && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="font-body border-primary/40 text-primary hover:text-primary">
                  <Sparkles className="w-4 h-4" /> أدوات الذكاء الاصطناعي
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border z-50">
                <DropdownMenuLabel className="text-xs">✨ تحسينات أساسية</DropdownMenuLabel>
                <DropdownMenuItem onClick={editor.handleApplyArabicProcessing} disabled={editor.applyingArabic}><Sparkles className="w-4 h-4" /> تطبيق المعالجة العربية</DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleReviewTranslations} disabled={editor.reviewing || editor.translatedCount === 0}>
                  {editor.reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} مراجعة ذكية 🔍
                </DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleImproveTranslations} disabled={editor.improvingTranslations || editor.translatedCount === 0}>
                  {editor.improvingTranslations ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} تحسين الترجمات ✨
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePolishArabic} disabled={polishing || editor.translatedCount === 0}>
                  {polishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} تحسين الصياغة العربية ✍️
                </DropdownMenuItem>
                {handleEnhanceWithContext && (
                  <DropdownMenuItem onClick={handleEnhanceWithContext} disabled={enhancing || editor.translatedCount === 0}>
                    {enhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />} تحسين بالسياق 💡
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">🤖 مراجعات AI متقدمة</DropdownMenuLabel>
                <DropdownMenuItem onClick={editor.handleSmartReview} disabled={editor.advancedBusy === 'smart-review' || editor.translatedCount === 0}>
                  {editor.advancedBusy === 'smart-review' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>🔬</>} مراجعة ذكية عميقة
                </DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleGrammarCheck} disabled={editor.advancedBusy === 'grammar-check' || editor.translatedCount === 0}>
                  {editor.advancedBusy === 'grammar-check' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>✍️</>} فحص نحوي متخصّص
                </DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleContextReview} disabled={editor.advancedBusy === 'context-review' || editor.translatedCount === 0}>
                  {editor.advancedBusy === 'context-review' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>🎭</>} مراجعة سياقية
                </DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleAutoCorrect} disabled={editor.advancedBusy === 'auto-correct' || editor.translatedCount === 0}>
                  {editor.advancedBusy === 'auto-correct' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>🔧</>} تصحيح جماعي
                </DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleDetectWeak} disabled={editor.advancedBusy === 'detect-weak' || editor.translatedCount === 0}>
                  {editor.advancedBusy === 'detect-weak' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>⚠️</>} كشف الترجمات الضعيفة
                </DropdownMenuItem>
                <DropdownMenuItem onClick={editor.handleContextRetranslate} disabled={editor.advancedBusy === 'context-retranslate' || editor.translatedCount === 0}>
                  {editor.advancedBusy === 'context-retranslate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>🎬</>} إعادة ترجمة بسياق
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowInconsistencies(true)} disabled={editor.translatedCount === 0}>
                  <Search className="w-4 h-4" /> كشف التناقضات 🔍
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowSmartImprove(true)} disabled={editor.translatedCount === 0}>
                  <Layers className="w-4 h-4" /> تحسين جماعي ذكي 🧠
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(EditorToolbar);
