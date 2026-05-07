import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Sparkles, Loader2, Tag, BookOpen, Wrench, Copy, Eye, Check, X, Gamepad2 } from "lucide-react";
import AutocompleteInput from "./AutocompleteInput";
import { ExtractedEntry, displayOriginal, hasArabicChars, isTechnicalText, hasTechnicalTags, previewTagRestore } from "./types";
import { utf8ByteLength } from "@/lib/byte-utils";
import { calcConfidence, confidenceColor, confidenceLabel } from "@/lib/confidence-score";
import { backTranslate, textSimilarity } from "@/lib/back-translate";
import { toast } from "@/hooks/use-toast";
import ZeldaDialoguePreview from "@/components/ZeldaDialoguePreview";
import TranslatorNote from "./TranslatorNote";

interface EntryCardProps {
  entry: ExtractedEntry;
  translation: string;
  isProtected: boolean;
  hasProblem: boolean;
  isDamagedTag?: boolean;
  isMobile: boolean;
  translatingSingle: string | null;
  improvingTranslations: boolean;
  previousTranslations: Record<string, string>;
  glossary?: string;
  adjacentContext?: { prev?: string; next?: string };
  isTranslationTooShort: (entry: ExtractedEntry, translation: string) => boolean;
  isTranslationTooLong: (entry: ExtractedEntry, translation: string) => boolean;
  hasStuckChars: (translation: string) => boolean;
  isMixedLanguage: (translation: string) => boolean;
  updateTranslation: (key: string, value: string) => void;
  handleTranslateSingle: (entry: ExtractedEntry) => void;
  handleImproveSingleTranslation: (entry: ExtractedEntry) => void;
  handleUndoTranslation: (key: string) => void;
  handleFixReversed: (entry: ExtractedEntry) => void;
  handleLocalFixDamagedTag?: (entry: ExtractedEntry) => void;
  translationMemory?: { key: string; translation: string }[];
  translatorNotes?: Record<string, string>;
  onUpdateNote?: (key: string, note: string) => void;
  /** Extra context-tool buttons (scene, TM, screenshots, AI hints, engine compare) rendered next to the auto-translate button */
  extraToolButtons?: { onClick: () => void; icon: string; title: string; cls?: string }[];
  /** Show original and translation side by side */
  sideBySide?: boolean;
}

// Cached parsed glossary to avoid re-parsing on every entry
let _cachedGlossaryText = '';
let _cachedGlossaryEntries: { eng: string; engLower: string; arb: string; regex: RegExp }[] = [];

function getParsedGlossary(glossary: string) {
  if (glossary === _cachedGlossaryText) return _cachedGlossaryEntries;
  _cachedGlossaryText = glossary;
  const entries: typeof _cachedGlossaryEntries = [];
  for (const line of glossary.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) continue;
    const eng = trimmed.slice(0, eqIdx).trim();
    const arb = trimmed.slice(eqIdx + 1).trim();
    if (!eng || !arb) continue;
    const engLower = eng.toLowerCase();
    const escaped = engLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use word boundary for Latin, lookaround for mixed content
    const regex = new RegExp(`(?:^|\\b|\\s)${escaped}(?:$|\\b|\\s|[.,!?;:'"\\-])`, 'i');
    entries.push({ eng, engLower, arb, regex });
  }
  // Sort by term length descending so longer matches take priority
  entries.sort((a, b) => b.eng.length - a.eng.length);
  _cachedGlossaryEntries = entries;
  return entries;
}

function findGlossaryMatches(original: string, glossary?: string): { term: string; translation: string }[] {
  if (!glossary?.trim() || !original?.trim()) return [];
  const parsed = getParsedGlossary(glossary);
  const origLower = original.toLowerCase();
  const matches: { term: string; translation: string }[] = [];
  const matchedSpans: [number, number][] = []; // prevent overlapping matches

  for (const entry of parsed) {
    if (matches.length >= 10) break;
    // Quick check before regex
    if (!origLower.includes(entry.engLower)) continue;
    if (entry.regex.test(original)) {
      // Check for overlap with already matched longer terms
      const startIdx = origLower.indexOf(entry.engLower);
      const endIdx = startIdx + entry.engLower.length;
      const overlaps = matchedSpans.some(([s, e]) => startIdx >= s && startIdx < e || endIdx > s && endIdx <= e);
      if (!overlaps) {
        matches.push({ term: entry.eng, translation: entry.arb });
        matchedSpans.push([startIdx, endIdx]);
      }
    }
  }
  return matches;
}

const EntryCard: React.FC<EntryCardProps> = ({
  entry, translation, isProtected, hasProblem, isDamagedTag, isMobile,
  translatingSingle, improvingTranslations, previousTranslations, glossary,
  adjacentContext,
  isTranslationTooShort, isTranslationTooLong, hasStuckChars, isMixedLanguage,
  updateTranslation, handleTranslateSingle, handleImproveSingleTranslation,
  handleUndoTranslation, handleFixReversed, handleLocalFixDamagedTag,
  translationMemory, translatorNotes, onUpdateNote, extraToolButtons, sideBySide,
}) => {
  const key = `${entry.msbtFile}:${entry.index}`;
  const isTech = isTechnicalText(entry.original);
  const [showTagPreview, setShowTagPreview] = useState(false);
  const [showGamePreview, setShowGamePreview] = useState(false);
  const [backTransResult, setBackTransResult] = useState<{ text: string; similarity: number } | null>(null);
  const [backTransLoading, setBackTransLoading] = useState(false);

  const handleBackTranslate = async () => {
    if (!translation?.trim()) return;
    setBackTransLoading(true);
    try {
      const result = await backTranslate(translation);
      const sim = textSimilarity(entry.original, result);
      setBackTransResult({ text: result, similarity: sim });
    } catch {
      toast({ title: "خطأ في الترجمة العكسية", variant: "destructive" });
    } finally {
      setBackTransLoading(false);
    }
  };
  const tagPreview = useMemo(() => {
    if (!isDamagedTag || !translation?.trim()) return null;
    return previewTagRestore(entry.original, translation);
  }, [isDamagedTag, entry.original, translation]);

  const handleCopyTags = () => {
    const charRegex = /[\uFFF9-\uFFFC\uE000-\uF8FF]/g;
    const tags = entry.original.match(charRegex);
    if (tags) {
      navigator.clipboard.writeText(tags.join('')).then(() => {
        toast({ title: "📋 تم النسخ", description: `تم نسخ ${tags.length} رمز تقني — الصقها في الترجمة يدوياً` });
      });
    }
  };

  const glossaryMatches = useMemo(
    () => findGlossaryMatches(entry.original, glossary),
    [entry.original, glossary]
  );

  // Real-time consistency check: warn when glossary terms are in the original but their translations are missing from the translation
  const glossaryWarnings = useMemo(() => {
    if (!translation?.trim() || glossaryMatches.length === 0) return [];
    return glossaryMatches.filter(m => !translation.includes(m.translation));
  }, [translation, glossaryMatches]);

  const confidence = useMemo(() => {
    if (!translation?.trim()) return 0;
    return calcConfidence({
      original: entry.original,
      translation,
      maxBytes: entry.maxBytes,
      glossaryMatches,
      hasTMMatch: (translationMemory?.length ?? 0) > 0,
    });
  }, [entry.original, entry.maxBytes, translation, glossaryMatches, translationMemory]);

  const useSideBySide = sideBySide && !isMobile;

  return (
    <Card className={`p-3 md:p-4 border-border/50 hover:border-border transition-colors ${hasProblem ? 'border-destructive/30 bg-destructive/5' : ''}`}>
      <p className="text-xs text-muted-foreground mb-1 truncate">{entry.msbtFile} • {entry.label}</p>
      <div className={`flex ${useSideBySide ? 'flex-row' : 'flex-col'} gap-3 md:gap-4`}>
        {/* Original text panel */}
        <div className={`min-w-0 ${useSideBySide ? 'flex-1 p-2.5 rounded-lg bg-muted/30 border border-border/30' : 'flex-1'}`}>
          {useSideBySide && <p className="text-[10px] text-muted-foreground font-bold mb-1">EN</p>}
          {adjacentContext?.prev && (
            <p className="text-[10px] text-muted-foreground/50 mb-0.5 truncate italic" dir="ltr" title="النص السابق">
              ↑ {adjacentContext.prev}
            </p>
          )}
          <p className="font-body text-sm mb-2 break-words" dir="auto">{displayOriginal(entry.original)}</p>
          {adjacentContext?.next && (
            <p className="text-[10px] text-muted-foreground/50 mb-1 truncate italic" dir="ltr" title="النص التالي">
              ↓ {adjacentContext.next}
            </p>
          )}
        </div>
        {/* Translation panel */}
        <div className={`min-w-0 ${useSideBySide ? 'flex-1' : 'flex-1'}`}>
          {useSideBySide && <p className="text-[10px] text-primary font-bold mb-1">AR</p>}
          {hasTechnicalTags(entry.original) && (
            <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
              💡 الرموز الملونة (⚙ تحكم • 🎨 تنسيق • 📌 متغير) أكواد خاصة بمحرك اللعبة — <span className="font-semibold text-accent">لا تحذفها من الترجمة</span>
            </p>
          )}
          {isTech && <p className="text-xs text-accent mb-2">⚠️ نص تقني - تحتاج حذر في الترجمة</p>}
          {hasProblem && (
            <p className="text-xs text-destructive mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> يحتاج مراجعة
            </p>
          )}
          {/* Glossary hints */}
          {glossaryMatches.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mb-2">
              <BookOpen className="w-3 h-3 text-primary/60 shrink-0" />
              {glossaryMatches.map((m, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  {m.term} → {m.translation}
                </span>
              ))}
            </div>
          )}
          {glossaryWarnings.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mb-2">
              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="text-[10px] text-amber-600">مصطلحات المسرد غير مستخدمة:</span>
              {glossaryWarnings.map((w, i) => (
                <button key={i} onClick={() => { const cur = translation.trim(); updateTranslation(key, cur ? `${cur} ${w.translation}` : w.translation); }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20 cursor-pointer" title={`اضغط لإضافة: ${w.translation}`}>
                  {w.term} → {w.translation}
                </button>
              ))}
            </div>
          )}
          {translation?.trim() && (
            <div className="flex flex-wrap gap-1 mb-2">
              {isTranslationTooShort(entry, translation) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">📏 قصيرة جداً</span>
              )}
              {isTranslationTooLong(entry, translation) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">📐 تتجاوز الحد</span>
              )}
              {hasStuckChars(translation) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/20">🔤 أحرف ملتصقة</span>
              )}
              {isMixedLanguage(translation) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">🌐 عربي + إنجليزي</span>
              )}
              {isDamagedTag && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">⚠️ رموز تالفة</span>
              )}
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${confidenceColor(confidence)}`} title={`درجة ثقة الترجمة: ${confidence}%`}>
                {confidence}% {confidenceLabel(confidence)}
              </span>
              <button onClick={handleBackTranslate} disabled={backTransLoading} className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/20 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 disabled:opacity-50" title="ترجمة عكسية للتحقق">
                {backTransLoading ? '...' : '🔄 تحقق'}
              </button>
            </div>
          )}
          {backTransResult && (
            <div className="flex items-start gap-2 mb-2 p-2 rounded bg-muted/30 border border-border/50">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground mb-0.5">الترجمة العكسية:</p>
                <p className="text-xs font-body" dir="ltr">{backTransResult.text}</p>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${backTransResult.similarity >= 60 ? 'text-green-600 bg-green-500/10 border-green-500/20' : 'text-red-500 bg-red-500/10 border-red-500/20'}`}>
                {backTransResult.similarity}% تطابق
              </span>
              <button onClick={() => setBackTransResult(null)} className="text-muted-foreground hover:text-foreground shrink-0"><X className="w-3 h-3" /></button>
            </div>
          )}
          {hasArabicChars(entry.original) && (!translation || translation === entry.original) && (
            <Button variant="ghost" size="sm" onClick={() => handleFixReversed(entry)} className="text-xs text-accent mb-2 h-7 px-2">
              <RotateCcw className="w-3 h-3" /> تصحيح المعكوس
            </Button>
          )}
          <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-2`}>
            <AutocompleteInput
              value={translation}
              onChange={(val) => updateTranslation(key, val)}
              placeholder="أدخل الترجمة..."
              className="flex-1 w-full px-3 py-2 rounded bg-background border border-border font-body text-sm"
              glossaryMatches={glossaryMatches}
              translationMemory={translationMemory}
            />
            <div className="flex items-center gap-1 shrink-0 flex-wrap">
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowGamePreview(true)} title="معاينة كما ستظهر في اللعبة">
                <Gamepad2 className="w-4 h-4 text-secondary" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => handleTranslateSingle(entry)} disabled={translatingSingle === key} title="ترجمة هذا النص">
                {translatingSingle === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => handleImproveSingleTranslation(entry)} disabled={improvingTranslations || !translation?.trim()} title="تحسين هذه الترجمة">
                {improvingTranslations ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-secondary" />}
              </Button>
              {/* Context tool buttons (moved from above the original text) */}
              {extraToolButtons && extraToolButtons.length > 0 && (
                <>
                  <span className="w-px h-5 bg-border/50 mx-0.5" aria-hidden />
                  {extraToolButtons.map((btn, i) => (
                    <button
                      key={i}
                      onClick={btn.onClick}
                      title={btn.title}
                      className={`h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md text-xs transition-colors ${btn.cls || 'bg-muted/40 text-muted-foreground hover:bg-muted'}`}
                    >
                      {btn.icon}
                    </button>
                  ))}
                </>
              )}
              {isDamagedTag && handleLocalFixDamagedTag && (
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowTagPreview(prev => !prev)} title="👁 معاينة الإصلاح قبل التطبيق">
                  <Eye className="w-4 h-4 text-accent" />
                </Button>
              )}
              {isDamagedTag && handleLocalFixDamagedTag && (
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => handleLocalFixDamagedTag(entry)} title="🔧 إصلاح الرموز محلياً (بدون AI)">
                  <Wrench className="w-4 h-4 text-destructive" />
                </Button>
              )}
              {isDamagedTag && (
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handleCopyTags} title="📋 نسخ الرموز التقنية من الأصل">
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
              {isDamagedTag && (
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => handleTranslateSingle(entry)} disabled={translatingSingle === key} title="🤖 إعادة ترجمة بالـ AI">
                  {translatingSingle === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-destructive" />}
                </Button>
              )}
              {previousTranslations[key] !== undefined && (
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => handleUndoTranslation(key)} title="تراجع عن التعديل">
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>
          {/* Tag restore preview */}
          {showTagPreview && tagPreview?.hasDiff && (
            <div className="mt-2 p-2 rounded border border-accent/30 bg-accent/5 text-xs space-y-1.5">
              <p className="font-semibold text-accent">👁 معاينة الإصلاح:</p>
              <div className="space-y-1">
                <div className="flex gap-2 items-start">
                  <span className="text-destructive shrink-0">قبل:</span>
                  <span dir="rtl" className="break-words">{displayOriginal(tagPreview.before)}</span>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="text-primary shrink-0">بعد:</span>
                  <span dir="rtl" className="break-words">{displayOriginal(tagPreview.after)}</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="default" className="h-6 text-[10px] px-2" onClick={() => { handleLocalFixDamagedTag?.(entry); setShowTagPreview(false); }}>
                  <Check className="w-3 h-3 ml-1" /> تطبيق
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setShowTagPreview(false)}>
                  <X className="w-3 h-3 ml-1" /> إغلاق
                </Button>
              </div>
            </div>
          )}
          {/* Byte usage progress bar */}
          {entry.maxBytes > 0 && translation && (() => {
            const byteUsed = utf8ByteLength(translation);
            const ratio = byteUsed / entry.maxBytes;
            const percent = Math.min(ratio * 100, 100);
            const colorClass = ratio > 1 ? 'bg-destructive' : ratio > 0.85 ? 'bg-amber-500' : 'bg-primary';
            const warningLabel = ratio > 1 ? '⛔ تجاوز الحد!' : ratio > 0.85 ? '⚠️ اقتربت من الحد' : null;
            return (
              <div className="mt-1.5">
                <div className="flex justify-between items-center text-[10px] text-muted-foreground mb-0.5">
                  <span>{byteUsed}/{entry.maxBytes} بايت (UTF-8)</span>
                  <div className="flex items-center gap-1.5">
                    {warningLabel && <span className={`font-bold ${ratio > 1 ? 'text-destructive' : 'text-amber-600'}`}>{warningLabel}</span>}
                    <span className={ratio > 1 ? 'text-destructive font-bold' : ''}>{Math.round(ratio * 100)}%</span>
                  </div>
                </div>
                <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${colorClass} rounded-full transition-all`} style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })()}
          {/* Translator Note */}
          {translatorNotes && onUpdateNote && (
            <TranslatorNote entryKey={key} notes={translatorNotes} onUpdateNote={onUpdateNote} />
          )}
        </div>
        {!isMobile && (
          <div className="flex flex-col gap-1 items-center">
            {isProtected && <Tag className="w-5 h-5 text-accent" />}
          </div>
        )}
      </div>
      {showGamePreview && (
        <ZeldaDialoguePreview
          original={entry.original}
          translation={translation || ''}
          label={entry.label}
          onClose={() => setShowGamePreview(false)}
        />
      )}
    </Card>
  );
};

// C5 fix: memoize so editing one entry doesn't re-render all 50 cards on the page.
export default React.memo(EntryCard);
