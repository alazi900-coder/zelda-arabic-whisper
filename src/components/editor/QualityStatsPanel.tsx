import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Filter, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { InconsistentTerm } from "@/hooks/useEditorQuality";

interface QualityStatsPanelProps {
  qualityStats: {
    tooLong: number; nearLimit: number; missingTags: number; placeholderMismatch: number;
    total: number; problemKeys: Set<string>;
    duplicateTranslations: number; duplicateTranslationKeys: Set<string>;
    punctuationMismatch: number; punctuationMismatchKeys: Set<string>;
    unclosedBrackets: number; unclosedBracketKeys: Set<string>;
    inconsistentTerms: InconsistentTerm[];
  };
  translatedCount: number;
  setFilterStatus: (status: Set<string>) => void;
  setShowQualityStats: (show: boolean) => void;
  onExportReport: () => void;
  onFixAllPunctuation?: () => void;
}

const QualityStatsPanel: React.FC<QualityStatsPanelProps> = ({ qualityStats, translatedCount, setFilterStatus, setShowQualityStats, onExportReport }) => {
  const [showTerms, setShowTerms] = React.useState(false);

  return (
    <Card className="mb-6 border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            إحصائيات الجودة
          </h3>
          <Button variant="outline" size="sm" onClick={onExportReport} className="text-xs font-body">
            <Download className="w-3 h-3" /> تصدير تقرير
          </Button>
        </div>

        {/* Original stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded border border-destructive/30 bg-destructive/5 text-center">
            <p className="text-2xl font-display font-bold text-destructive">{qualityStats.tooLong}</p>
            <p className="text-xs text-muted-foreground">تجاوز حد البايت</p>
          </div>
          <div className="p-3 rounded border border-amber-500/30 bg-amber-500/5 text-center">
            <p className="text-2xl font-display font-bold text-amber-500">{qualityStats.nearLimit}</p>
            <p className="text-xs text-muted-foreground">قريب من الحد (&gt;80%)</p>
          </div>
          <div className="p-3 rounded border border-destructive/30 bg-destructive/5 text-center">
            <p className="text-2xl font-display font-bold text-destructive">{qualityStats.missingTags}</p>
            <p className="text-xs text-muted-foreground">Tags مفقودة</p>
          </div>
          <div className="p-3 rounded border border-destructive/30 bg-destructive/5 text-center">
            <p className="text-2xl font-display font-bold text-destructive">{qualityStats.placeholderMismatch}</p>
            <p className="text-xs text-muted-foreground">عناصر نائبة مختلفة</p>
          </div>
        </div>

        {/* New stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <div className="p-3 rounded border border-orange-500/30 bg-orange-500/5 text-center cursor-pointer hover:bg-orange-500/10 transition-colors" onClick={() => { if (qualityStats.duplicateTranslations > 0) { setFilterStatus(new Set(["duplicates"])); setShowQualityStats(false); }}}>
            <p className="text-2xl font-display font-bold text-orange-500">{qualityStats.duplicateTranslations}</p>
            <p className="text-xs text-muted-foreground">ترجمات مكررة</p>
          </div>
          <div className="p-3 rounded border border-violet-500/30 bg-violet-500/5 text-center cursor-pointer hover:bg-violet-500/10 transition-colors" onClick={() => { if (qualityStats.punctuationMismatch > 0) { setFilterStatus(new Set(["punctuation"])); setShowQualityStats(false); }}}>
            <p className="text-2xl font-display font-bold text-violet-500">{qualityStats.punctuationMismatch}</p>
            <p className="text-xs text-muted-foreground">ترقيم مفقود</p>
          </div>
          <div className="p-3 rounded border border-rose-500/30 bg-rose-500/5 text-center cursor-pointer hover:bg-rose-500/10 transition-colors" onClick={() => { if (qualityStats.unclosedBrackets > 0) { setFilterStatus(new Set(["unclosed-brackets"])); setShowQualityStats(false); }}}>
            <p className="text-2xl font-display font-bold text-rose-500">{qualityStats.unclosedBrackets}</p>
            <p className="text-xs text-muted-foreground">أقواس مكسورة</p>
          </div>
          <div className="p-3 rounded border border-cyan-500/30 bg-cyan-500/5 text-center cursor-pointer hover:bg-cyan-500/10 transition-colors" onClick={() => setShowTerms(!showTerms)}>
            <p className="text-2xl font-display font-bold text-cyan-500">{qualityStats.inconsistentTerms.length}</p>
            <p className="text-xs text-muted-foreground">مصطلحات غير متسقة</p>
          </div>
        </div>

        {/* Inconsistent terms collapsible */}
        {showTerms && qualityStats.inconsistentTerms.length > 0 && (
          <div className="mt-3 p-3 rounded border border-cyan-500/20 bg-cyan-500/5 max-h-60 overflow-y-auto">
            <h4 className="text-sm font-display font-bold mb-2 text-cyan-600">🔍 مصطلحات غير متسقة</h4>
            <div className="space-y-2">
              {qualityStats.inconsistentTerms.slice(0, 20).map((term, i) => (
                <div key={i} className="text-xs font-body">
                  <span className="font-bold text-foreground" dir="ltr">"{term.englishTerm}"</span>
                  <span className="text-muted-foreground"> — {term.translations.length} ترجمات مختلفة:</span>
                  <div className="mr-4 mt-1 space-y-0.5">
                    {term.translations.slice(0, 5).map((t, j) => (
                      <div key={j} className="text-muted-foreground">
                        • <span className="text-foreground/80">"{t.arabic.slice(0, 50)}{t.arabic.length > 50 ? '...' : ''}"</span>
                        <span className="text-muted-foreground/60"> ({t.keys.length}×)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {qualityStats.inconsistentTerms.length > 20 && (
                <p className="text-xs text-muted-foreground/60">... و{qualityStats.inconsistentTerms.length - 20} أخرى</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Progress value={qualityStats.total > 0 ? Math.max(0, 100 - (qualityStats.total / Math.max(translatedCount, 1)) * 100) : 100} className="h-2 flex-1" />
          <span className="text-xs font-display text-muted-foreground">
            {qualityStats.total > 0 ? `${qualityStats.total} نص بمشاكل` : '✅ لا مشاكل'}
          </span>
        </div>
        {qualityStats.total > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setFilterStatus(new Set(["problems"])); setShowQualityStats(false); }}
            className="mt-3 text-xs"
          >
            <Filter className="w-3 h-3" /> عرض النصوص بها مشاكل فقط
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default QualityStatsPanel;
