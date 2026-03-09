import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Download, Upload, FileText, FileDown, BookOpen, Cloud, CloudUpload,
  Loader2, RotateCcw, ShieldCheck, Sparkles, Filter, Wand2, Search,
  Layers, MoreVertical, Save,
} from "lucide-react";

interface EditorToolbarProps {
  isMobile: boolean;
  editor: any;
  untranslatedCount: number;
  polishing: boolean;
  handlePolishArabic: () => void;
  setShowInconsistencies: (v: boolean) => void;
  setShowSmartImprove: (v: boolean) => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  isMobile, editor, untranslatedCount, polishing,
  handlePolishArabic, setShowInconsistencies, setShowSmartImprove,
}) => {
  if (isMobile) {
    return (
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
            <DropdownMenuItem onClick={editor.handleFixAllStuckCharacters} disabled={editor.needsImproveCount.stuck === 0}>🔤 إصلاح الأحرف الملتصقة</DropdownMenuItem>
            <DropdownMenuItem onClick={editor.handleFixMixedLanguage} disabled={editor.fixingMixed || editor.needsImproveCount.mixed === 0}>
              {editor.fixingMixed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />} إصلاح النصوص المختلطة 🌐
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">🆕 أدوات متقدمة</DropdownMenuLabel>
            <DropdownMenuItem onClick={handlePolishArabic} disabled={polishing || editor.translatedCount === 0}>
              {polishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} تحسين الصياغة العربية ✍️
            </DropdownMenuItem>
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

  return (
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
      <Button variant="outline" onClick={editor.handleReviewTranslations} disabled={editor.reviewing || editor.translatedCount === 0} className="font-body border-primary/30 text-primary hover:text-primary">
        {editor.reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} مراجعة ذكية 🔍
      </Button>
      <Button variant="outline" onClick={editor.handleImproveTranslations} disabled={editor.improvingTranslations || editor.translatedCount === 0} className="font-body border-secondary/30 text-secondary hover:text-secondary">
        {editor.improvingTranslations ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} تحسين الترجمات ✨
      </Button>
      <Button variant="outline" onClick={editor.handleFixMixedLanguage} disabled={editor.fixingMixed || editor.needsImproveCount.mixed === 0} className="font-body border-primary/30 text-primary hover:text-primary">
        {editor.fixingMixed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />} إصلاح النصوص المختلطة 🌐
      </Button>
      <Button variant="outline" onClick={handlePolishArabic} disabled={polishing || editor.translatedCount === 0} className="font-body border-accent/30 text-accent hover:text-accent">
        {polishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} تحسين الصياغة العربية ✍️
      </Button>
      <Button variant="outline" onClick={() => setShowInconsistencies(true)} disabled={editor.translatedCount === 0} className="font-body border-accent/30 text-accent hover:text-accent">
        <Search className="w-4 h-4" /> كشف التناقضات 🔍
      </Button>
      <Button variant="outline" onClick={() => setShowSmartImprove(true)} disabled={editor.translatedCount === 0} className="font-body border-primary/30">
        <Layers className="w-4 h-4" /> تحسين جماعي ذكي 🧠
      </Button>
    </div>
  );
};

export default React.memo(EditorToolbar);
