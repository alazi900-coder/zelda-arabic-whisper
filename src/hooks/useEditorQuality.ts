import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { utf8ByteLength } from "@/lib/byte-utils";
import { ARABIC_REGEX, hasArabicPresentationForms } from "@/lib/arabic-processing";
import { ExtractedEntry, EditorState, categorizeFile, hasTechnicalTags } from "@/components/editor/types";

export interface QualityStats {
  tooLong: number;
  nearLimit: number;
  missingTags: number;
  placeholderMismatch: number;
  total: number;
  problemKeys: Set<string>;
  damagedTags: number;
  damagedTagKeys: Set<string>;
  // New quality checks
  duplicateTranslations: number;
  duplicateTranslationKeys: Set<string>;
  punctuationMismatch: number;
  punctuationMismatchKeys: Set<string>;
  unclosedBrackets: number;
  unclosedBracketKeys: Set<string>;
  inconsistentTerms: InconsistentTerm[];
  // Text cleanup checks
  hasDiacritics: number;
  hasDiacriticsKeys: Set<string>;
  hasDoubleSpaces: number;
  hasDoubleSpacesKeys: Set<string>;
  hasHamzaIssues: number;
  hasHamzaIssuesKeys: Set<string>;
}

export interface InconsistentTerm {
  englishTerm: string;
  translations: { arabic: string; keys: string[] }[];
}

export interface NeedsImproveCount {
  total: number;
  tooShort: number;
  tooLong: number;
  stuck: number;
  mixed: number;
}

interface UseEditorQualityProps {
  state: EditorState | null;
}

export function useEditorQuality({ state }: UseEditorQualityProps) {
  const [categoryProgress, setCategoryProgress] = useState<Record<string, { total: number; translated: number }>>({});
  const [qualityStats, setQualityStats] = useState<QualityStats>({ tooLong: 0, nearLimit: 0, missingTags: 0, placeholderMismatch: 0, total: 0, problemKeys: new Set<string>(), damagedTags: 0, damagedTagKeys: new Set<string>(), duplicateTranslations: 0, duplicateTranslationKeys: new Set<string>(), punctuationMismatch: 0, punctuationMismatchKeys: new Set<string>(), unclosedBrackets: 0, unclosedBracketKeys: new Set<string>(), inconsistentTerms: [], hasDiacritics: 0, hasDiacriticsKeys: new Set<string>(), hasDoubleSpaces: 0, hasDoubleSpacesKeys: new Set<string>(), hasHamzaIssues: 0, hasHamzaIssuesKeys: new Set<string>() });
  const [needsImproveCount, setNeedsImproveCount] = useState<NeedsImproveCount>({ total: 0, tooShort: 0, tooLong: 0, stuck: 0, mixed: 0 });
  const [translatedCount, setTranslatedCount] = useState(0);
  const combinedStatsTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // === Quality helper functions ===
  const isTranslationTooShort = useCallback((entry: ExtractedEntry, translation: string): boolean => {
    if (!translation?.trim() || !entry.original?.trim()) return false;
    return translation.trim().length < entry.original.trim().length * 0.3 && entry.original.trim().length > 5;
  }, []);

  const isTranslationTooLong = useCallback((entry: ExtractedEntry, translation: string): boolean => {
    if (!translation?.trim() || entry.maxBytes <= 0) return false;
    return utf8ByteLength(translation) > entry.maxBytes;
  }, []);

  const hasStuckChars = useCallback((translation: string): boolean => {
    if (!translation?.trim()) return false;
    return hasArabicPresentationForms(translation);
  }, []);

  const isMixedLanguage = useCallback((translation: string): boolean => {
    if (!translation?.trim()) return false;
    const stripped = translation.replace(/\[[^\]]*\]/g, '').replace(/\uFFFC/g, '').trim();
    if (!stripped) return false;
    const hasArabic = ARABIC_REGEX.test(stripped);
    const englishWords = stripped.match(/[a-zA-Z]{2,}/g) || [];
    const whitelist = new Set(['HP', 'MP', 'ATK', 'DEF', 'NPC', 'HUD', 'FPS', 'XP', 'DLC', 'UI', 'OK']);
    const realEnglish = englishWords.filter(w => !whitelist.has(w.toUpperCase()));
    return hasArabic && realEnglish.length > 0;
  }, []);

  const needsImprovement = useCallback((entry: ExtractedEntry, translation: string): boolean => {
    return isTranslationTooShort(entry, translation) || 
           isTranslationTooLong(entry, translation) || 
           hasStuckChars(translation) || 
           isMixedLanguage(translation);
  }, [isTranslationTooShort, isTranslationTooLong, hasStuckChars, isMixedLanguage]);

  // === Combined stats computation ===
  useEffect(() => {
    if (!state) return;
    if (combinedStatsTimerRef.current) clearTimeout(combinedStatsTimerRef.current);
    combinedStatsTimerRef.current = setTimeout(() => {
      const progress: Record<string, { total: number; translated: number }> = {};
      let qTooLong = 0, qNearLimit = 0, qMissingTags = 0, qPlaceholderMismatch = 0;
      const problemKeys = new Set<string>();
      let niTooShort = 0, niTooLong = 0, niStuck = 0, niMixed = 0;
      const needsImproveKeys = new Set<string>();
      let translated = 0;
      let damagedTags = 0;
      const damagedTagKeys = new Set<string>();

      // New checks
      let punctuationMismatch = 0;
      const punctuationMismatchKeys = new Set<string>();
      let unclosedBrackets = 0;
      const unclosedBracketKeys = new Set<string>();
      // Text cleanup checks
      let hasDiacritics = 0;
      const hasDiacriticsKeys = new Set<string>();
      let hasDoubleSpaces = 0;
      const hasDoubleSpacesKeys = new Set<string>();
      let hasHamzaIssues = 0;
      const hasHamzaIssuesKeys = new Set<string>();
      const diacriticsRegex = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/;

      // For duplicate detection: translation -> list of keys
      const translationToKeys = new Map<string, string[]>();
      // For terminology consistency: english word -> Set of arabic translations
      const termMap = new Map<string, Map<string, string[]>>();
      // Build entry lookup map for O(1) access
      const entryByKey = new Map(state.entries.map(e => [`${e.msbtFile}:${e.index}`, e]));

      for (const entry of state.entries) {
        const key = `${entry.msbtFile}:${entry.index}`;
        const translation = state.translations[key] || '';
        const trimmed = translation.trim();
        const isTranslated = trimmed !== '';
        const cat = categorizeFile(entry.msbtFile, entry.label);

        if (!progress[cat]) progress[cat] = { total: 0, translated: 0 };
        progress[cat].total++;
        if (isTranslated) { progress[cat].translated++; translated++; }
        if (!isTranslated) continue;

        if (entry.maxBytes > 0) {
          const bytes = utf8ByteLength(trimmed);
          if (bytes > entry.maxBytes) { qTooLong++; problemKeys.add(key); }
          else if (bytes / entry.maxBytes > 0.8) { qNearLimit++; problemKeys.add(key); }
        }
        const origTags = entry.original.match(/\[[^\]]*\]/g) || [];
        for (const tag of origTags) {
          if (!trimmed.includes(tag)) { qMissingTags++; problemKeys.add(key); break; }
        }
        const origPh = (entry.original.match(/\uFFFC/g) || []).length;
        const transPh = (trimmed.match(/\uFFFC/g) || []).length;
        if (origPh !== transPh) { qPlaceholderMismatch++; problemKeys.add(key); }

        // Check for damaged technical tags
        if (hasTechnicalTags(entry.original)) {
          const origControlChars = entry.original.match(/[\uFFF9-\uFFFC\uE000-\uF8FF]/g) || [];
          const transControlChars = trimmed.match(/[\uFFF9-\uFFFC\uE000-\uF8FF]/g) || [];
          if (transControlChars.length < origControlChars.length) {
            damagedTags++;
            damagedTagKeys.add(key);
            problemKeys.add(key);
          }
        }

        // === Punctuation mismatch ===
        const origEnd = entry.original.trim();
        const transEnd = trimmed;
        if (origEnd.endsWith('?') && !transEnd.endsWith('؟') && !transEnd.endsWith('?')) {
          punctuationMismatch++;
          punctuationMismatchKeys.add(key);
          problemKeys.add(key);
        } else if (origEnd.endsWith('!') && !transEnd.endsWith('!')) {
          punctuationMismatch++;
          punctuationMismatchKeys.add(key);
          problemKeys.add(key);
        }

        // === Unclosed brackets ===
        let bracketDepth = 0;
        let hasBrokenBrackets = false;
        for (const ch of trimmed) {
          if (ch === '[') bracketDepth++;
          else if (ch === ']') { bracketDepth--; if (bracketDepth < 0) { hasBrokenBrackets = true; break; } }
        }
        if (bracketDepth !== 0) hasBrokenBrackets = true;
        if (hasBrokenBrackets) {
          unclosedBrackets++;
          unclosedBracketKeys.add(key);
          problemKeys.add(key);
        }

        // === Duplicate detection (skip short translations <5 chars) ===
        if (trimmed.length >= 5) {
          const normTrans = trimmed.toLowerCase();
          if (!translationToKeys.has(normTrans)) translationToKeys.set(normTrans, []);
          translationToKeys.get(normTrans)!.push(key);
        }

        // === Terminology consistency ===
        // Extract English words from original (>= 3 chars, not tags)
        const cleanOriginal = entry.original.replace(/\[[^\]]*\]/g, '').replace(/[\uFFF9-\uFFFC\uE000-\uF8FF]/g, '');
        const engWords = cleanOriginal.match(/\b[A-Z][a-z]{2,}\b/g) || [];
        const seenWords = new Set<string>();
        for (const word of engWords) {
          const lower = word.toLowerCase();
          if (seenWords.has(lower)) continue;
          seenWords.add(lower);
          // Skip common words
          const skipWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'way', 'who', 'did', 'get', 'let', 'say', 'she', 'too', 'use']);
          if (skipWords.has(lower)) continue;
          if (!termMap.has(lower)) termMap.set(lower, new Map());
          const arabicMap = termMap.get(lower)!;
          if (!arabicMap.has(trimmed)) arabicMap.set(trimmed, []);
          arabicMap.get(trimmed)!.push(key);
        }

        if (isTranslationTooShort(entry, trimmed)) { niTooShort++; needsImproveKeys.add(key); }
        if (isTranslationTooLong(entry, trimmed)) { niTooLong++; needsImproveKeys.add(key); }
        if (hasStuckChars(trimmed)) { niStuck++; needsImproveKeys.add(key); }
        if (isMixedLanguage(trimmed)) { niMixed++; needsImproveKeys.add(key); }

        // === Text cleanup checks ===
        if (diacriticsRegex.test(trimmed)) { hasDiacritics++; hasDiacriticsKeys.add(key); }
        if (/ {2,}/.test(trimmed) || / [،؛؟!.,;?]/.test(trimmed)) { hasDoubleSpaces++; hasDoubleSpacesKeys.add(key); }
      // Hamza issues: only flag inconsistent hamza usage patterns (e.g. إنشالله instead of إن شاء الله, or common mistakes)
      // Flag only when alef-hamza appears at word boundaries inconsistently, or final ya/alef-maqsura confusion
      if (/ى(?=[\s،؛؟!.,;?\][」』】）》〉]|$)/.test(trimmed) && /ي(?=[\s،؛؟!.,;?\][」』】）》〉]|$)/.test(trimmed)) { hasHamzaIssues++; hasHamzaIssuesKeys.add(key); }
      }

      // Finalize duplicate detection
      let duplicateTranslations = 0;
      const duplicateTranslationKeys = new Set<string>();
      for (const [, keys] of translationToKeys) {
        // Check that the entries have DIFFERENT originals
        if (keys.length >= 2) {
          const originals = new Set<string>();
          for (const k of keys) {
          const entry = entryByKey.get(k);
          if (entry) originals.add(entry.original.trim());
          }
          if (originals.size > 1) {
            duplicateTranslations += keys.length;
            for (const k of keys) {
              duplicateTranslationKeys.add(k);
              problemKeys.add(k);
            }
          }
        }
      }

      // Finalize terminology consistency (only report terms with 2+ different translations)
      const inconsistentTerms: InconsistentTerm[] = [];
      for (const [term, arabicMap] of termMap) {
        if (arabicMap.size >= 2) {
          const translations: { arabic: string; keys: string[] }[] = [];
          for (const [arabic, keys] of arabicMap) {
            translations.push({ arabic, keys });
          }
          // Only report if there are actually different translations for this term
          if (translations.length >= 2) {
            inconsistentTerms.push({ englishTerm: term.charAt(0).toUpperCase() + term.slice(1), translations });
          }
        }
      }
      // Sort by number of variant translations (most inconsistent first)
      inconsistentTerms.sort((a, b) => b.translations.length - a.translations.length);

      setCategoryProgress(progress);
      setQualityStats({
        tooLong: qTooLong, nearLimit: qNearLimit, missingTags: qMissingTags,
        placeholderMismatch: qPlaceholderMismatch, total: problemKeys.size, problemKeys,
        damagedTags, damagedTagKeys,
        duplicateTranslations, duplicateTranslationKeys,
        punctuationMismatch, punctuationMismatchKeys,
        unclosedBrackets, unclosedBracketKeys,
        inconsistentTerms,
        hasDiacritics, hasDiacriticsKeys,
        hasDoubleSpaces, hasDoubleSpacesKeys,
        hasHamzaIssues, hasHamzaIssuesKeys,
      });
      setNeedsImproveCount({ total: needsImproveKeys.size, tooShort: niTooShort, tooLong: niTooLong, stuck: niStuck, mixed: niMixed });
      setTranslatedCount(translated);
    }, 800);
    return () => { if (combinedStatsTimerRef.current) clearTimeout(combinedStatsTimerRef.current); };
  }, [state?.entries, state?.translations, isTranslationTooShort, isTranslationTooLong, hasStuckChars, isMixedLanguage]);

  // === Quality report export ===
  const exportQualityReport = useCallback(() => {
    if (!state) return;
    const lines: string[] = [];
    lines.push("=== تقرير جودة الترجمة ===");
    lines.push(`التاريخ: ${new Date().toLocaleString("ar-SA")}`);
    lines.push(`إجمالي النصوص: ${state.entries.length}`);
    lines.push(`المترجمة: ${translatedCount}`);
    lines.push(`نسبة الإنجاز: ${state.entries.length > 0 ? Math.round((translatedCount / state.entries.length) * 100) : 0}%`);
    lines.push("");

    const qs = qualityStats;

    // Summary
    lines.push("--- ملخص المشاكل ---");
    lines.push(`إجمالي النصوص بمشاكل: ${qs.total}`);
    lines.push(`تجاوز حد البايت: ${qs.tooLong}`);
    lines.push(`قريب من الحد (>80%): ${qs.nearLimit}`);
    lines.push(`Tags مفقودة: ${qs.missingTags}`);
    lines.push(`عناصر نائبة مختلفة: ${qs.placeholderMismatch}`);
    lines.push(`رموز تقنية تالفة: ${qs.damagedTags}`);
    lines.push(`ترجمات مكررة: ${qs.duplicateTranslations}`);
    lines.push(`علامات ترقيم مفقودة: ${qs.punctuationMismatch}`);
    lines.push(`أقواس غير مغلقة: ${qs.unclosedBrackets}`);
    lines.push(`مصطلحات غير متسقة: ${qs.inconsistentTerms.length}`);
    lines.push("");

    // Details for each category
    const detailSection = (title: string, keys: Set<string>) => {
      if (keys.size === 0) return;
      lines.push(`\n--- ${title} (${keys.size}) ---`);
      for (const k of keys) {
      const entry = state.entries.find(e => `${e.msbtFile}:${e.index}` === k);
        if (!entry) continue;  // exportQualityReport runs rarely, O(n) find is acceptable here
        const trans = state.translations[k] || '';
        lines.push(`  [${k}] ${entry.label}`);
        lines.push(`    الأصل: ${entry.original.slice(0, 80)}${entry.original.length > 80 ? '...' : ''}`);
        lines.push(`    الترجمة: ${trans.slice(0, 80)}${trans.length > 80 ? '...' : ''}`);
      }
    };

    detailSection("تجاوز حد البايت", new Set([...qs.problemKeys].filter(k => {
      const e = state.entries.find(e => `${e.msbtFile}:${e.index}` === k);
      if (!e || e.maxBytes <= 0) return false;
      const t = state.translations[k]?.trim() || '';
      return utf8ByteLength(t) > e.maxBytes;
    })));
    detailSection("ترجمات مكررة", qs.duplicateTranslationKeys);
    detailSection("علامات ترقيم مفقودة", qs.punctuationMismatchKeys);
    detailSection("أقواس غير مغلقة", qs.unclosedBracketKeys);
    detailSection("رموز تقنية تالفة", qs.damagedTagKeys);

    // Terminology consistency
    if (qs.inconsistentTerms.length > 0) {
      lines.push(`\n--- مصطلحات غير متسقة (${qs.inconsistentTerms.length}) ---`);
      for (const term of qs.inconsistentTerms.slice(0, 50)) {
        lines.push(`  "${term.englishTerm}" — ${term.translations.length} ترجمات مختلفة:`);
        for (const t of term.translations) {
          lines.push(`    • "${t.arabic.slice(0, 60)}${t.arabic.length > 60 ? '...' : ''}" (${t.keys.length} مرات)`);
        }
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quality-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state, qualityStats, translatedCount]);

  return {
    // Stats
    categoryProgress,
    qualityStats,
    needsImproveCount,
    translatedCount,

    // Quality helpers
    isTranslationTooShort,
    isTranslationTooLong,
    hasStuckChars,
    isMixedLanguage,
    needsImprovement,
    exportQualityReport,
  };
}
