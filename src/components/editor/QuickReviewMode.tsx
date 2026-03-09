import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Eye, AlertTriangle, ChevronRight, ChevronLeft, Check, X, BookOpen, Sparkles, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import DebouncedInput from "./DebouncedInput";
import { ExtractedEntry, displayOriginal } from "./types";
import { classifyDifficulty, DIFFICULTY_CONFIG } from "@/hooks/useDifficultyClassifier";
import { utf8ByteLength } from "@/lib/byte-utils";

interface QuickReviewModeProps {
  filteredEntries: ExtractedEntry[];
  quickReviewIndex: number;
  setQuickReviewIndex: (idx: number) => void;
  setQuickReviewMode: (mode: boolean) => void;
  translations: Record<string, string>;
  qualityProblemKeys: Set<string>;
  updateTranslation: (key: string, value: string) => void;
  entries?: ExtractedEntry[];
  glossary?: string;
}

// Find glossary hints for an entry
function findGlossaryHints(original: string, glossary?: string): { term: string; translation: string }[] {
  if (!glossary?.trim() || !original?.trim()) return [];
  const hints: { term: string; translation: string }[] = [];
  const origLower = original.toLowerCase();
  for (const line of glossary.split('\n')) {
    if (hints.length >= 5) break;
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('//')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const eng = t.slice(0, eq).trim();
    const arb = t.slice(eq + 1).trim();
    if (eng && arb && origLower.includes(eng.toLowerCase())) {
      hints.push({ term: eng, translation: arb });
    }
  }
  return hints;
}

const QuickReviewMode: React.FC<QuickReviewModeProps> = ({
  filteredEntries, quickReviewIndex, setQuickReviewIndex, setQuickReviewMode,
  translations, qualityProblemKeys, updateTranslation, entries, glossary,
}) => {
  const entry = filteredEntries[quickReviewIndex] ?? null;
  const key = entry ? `${entry.msbtFile}:${entry.index}` : '';
  const translation = entry ? (translations[key] || '') : '';
  const hasProblem = entry ? qualityProblemKeys.has(key) : false;
  const byteUsed = entry && entry.maxBytes > 0 ? utf8ByteLength(translation) : 0;
  const difficulty = entry ? classifyDifficulty(entry) : { level: 'simple' as const, score: 0, reasons: [], estimatedMinutes: 0 };
  const diffConf = DIFFICULTY_CONFIG[difficulty.level];
  const glossaryHints = useMemo(() => entry ? findGlossaryHints(entry.original, glossary) : [], [entry?.original, glossary]);

  // Adjacent entries for context
  const adjacentContext = useMemo(() => {
    if (!entry) return { prev: null, next: null };
    const allEntries = entries || filteredEntries;
    const sameFile = allEntries.filter(e => e.msbtFile === entry.msbtFile).sort((a, b) => a.index - b.index);
    const idx = sameFile.findIndex(e => e.index === entry.index);
    if (idx === -1) return { prev: null, next: null };
    const prev = idx > 0 ? sameFile[idx - 1] : null;
    const next = idx < sameFile.length - 1 ? sameFile[idx + 1] : null;
    return { prev, next };
  }, [entry, entries, filteredEntries]);

  // Stats for progress
  const reviewedCount = useMemo(() => filteredEntries.filter((e, i) => {
    const k = `${e.msbtFile}:${e.index}`;
    return translations[k]?.trim() && i <= quickReviewIndex;
  }).length, [filteredEntries, translations, quickReviewIndex]);

  if (!entry || filteredEntries.length === 0) return null;

  return (
    <Card className="mb-6 border-primary/30 shadow-md">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            المراجعة السريعة
            <Badge variant="outline" className={`text-[10px] ${diffConf.bgColor} ${diffConf.color}`}>
              {diffConf.emoji} {diffConf.label}
            </Badge>
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-display">
              {quickReviewIndex + 1} / {filteredEntries.length}
            </span>
            <span className="text-[10px] text-muted-foreground">
              ({reviewedCount} مُراجع)
            </span>
          </div>
        </div>
        <Progress value={((quickReviewIndex + 1) / filteredEntries.length) * 100} className="h-1.5 mb-4" />

        {/* Context: Previous entry */}
        {adjacentContext.prev && (
          <div className="rounded border border-border/30 bg-muted/20 p-2 mb-2 text-[11px]">
            <span className="text-muted-foreground">⬆ السابق:</span>
            <span className="text-foreground/60 mr-1" dir="ltr">{adjacentContext.prev.original.slice(0, 80)}{adjacentContext.prev.original.length > 80 ? '...' : ''}</span>
            {translations[`${adjacentContext.prev.msbtFile}:${adjacentContext.prev.index}`] && (
              <span className="text-primary/60 block mr-4" dir="rtl">
                {translations[`${adjacentContext.prev.msbtFile}:${adjacentContext.prev.index}`].slice(0, 80)}
              </span>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground mb-2">{entry.msbtFile} • {entry.label}</p>
        <div className="p-3 rounded border border-border/50 bg-muted/30 mb-3">
          <p className="text-xs text-muted-foreground mb-1">النص الأصلي:</p>
          <p className="font-body text-sm">{displayOriginal(entry.original)}</p>
        </div>

        {/* Context: Next entry */}
        {adjacentContext.next && (
          <div className="rounded border border-border/30 bg-muted/20 p-2 mb-2 text-[11px]">
            <span className="text-muted-foreground">⬇ التالي:</span>
            <span className="text-foreground/60 mr-1" dir="ltr">{adjacentContext.next.original.slice(0, 80)}{adjacentContext.next.original.length > 80 ? '...' : ''}</span>
          </div>
        )}

        {/* Glossary hints */}
        {glossaryHints.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mb-2">
            <BookOpen className="w-3 h-3 text-primary/60 shrink-0" />
            {glossaryHints.map((h, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {h.term} → {h.translation}
              </span>
            ))}
          </div>
        )}

        {/* Difficulty reasons */}
        {difficulty.reasons.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {difficulty.reasons.map((r, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {r}
              </span>
            ))}
          </div>
        )}

        {hasProblem && (
          <p className="text-xs text-destructive mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> هذا النص به مشكلة
            {entry.maxBytes > 0 && byteUsed > entry.maxBytes && ` (${byteUsed}/${entry.maxBytes} بايت)`}
          </p>
        )}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-1">الترجمة:</p>
          <DebouncedInput
            value={translation}
            onChange={(val) => updateTranslation(key, val)}
            placeholder="أدخل الترجمة..."
            className="w-full px-3 py-2 rounded bg-background border border-border font-body text-sm"
            autoFocus
          />
          {entry.maxBytes > 0 && (
            <div className="flex justify-between items-center mt-1">
              <p className={`text-xs ${byteUsed > entry.maxBytes ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                {byteUsed}/{entry.maxBytes} بايت (UTF-8)
              </p>
              <p className={`text-xs ${byteUsed > entry.maxBytes ? 'text-destructive' : byteUsed / entry.maxBytes > 0.85 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {Math.round((byteUsed / entry.maxBytes) * 100)}%
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setQuickReviewIndex(Math.max(0, quickReviewIndex - 1))} disabled={quickReviewIndex === 0}>
            <ChevronRight className="w-4 h-4" /> السابق
          </Button>
          <Button variant="default" size="sm" onClick={() => setQuickReviewIndex(Math.min(filteredEntries.length - 1, quickReviewIndex + 1))} disabled={quickReviewIndex >= filteredEntries.length - 1} className="flex-1">
            <Check className="w-4 h-4" /> قبول والتالي
          </Button>
          <Button variant="destructive" size="sm" onClick={() => { updateTranslation(key, ''); setQuickReviewIndex(Math.min(filteredEntries.length - 1, quickReviewIndex + 1)); }} disabled={quickReviewIndex >= filteredEntries.length - 1 && !translation}>
            <X className="w-4 h-4" /> رفض
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setQuickReviewMode(false)}>إغلاق</Button>
        </div>
        {/* Keyboard hint */}
        <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
          ← → للتنقل بين الصفحات • Ctrl+Q لإغلاق المراجعة
        </p>
      </CardContent>
    </Card>
  );
};

export default QuickReviewMode;
