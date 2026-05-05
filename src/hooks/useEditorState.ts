import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { idbSet, idbGet, idbSetSync } from "@/lib/idb-storage";
import { ARABIC_REGEX, processArabicText, hasArabicChars as hasArabicCharsProcessing, hasArabicPresentationForms, removeArabicPresentationForms } from "@/lib/arabic-processing";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { utf8ByteLength } from "@/lib/byte-utils";
import { resolveGeminiModel } from "@/lib/gemini-router";
import { useEditorGlossary } from "@/hooks/useEditorGlossary";
import { useEditorFileIO } from "@/hooks/useEditorFileIO";
import { useEditorQuality } from "@/hooks/useEditorQuality";
import { useEditorBuild } from "@/hooks/useEditorBuild";
import { useEditorTranslation } from "@/hooks/useEditorTranslation";
import { useEditorFixes } from "@/hooks/useEditorFixes";
import { useEditorCloud } from "@/hooks/useEditorCloud";
import { useTimedMessage } from "@/hooks/useTimedMessage";
import {
  ExtractedEntry, EditorState, AUTOSAVE_DELAY, AI_BATCH_SIZE, PAGE_SIZE,
  categorizeFile, hasArabicChars, unReverseBidi, isTechnicalText, hasTechnicalTags,
  ReviewIssue, ReviewSummary, ReviewResults, ShortSuggestion, ImproveResult,
  restoreTagsLocally,
} from "@/components/editor/types";
export function useEditorState() {
  const [state, setState] = useState<EditorState | null>(null);
  const [search, setSearch] = useState("");
  const [filterFile, setFilterFile] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<Set<string>>(new Set());
  const toggleFilterStatus = useCallback((status: string) => {
    setFilterStatus(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);
  const clearFilterStatus = useCallback(() => setFilterStatus(new Set()), []);
  const [filterTechnical, setFilterTechnical] = useState<"all" | "only" | "exclude">("all");
  const [translateProgress, setTranslateProgress] = useState("");
  const [lastSaved, setLastSaved] = useState<string>("");
  const showLastSaved = useTimedMessage(setLastSaved);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState("");
  const [technicalEditingMode, setTechnicalEditingMode] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewResults, setReviewResults] = useState<ReviewResults | null>(null);
  const [suggestingShort, setSuggestingShort] = useState(false);
  const [shortSuggestions, setShortSuggestions] = useState<ShortSuggestion[] | null>(null);
  const [quickReviewMode, setQuickReviewMode] = useState(false);
  const [quickReviewIndex, setQuickReviewIndex] = useState(0);
  const [showQualityStats, setShowQualityStats] = useState(false);
  const [previousTranslations, setPreviousTranslations] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [showRetranslateConfirm, setShowRetranslateConfirm] = useState(false);
  const [arabicNumerals, setArabicNumerals] = useState(false);
  const [mirrorPunctuation, setMirrorPunctuation] = useState(false);
  const [improvingTranslations, setImprovingTranslations] = useState(false);
  const [improveResults, setImproveResults] = useState<ImproveResult[] | null>(null);
  // === Advanced review state (ported from Xenoblade: 7 new AI actions) ===
  const [advancedBusy, setAdvancedBusy] = useState<null | 'smart-review' | 'grammar-check' | 'context-review' | 'auto-correct' | 'detect-weak' | 'context-retranslate' | 'quick-alternatives'>(null);
  const [advancedAction, setAdvancedAction] = useState<null | 'smart-review' | 'grammar-check' | 'context-review' | 'auto-correct' | 'detect-weak' | 'context-retranslate'>(null);
  const [advancedFindings, setAdvancedFindings] = useState<Array<{ key: string; original: string; current: string; fix: string; issue: string; type?: string; score?: number }>>([]);
  const [quickAlternatives, setQuickAlternatives] = useState<null | { key: string; original: string; current: string; alternatives: Array<{ style: string; text: string; reason: string }> }>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pinnedEntryKeys, setPinnedEntryKeys] = useState<string[]>([]);
  const [isPageLocked, _setIsPageLocked] = useState(() => {
    try { return localStorage.getItem('isPageLocked') === 'true'; } catch { return false; }
  });
  const setIsPageLocked = useCallback((locked: boolean) => {
    _setIsPageLocked(locked);
    try { localStorage.setItem('isPageLocked', String(locked)); } catch { /* ignore */ }
  }, []);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [fixPreview, setFixPreview] = useState<{ title: string; items: import("@/components/editor/FixPreviewDialog").FixPreviewItem[]; updates: Record<string, string> } | null>(null);
  const [userGeminiKey, _setUserGeminiKey] = useState(() => {
    try { return localStorage.getItem('userGeminiKey') || ''; } catch { return ''; }
  });

  const setUserGeminiKey = useCallback((key: string) => {
    _setUserGeminiKey(key);
    try { if (key) localStorage.setItem('userGeminiKey', key); else localStorage.removeItem('userGeminiKey'); } catch (e) { console.warn('localStorage userGeminiKey:', e); }
  }, []);

  // === Custom prompt instructions (appended to every AI translation prompt) ===
  const [customPromptInstructions, _setCustomPromptInstructions] = useState<string>(() => {
    try { return localStorage.getItem('customPromptInstructions') || ''; } catch { return ''; }
  });
  const setCustomPromptInstructions = useCallback((v: string) => {
    _setCustomPromptInstructions(v);
    try {
      if (v.trim()) localStorage.setItem('customPromptInstructions', v);
      else localStorage.removeItem('customPromptInstructions');
    } catch (e) { console.warn('localStorage customPromptInstructions:', e); }
  }, []);
  const [translationEngine, _setTranslationEngine] = useState<'gemini' | 'lovable' | 'mymemory' | 'google' | 'claude' | 'bedrock'>(() => {
    try { return (localStorage.getItem('translationEngine') as 'gemini' | 'lovable' | 'mymemory' | 'google' | 'claude' | 'bedrock') || 'lovable'; } catch { return 'lovable'; }
  });
  const setTranslationEngine = useCallback((engine: 'gemini' | 'lovable' | 'mymemory' | 'google' | 'claude' | 'bedrock') => {
    _setTranslationEngine(engine);
    try { localStorage.setItem('translationEngine', engine); } catch (e) { console.warn('localStorage translationEngine:', e); }
  }, []);
  const [userClaudeKey, _setUserClaudeKey] = useState(() => {
    try { return localStorage.getItem('userClaudeKey') || ''; } catch { return ''; }
  });
  const setUserClaudeKey = useCallback((key: string) => {
    _setUserClaudeKey(key);
    try { if (key) localStorage.setItem('userClaudeKey', key); else localStorage.removeItem('userClaudeKey'); } catch (e) { console.warn('localStorage userClaudeKey:', e); }
  }, []);
  const [userBedrockApiKey, _setUserBedrockApiKey] = useState(() => {
    try { return localStorage.getItem('userBedrockApiKey') || ''; } catch { return ''; }
  });
  const setUserBedrockApiKey = useCallback((key: string) => {
    _setUserBedrockApiKey(key);
    try { if (key) localStorage.setItem('userBedrockApiKey', key); else localStorage.removeItem('userBedrockApiKey'); } catch (e) { console.warn('localStorage userBedrockApiKey:', e); }
  }, []);
  const [userBedrockRegion, _setUserBedrockRegion] = useState(() => {
    try { return localStorage.getItem('userBedrockRegion') || 'us-east-1'; } catch { return 'us-east-1'; }
  });
  const setUserBedrockRegion = useCallback((region: string) => {
    _setUserBedrockRegion(region);
    try { if (region) localStorage.setItem('userBedrockRegion', region); else localStorage.removeItem('userBedrockRegion'); } catch (e) { console.warn('localStorage userBedrockRegion:', e); }
  }, []);
  const [bedrockModel, _setBedrockModel] = useState<string>(() => {
    try { return localStorage.getItem('bedrockModel') || 'nova-pro'; } catch { return 'nova-pro'; }
  });
  const setBedrockModel = useCallback((model: string) => {
    _setBedrockModel(model);
    try { localStorage.setItem('bedrockModel', model); } catch (e) { console.warn('localStorage bedrockModel:', e); }
  }, []);
  const [bedrockProxyUrl, _setBedrockProxyUrl] = useState(() => {
    try { return localStorage.getItem('bedrockProxyUrl') || ''; } catch { return ''; }
  });
  const setBedrockProxyUrl = useCallback((url: string) => {
    _setBedrockProxyUrl(url);
    try { if (url) localStorage.setItem('bedrockProxyUrl', url); else localStorage.removeItem('bedrockProxyUrl'); } catch (e) { console.warn('localStorage bedrockProxyUrl:', e); }
  }, []);
  const [translationQuality, _setTranslationQuality] = useState<'fast' | 'quality'>(() => {
    try { return (localStorage.getItem('translationQuality') as 'fast' | 'quality') || 'fast'; } catch { return 'fast'; }
  });
  const setTranslationQuality = useCallback((q: 'fast' | 'quality') => {
    _setTranslationQuality(q);
    try { localStorage.setItem('translationQuality', q); } catch (e) { console.warn('localStorage translationQuality:', e); }
  }, []);
  // Specific Gemini model selector (overrides translationQuality when engine is gemini/lovable)
  // 'auto' lets the front-end resolve per-batch by entry length (see lib/gemini-router).
  const [geminiModel, _setGeminiModel] = useState<'gemini-2.0-flash' | 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'auto'>(() => {
    try {
      const v = localStorage.getItem('geminiModel') as 'gemini-2.0-flash' | 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'auto' | null;
      return v || 'gemini-2.5-flash';
    } catch { return 'gemini-2.5-flash'; }
  });
  const setGeminiModel = useCallback((m: 'gemini-2.0-flash' | 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'auto') => {
    _setGeminiModel(m);
    try { localStorage.setItem('geminiModel', m); } catch (e) { console.warn('localStorage geminiModel:', e); }
  }, []);
  const [myMemoryEmail, _setMyMemoryEmail] = useState(() => {
    try { return localStorage.getItem('myMemoryEmail') || ''; } catch { return ''; }
  });
  const setMyMemoryEmail = useCallback((email: string) => {
    _setMyMemoryEmail(email);
    try { if (email) localStorage.setItem('myMemoryEmail', email); else localStorage.removeItem('myMemoryEmail'); } catch (e) { console.warn('localStorage myMemoryEmail:', e); }
  }, []);
  // MyMemory: round-robin rotation index across the parsed email list.
  const [myMemoryEmailIndex, _setMyMemoryEmailIndex] = useState<number>(() => {
    try { return Number(localStorage.getItem('myMemoryEmailIndex')) || 0; } catch { return 0; }
  });
  const setMyMemoryEmailIndex = useCallback((idx: number) => {
    _setMyMemoryEmailIndex(idx);
    try { localStorage.setItem('myMemoryEmailIndex', String(idx)); } catch (e) { console.warn('localStorage myMemoryEmailIndex:', e); }
  }, []);
  // Per-engine creativity (temperature). Default 0.2 matches edge default.
  const _readTemp = (key: string): number => {
    try {
      const v = Number(localStorage.getItem(key));
      if (!Number.isFinite(v) || v < 0 || v > 2) return 0.2;
      return v;
    } catch { return 0.2; }
  };
  const [geminiTemperature, _setGeminiTemperature] = useState<number>(() => _readTemp('geminiTemperature'));
  const setGeminiTemperature = useCallback((t: number) => {
    _setGeminiTemperature(t);
    try { localStorage.setItem('geminiTemperature', String(t)); } catch (e) { console.warn('localStorage geminiTemperature:', e); }
  }, []);
  const [claudeTemperature, _setClaudeTemperature] = useState<number>(() => _readTemp('claudeTemperature'));
  const setClaudeTemperature = useCallback((t: number) => {
    _setClaudeTemperature(t);
    try { localStorage.setItem('claudeTemperature', String(t)); } catch (e) { console.warn('localStorage claudeTemperature:', e); }
  }, []);
  const [bedrockTemperature, _setBedrockTemperature] = useState<number>(() => _readTemp('bedrockTemperature'));
  const setBedrockTemperature = useCallback((t: number) => {
    _setBedrockTemperature(t);
    try { localStorage.setItem('bedrockTemperature', String(t)); } catch (e) { console.warn('localStorage bedrockTemperature:', e); }
  }, []);
  const [lovableTemperature, _setLovableTemperature] = useState<number>(() => _readTemp('lovableTemperature'));
  const setLovableTemperature = useCallback((t: number) => {
    _setLovableTemperature(t);
    try { localStorage.setItem('lovableTemperature', String(t)); } catch (e) { console.warn('localStorage lovableTemperature:', e); }
  }, []);
  // Auto-fallback toggle + chain order (comma-separated engine ids).
  const [autoFallback, _setAutoFallback] = useState<boolean>(() => {
    try { return localStorage.getItem('autoFallback') === '1'; } catch { return false; }
  });
  const setAutoFallback = useCallback((v: boolean) => {
    _setAutoFallback(v);
    try { localStorage.setItem('autoFallback', v ? '1' : '0'); } catch (e) { console.warn('localStorage autoFallback:', e); }
  }, []);
  const [fallbackChainRaw, _setFallbackChainRaw] = useState<string>(() => {
    try { return localStorage.getItem('fallbackChain') || 'gemini,lovable,claude,mymemory,google'; } catch { return 'gemini,lovable,claude,mymemory,google'; }
  });
  const setFallbackChainRaw = useCallback((v: string) => {
    _setFallbackChainRaw(v);
    try { localStorage.setItem('fallbackChain', v); } catch (e) { console.warn('localStorage fallbackChain:', e); }
  }, []);
  const [myMemoryCharsUsed, setMyMemoryCharsUsed] = useState(() => {
    try {
      const stored = localStorage.getItem('myMemoryCharsUsed');
      const resetTime = localStorage.getItem('myMemoryResetTime');
      if (resetTime && Date.now() > Number(resetTime)) {
        localStorage.removeItem('myMemoryCharsUsed');
        localStorage.removeItem('myMemoryResetTime');
        return 0;
      }
      return stored ? Number(stored) : 0;
    } catch { return 0; }
  });
  const myMemoryDailyLimit = myMemoryEmail ? 50000 : 5000;


  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const stateRef = useRef<EditorState | null>(null);
  const { user } = useAuth();

  // Keep stateRef always in sync so we can flush on unmount
  useEffect(() => { stateRef.current = state; }, [state]);

  const glossary = useEditorGlossary({
    state, setState, setLastSaved, setCloudSyncing, setCloudStatus, userId: user?.id,
  });
  const { activeGlossary, parseGlossaryMap } = glossary;

  const quality = useEditorQuality({ state });
  const { isTranslationTooShort, isTranslationTooLong, hasStuckChars, isMixedLanguage, needsImprovement, qualityStats, needsImproveCount, categoryProgress, translatedCount, exportQualityReport } = quality;

  const build = useEditorBuild({ state, setState, setLastSaved, arabicNumerals, mirrorPunctuation });
  const { building, buildProgress, applyingArabic, buildStats, setBuildStats, buildPreview, showBuildConfirm, setShowBuildConfirm, handleApplyArabicProcessing, handlePreBuild, handleBuild } = build;

  const showTimedMessage = useCallback((setter: (msg: string) => void, msg: string, duration = 3000) => {
    setter(msg);
    setTimeout(() => setter(""), duration);
  }, []);

  const fixes = useEditorFixes({
    state, setState, setLastSaved, setTranslateProgress, setPreviousTranslations,
    setFixPreview, isMixedLanguage, activeGlossary, showTimedMessage,
  });
  const { fixingMixed, handleFixAllStuckCharacters, handleFixAllPunctuation, handleFixAllBrackets,
    handleFixAllDiacritics, handleFixAllSpaces, handleFixAllHamza,
    handleFixAllLonelyLam, handleFixAllTaaHaa, handleFixMixedLanguage } = fixes;

  const cloud = useEditorCloud({ state, setState, user, setCloudSyncing, setCloudStatus });
  const { handleCloudSave, handleCloudLoad } = cloud;


  // === Protection handlers ===
  const toggleProtection = (key: string) => {
    if (!state) return;
    const newProtected = new Set(state.protectedEntries || []);
    if (newProtected.has(key)) newProtected.delete(key);
    else newProtected.add(key);
    setState(prev => prev ? { ...prev, protectedEntries: newProtected } : null);
  };

  const toggleTechnicalBypass = (key: string) => {
    if (!state) return;
    const newBypass = new Set(state.technicalBypass || []);
    if (newBypass.has(key)) newBypass.delete(key);
    else newBypass.add(key);
    setState(prev => prev ? { ...prev, technicalBypass: newBypass } : null);
  };

  const handleProtectAllArabic = () => {
    if (!state) return;
    const arabicRegex = ARABIC_REGEX;
    const newProtected = new Set(state.protectedEntries || []);
    let count = 0;
    for (const entry of state.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      if (arabicRegex.test(entry.original) && !newProtected.has(key)) {
        newProtected.add(key);
        count++;
      }
    }
    setState(prev => prev ? { ...prev, protectedEntries: newProtected } : null);
    showLastSaved(`✅ تم حماية ${count} نص معرّب من العكس`);
  };

  const handleFixReversed = (entry: ExtractedEntry) => {
    if (!state) return;
    const key = `${entry.msbtFile}:${entry.index}`;
    const corrected = unReverseBidi(entry.original);
    const newProtected = new Set(state.protectedEntries || []);
    newProtected.add(key);
    setState(prev => prev ? {
      ...prev,
      translations: { ...prev.translations, [key]: corrected },
      protectedEntries: newProtected,
    } : null);
  };

  const handleFixAllReversed = () => {
    if (!state) return;
    const newTranslations = { ...state.translations };
    const newProtected = new Set(state.protectedEntries || []);
    let count = 0, skippedProtected = 0, skippedTranslated = 0, skippedSame = 0;

    for (const entry of state.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      if (hasArabicChars(entry.original)) {
        if (newProtected.has(key)) { skippedProtected++; continue; }
        const existing = newTranslations[key]?.trim();
        const isAutoDetected = !existing || existing === entry.original || existing === entry.original.trim();
        if (isAutoDetected) {
          const corrected = unReverseBidi(entry.original);
          if (corrected !== entry.original) {
            newTranslations[key] = corrected;
            newProtected.add(key);
            count++;
          } else { skippedSame++; }
        } else { skippedTranslated++; }
      }
    }

    setState(prev => prev ? { ...prev, translations: newTranslations, protectedEntries: newProtected } : null);
    const parts: string[] = [];
    if (count > 0) parts.push("تم تصحيح: " + count + " نص");
    if (skippedProtected > 0) parts.push("محمية: " + skippedProtected);
    if (skippedTranslated > 0) parts.push("مترجمة: " + skippedTranslated);
    if (skippedSame > 0) parts.push("بلا تغيير: " + skippedSame);
    showLastSaved((count > 0 ? "✅ " : "⚠️ ") + parts.join(" | "), 5000);
  };

  // === Load / Save ===
  const detectPreTranslated = useCallback((editorState: EditorState): Record<string, string> => {
    const arabicRegex = ARABIC_REGEX;
    const autoTranslations: Record<string, string> = {};
    for (const entry of editorState.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      if (!editorState.translations[key]?.trim() && arabicRegex.test(entry.original)) {
        autoTranslations[key] = entry.original;
      }
    }
    return autoTranslations;
  }, []);

  useEffect(() => {
    const loadState = async () => {
      try {
      const stored = await idbGet<EditorState>("editorState");
      if (stored) {
        const validKeys = new Set(stored.entries.map(e => `${e.msbtFile}:${e.index}`));
        const autoTranslations = detectPreTranslated({
          entries: stored.entries,
          translations: stored.translations || {},
          protectedEntries: new Set(),
        });
        const filteredStored: Record<string, string> = {};
        for (const [k, v] of Object.entries(stored.translations || {})) {
          if (validKeys.has(k)) filteredStored[k] = v;
        }
        const mergedTranslations = { ...autoTranslations, ...filteredStored };
        const autoCount = Object.keys(autoTranslations).length;
        const protectedSet = new Set<string>(
          Array.isArray(stored.protectedEntries) ? (stored.protectedEntries as string[]) : []
        );
        const storedBypass = (stored as EditorState & { technicalBypass?: string[] | Set<string> }).technicalBypass;
        const bypassSet = new Set<string>(
          Array.isArray(storedBypass) ? storedBypass : []
        );
        const arabicRegex = ARABIC_REGEX;
        for (const entry of stored.entries) {
          const key = `${entry.msbtFile}:${entry.index}`;
          if (arabicRegex.test(entry.original)) {
            // تخطي الحماية إذا كان الأصل من بناء سابق (يحتوي presentation forms)
            if (hasArabicPresentationForms(entry.original)) continue;
            const existingTranslation = mergedTranslations[key]?.trim();
            if (existingTranslation && existingTranslation !== entry.original && existingTranslation !== entry.original.trim()) {
              protectedSet.add(key);
            }
          }
        }
        // === One-time auto-repair: fix ONLY entries where translation has FEWER tags than original ===
        let autoFixCount = 0;
        for (const entry of stored.entries) {
          if (!hasTechnicalTags(entry.original)) continue;
          const key = `${entry.msbtFile}:${entry.index}`;
          const trans = mergedTranslations[key] || '';
          if (!trans.trim()) continue;
          const origTags = entry.original.match(/[\uFFF9-\uFFFC\uE000-\uF8FF]/g) || [];
          const transTags = trans.match(/[\uFFF9-\uFFFC\uE000-\uF8FF]/g) || [];
          if (transTags.length < origTags.length) {
            const fixed = restoreTagsLocally(entry.original, trans);
            if (fixed !== trans) {
              mergedTranslations[key] = fixed;
              autoFixCount++;
            }
          }
        }
        const finalState: EditorState = {
          entries: stored.entries,
          translations: mergedTranslations,
          protectedEntries: protectedSet,
          technicalBypass: bypassSet,
        };
        setState(finalState);

        // Save immediately if we auto-fixed anything
        if (autoFixCount > 0) {
          await idbSet("editorState", {
            entries: finalState.entries,
            translations: finalState.translations,
            protectedEntries: Array.from(finalState.protectedEntries || []),
            technicalBypass: Array.from(finalState.technicalBypass || []),
          });
        }

        const parts: string[] = [];
        if (autoCount > 0) parts.push(`اكتشاف ${autoCount} نص معرّب مسبقاً`);
        if (autoFixCount > 0) parts.push(`🔧 إصلاح تلقائي لـ ${autoFixCount} رمز تالف`);
        setLastSaved(parts.length > 0 ? `تم التحميل + ${parts.join(' + ')}` : "تم التحميل من الحفظ السابق");
      } else {
        // Demo data
        const demoEntries: ExtractedEntry[] = [
          // maxBytes = 3x original UTF-16LE size (dynamic rebuild supports expansion)
          { msbtFile: "ActorMsg/Link.msbt", index: 0, label: "Link", original: "Link", maxBytes: 24 },
          { msbtFile: "ActorMsg/Link.msbt", index: 1, label: "Hero", original: "The Hero of Hyrule", maxBytes: 108 },
          { msbtFile: "LayoutMsg/Common.msbt", index: 0, label: "Accept", original: "Accept", maxBytes: 36 },
          { msbtFile: "LayoutMsg/Common.msbt", index: 1, label: "Cancel", original: "Cancel", maxBytes: 36 },
          { msbtFile: "StoryMsg/MainQuest.msbt", index: 0, label: "Quest_Intro", original: "The ancient evil has returned to [Color:Red]Hyrule[Color:White]. You must find the Master Sword.", maxBytes: 576 },
          { msbtFile: "StoryMsg/MainQuest.msbt", index: 1, label: "Quest_Complete", original: "You have completed the trial!", maxBytes: 168 },
          { msbtFile: "EventFlowMsg/NPC_Dialog.msbt", index: 0, label: "Greet", original: "Hello, traveler! Welcome to our village.", maxBytes: 240 },
          { msbtFile: "EventFlowMsg/NPC_Dialog.msbt", index: 1, label: "Warning", original: "Be careful! The monsters in the forest are very dangerous at night.", maxBytes: 396 },
          { msbtFile: "ChallengeMsg/Shrine.msbt", index: 0, label: "Shrine_Name", original: "Trial of Power", maxBytes: 90 },
          { msbtFile: "ChallengeMsg/Shrine.msbt", index: 1, label: "Shrine_Desc", original: "Defeat all enemies within the time limit to prove your strength.", maxBytes: 378 },
          // Demo entries with technical control characters (U+FFF9, U+FFFA, U+FFFB, PUA)
          { msbtFile: "EventFlowMsg/Npc_Impa.msbt", index: 0, label: "Impa_Greet", original: "\uFFF9Press \uE000\uE001\uFFFA to talk to \uFFFBImpa\uFFFC", maxBytes: 300 },
          { msbtFile: "EventFlowMsg/Npc_Impa.msbt", index: 1, label: "Impa_Quest", original: "You need \uFFF9\uE002 3 items\uFFFA to complete this quest\uFFFB.", maxBytes: 350 },
          { msbtFile: "LayoutMsg/ButtonGuide.msbt", index: 0, label: "Btn_A", original: "\uFFF9\uE000\uFFFA Confirm", maxBytes: 100 },
          { msbtFile: "LayoutMsg/ButtonGuide.msbt", index: 1, label: "Btn_B", original: "\uFFF9\uE001\uFFFA Cancel", maxBytes: 100 },
        ];
        const demoTranslations: Record<string, string> = {
          "ActorMsg/Link.msbt:0": "لينك",
          "ActorMsg/Link.msbt:1": "بطل مملكة هايرول الأسطوري العظيم المختار من الآلهة القديمة",
          "LayoutMsg/Common.msbt:0": "الموافقة والقبول على جميع الشروط",
          "LayoutMsg/Common.msbt:1": "إلغاء العملية والرجوع للخلف",
          "StoryMsg/MainQuest.msbt:0": "لقد عاد الشر القديم إلى [Color:Red]هايرول[Color:White]. يجب عليك أن تجد سيف الماستر السحري الأسطوري لهزيمة الشر وإنقاذ المملكة من الدمار الشامل",
          "StoryMsg/MainQuest.msbt:1": "لقد أكملت التحدي بنجاح! تهانينا يا بطل هايرول الشجاع",
          "EventFlowMsg/NPC_Dialog.msbt:0": "مرحباً أيها المسافر الشجاع! أهلاً وسهلاً بك في قريتنا الصغيرة الجميلة",
          "EventFlowMsg/NPC_Dialog.msbt:1": "احذر جيداً! الوحوش الموجودة في الغابة المظلمة خطيرة للغاية خاصةً في الليل عندما يحل الظلام الدامس",
          "ChallengeMsg/Shrine.msbt:0": "تحدي القوة والشجاعة الأسطورية",
          "ChallengeMsg/Shrine.msbt:1": "اهزم جميع الأعداء والوحوش الخطيرة خلال الوقت المحدد لإثبات قوتك وشجاعتك في المعركة",
          // Damaged translations — tags were stripped by AI
          "EventFlowMsg/Npc_Impa.msbt:0": "اضغط للتحدث مع إمبا",
          "EventFlowMsg/Npc_Impa.msbt:1": "تحتاج 3 عناصر لإكمال هذه المهمة.",
          // Intact translations — tags preserved
          "LayoutMsg/ButtonGuide.msbt:0": "\uFFF9\uE000\uFFFA تأكيد",
          "LayoutMsg/ButtonGuide.msbt:1": "\uFFF9\uE001\uFFFA إلغاء",
        };
        setState({
          entries: demoEntries,
          translations: demoTranslations,
          protectedEntries: new Set(),
          technicalBypass: new Set(),
        });
        setLastSaved("تم تحميل بيانات تجريبية");
      }
      } catch (err) {
        console.warn('Editor state load failed:', err);
      }
    };
    loadState();
  }, [detectPreTranslated]);

  const saveToIDB = useCallback(async (editorState: EditorState) => {
    await idbSet("editorState", {
      entries: editorState.entries,
      translations: editorState.translations,
      protectedEntries: Array.from(editorState.protectedEntries || []),
      technicalBypass: Array.from(editorState.technicalBypass || []),
    });
    setLastSaved(`آخر حفظ: ${new Date().toLocaleTimeString("ar-SA")}`);
  }, []);

  useEffect(() => {
    if (!state) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveToIDB(state), AUTOSAVE_DELAY);
    // C2 fix: do NOT flush in cleanup. The cleanup runs on every translations
    // change, which previously caused saveToIDB to fire on every keystroke
    // (defeating AUTOSAVE_DELAY). Real flush still happens via the
    // beforeunload + visibilitychange listener below.
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state?.translations, saveToIDB]);

  // Save before browser/tab close or hide
  useEffect(() => {
    const flushPendingSave = () => {
      if (saveTimerRef.current && stateRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = undefined;
        idbSetSync("editorState", {
          entries: stateRef.current.entries,
          translations: stateRef.current.translations,
          protectedEntries: Array.from(stateRef.current.protectedEntries || []),
          technicalBypass: Array.from(stateRef.current.technicalBypass || []),
        });
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingSave();
    };
    window.addEventListener('beforeunload', flushPendingSave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', flushPendingSave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // === Computed values ===
  const msbtFiles = useMemo(() => {
    if (!state) return [];
    const set = new Set(state.entries.map(e => e.msbtFile));
    return Array.from(set).sort();
  }, [state?.entries]);

  const categoryCounts = useMemo(() => {
    if (!state) return {};
    const counts: Record<string, number> = {};
    for (const e of state.entries) {
      const cat = categorizeFile(e.msbtFile, e.label);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [state?.entries]);

  // === Count entries with technical tags ===
  const tagsCount = useMemo(() => {
    if (!state) return 0;
    return state.entries.filter(e => hasTechnicalTags(e.original)).length;
  }, [state?.entries]);

  // === Filtered entries ===
  const filteredEntries = useMemo(() => {
    if (!state) return [];
    return state.entries.filter(e => {
      const key = `${e.msbtFile}:${e.index}`;
      const translation = state.translations[key] || '';
      const isTranslated = translation.trim() !== '';
      const isTechnical = isTechnicalText(e.original);
      const matchSearch = !search ||
        e.original.toLowerCase().includes(search.toLowerCase()) ||
        e.label.includes(search) ||
        translation.includes(search);
      const matchFile = filterFile === "all" || e.msbtFile === filterFile;
      const matchCategory = filterCategory === "all" || categorizeFile(e.msbtFile, e.label) === filterCategory;
      // Separate tag-type filters (AND logic) from status filters (OR logic)
      const tagFilters = new Set<string>();
      const statusFilters = new Set<string>();
      for (const fs of filterStatus) {
        if (fs === "has-tags" || fs === "no-tags") tagFilters.add(fs);
        else statusFilters.add(fs);
      }
      const matchTagFilter = tagFilters.size === 0 || 
        (tagFilters.has("has-tags") && hasTechnicalTags(e.original)) ||
        (tagFilters.has("no-tags") && !hasTechnicalTags(e.original));
      const matchStatus = (statusFilters.size === 0 && tagFilters.size === 0) || 
        (statusFilters.size === 0 ? matchTagFilter : (
          matchTagFilter && Array.from(statusFilters).some(fs =>
            (fs === "translated" && isTranslated) ||
            (fs === "untranslated" && !isTranslated) ||
            (fs === "problems" && qualityStats.problemKeys.has(key)) ||
            (fs === "needs-improve" && isTranslated && needsImprovement(e, translation)) ||
            (fs === "too-short" && isTranslated && isTranslationTooShort(e, translation)) ||
            (fs === "too-long" && isTranslated && isTranslationTooLong(e, translation)) ||
            (fs === "stuck-chars" && isTranslated && hasStuckChars(translation)) ||
            (fs === "mixed-lang" && isTranslated && isMixedLanguage(translation)) ||
            (fs === "damaged-tags" && qualityStats.damagedTagKeys.has(key)) ||
            (fs === "duplicates" && qualityStats.duplicateTranslationKeys.has(key)) ||
            (fs === "punctuation" && qualityStats.punctuationMismatchKeys.has(key)) ||
            (fs === "unclosed-brackets" && qualityStats.unclosedBracketKeys.has(key))
          )
        ));
      const matchTechnical = 
        filterTechnical === "all" ||
        (filterTechnical === "only" && isTechnical) ||
        (filterTechnical === "exclude" && !isTechnical);
      return matchSearch && matchFile && matchCategory && matchStatus && matchTechnical;
    });
  }, [state, search, filterFile, filterCategory, filterStatus, filterTechnical, qualityStats.problemKeys, qualityStats.duplicateTranslationKeys, qualityStats.punctuationMismatchKeys, qualityStats.unclosedBracketKeys, needsImprovement, isTranslationTooShort, isTranslationTooLong, hasStuckChars, isMixedLanguage]);

  useEffect(() => { if (!isPinned) setCurrentPage(0); }, [search, filterFile, filterCategory, filterStatus, filterTechnical, isPinned]);

  useEffect(() => {
    if (!isPageLocked) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isPageLocked]);

  const displayedEntries = useMemo(() => {
    if (!isPinned || pinnedEntryKeys.length === 0 || !state) return filteredEntries;
    const entryMap = new Map(state.entries.map(e => [`${e.msbtFile}:${e.index}`, e]));
    return pinnedEntryKeys.map(k => entryMap.get(k)).filter((e): e is ExtractedEntry => !!e);
  }, [isPinned, pinnedEntryKeys, filteredEntries, state]);

  const togglePin = useCallback(() => {
    setIsPinned(prev => {
      if (!prev) {
        setPinnedEntryKeys(filteredEntries.map(e => `${e.msbtFile}:${e.index}`));
      }
      return !prev;
    });
  }, [filteredEntries]);

  const totalPages = Math.ceil(displayedEntries.length / PAGE_SIZE);
  const paginatedEntries = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return displayedEntries.slice(start, start + PAGE_SIZE);
  }, [displayedEntries, currentPage]);


  // === Translation handlers ===
  const updateTranslation = (key: string, value: string) => {
    if (!state) return;
    const prev = state.translations[key] || '';
    if (prev !== value) {
      setPreviousTranslations(old => ({ ...old, [key]: prev }));
    }
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, [key]: value } } : null);
  };

  const handleUndoTranslation = (key: string) => {
    if (previousTranslations[key] !== undefined) {
      setState(prev => prev ? { ...prev, translations: { ...prev.translations, [key]: previousTranslations[key] } } : null);
      setPreviousTranslations(old => { const copy = { ...old }; delete copy[key]; return copy; });
    }
  };

  const isFilterActive = filterCategory !== "all" || filterFile !== "all" || filterStatus.size > 0 || filterTechnical !== "all" || search !== "";

  const translation = useEditorTranslation({
    state, setState, setLastSaved, setTranslateProgress, setPreviousTranslations, updateTranslation,
    filterCategory, activeGlossary, parseGlossaryMap, paginatedEntries, userGeminiKey, userClaudeKey, translationEngine, translationQuality,
    geminiModel,
    filteredEntries, isFilterActive, myMemoryEmail, myMemoryCharsUsed, setMyMemoryCharsUsed, myMemoryDailyLimit,
    customPromptInstructions,
    userBedrockApiKey, userBedrockRegion, bedrockModel, bedrockProxyUrl,
    geminiTemperature, claudeTemperature, bedrockTemperature, lovableTemperature,
    myMemoryEmailIndex, setMyMemoryEmailIndex,
  });
  const {
    translating, translatingSingle, tmStats,
    handleTranslateSingle, handleAutoTranslate, handleStopTranslate,
    handleRetranslatePage, handleFixDamagedTags,
    handleTranslatePage, handleTranslateFromGlossaryOnly,
    showPageCompare, pendingPageTranslations, oldPageTranslations, pageTranslationOriginals,
    applyPageTranslations, discardPageTranslations,
  } = translation;

  // === Local (offline) fix for damaged tags — no AI needed ===
  const handleLocalFixDamagedTag = useCallback((entry: ExtractedEntry) => {
    if (!state) return;
    const key = `${entry.msbtFile}:${entry.index}`;
    const translation = state.translations[key] || '';
    if (!translation.trim()) return;
    const fixed = restoreTagsLocally(entry.original, translation);
    if (fixed !== translation) {
      setPreviousTranslations(old => ({ ...old, [key]: translation }));
      setState(prev => prev ? { ...prev, translations: { ...prev.translations, [key]: fixed } } : null);
    }
  }, [state, setState, setPreviousTranslations]);

  const handleLocalFixAllDamagedTags = useCallback((damagedTagKeys: Set<string>) => {
    if (!state || damagedTagKeys.size === 0) return;
    const updates: Record<string, string> = {};
    const prevTrans: Record<string, string> = {};
    for (const entry of state.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      if (!damagedTagKeys.has(key)) continue;
      const translation = state.translations[key] || '';
      if (!translation.trim()) continue;
      const fixed = restoreTagsLocally(entry.original, translation);
      if (fixed !== translation) {
        prevTrans[key] = translation;
        updates[key] = fixed;
      }
    }
    const fixedCount = Object.keys(updates).length;
    if (fixedCount === 0) {
      showLastSaved("لا توجد رموز تالفة يمكن إصلاحها محلياً");
      return;
    }
    setPreviousTranslations(old => ({ ...old, ...prevTrans }));
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...updates } } : null);
    toast({ title: "✅ تم الإصلاح المحلي", description: `تم استعادة الرموز في ${fixedCount} نص بدون ذكاء اصطناعي` });
    showLastSaved(`✅ تم إصلاح ${fixedCount} نص محلياً`, 4000);
  }, [state, setState, setPreviousTranslations, setLastSaved]);

  // === Deep tag scan: scan ALL entries for tag issues and propose fixes (preview before apply) ===
  // Detects: missing tags, duplicate (extra) tags, and order/identity mismatch — even when total counts are equal.
  // Uses no AI — fully offline. Pending updates are stored and applied only after the user confirms.
  const [deepScanReport, setDeepScanReport] = useState<{
    scanned: number;
    fixed: number;
    notFixable: number;
    perFile: Record<string, number>;
    examples: { key: string; before: string; after: string }[];
    pendingUpdates?: Record<string, string>;
    pendingPrev?: Record<string, string>;
    manualReview?: { key: string; file: string; label: string; reason: string; current: string }[];
  } | null>(null);

  const handleDeepTagScan = useCallback(() => {
    if (!state) {
      toast({ title: "⚠️ لا توجد بيانات", description: "حمّل ملفاً أولاً", variant: "destructive" });
      return;
    }
    const charRegexG = /[\uFFF9-\uFFFC\uE000-\uF8FF]/g;
    const updates: Record<string, string> = {};
    const prevTrans: Record<string, string> = {};
    const perFile: Record<string, number> = {};
    const examples: { key: string; before: string; after: string }[] = [];
    const manualReview: { key: string; file: string; label: string; reason: string; current: string }[] = [];
    let scanned = 0;
    let notFixable = 0;

    // Build a per-tag occurrence count map
    const tagCounts = (s: string): Map<string, number> => {
      const m = new Map<string, number>();
      const tags = s.match(charRegexG) || [];
      for (const t of tags) m.set(t, (m.get(t) || 0) + 1);
      return m;
    };

    for (const entry of state.entries) {
      if (!hasTechnicalTags(entry.original)) continue;
      const key = `${entry.msbtFile}:${entry.index}`;
      const trans = state.translations[key] || '';
      if (!trans.trim()) continue;
      scanned++;

      const origTags = entry.original.match(charRegexG) || [];
      const transTags = trans.match(charRegexG) || [];
      const origCounts = tagCounts(entry.original);
      const transCounts = tagCounts(trans);

      // Detect: count mismatch | identity diff | duplicate tags | missing tags per-occurrence
      const missing: string[] = [];
      const extra: string[] = [];
      for (const [tag, n] of origCounts) {
        const m = transCounts.get(tag) || 0;
        if (m < n) missing.push(...Array(n - m).fill(tag));
      }
      for (const [tag, n] of transCounts) {
        const o = origCounts.get(tag) || 0;
        if (n > o) extra.push(...Array(n - o).fill(tag));
      }
      const orderDiff = origTags.length === transTags.length &&
        origTags.some((t, i) => transTags[i] !== t);
      const hasIssue = missing.length > 0 || extra.length > 0 || orderDiff;
      if (!hasIssue) continue;

      const fixed = restoreTagsLocally(entry.original, trans);
      // Verify the fix actually resolves the tag-level issue
      const fixedCounts = tagCounts(fixed);
      let stillBroken = false;
      for (const [tag, n] of origCounts) {
        if ((fixedCounts.get(tag) || 0) !== n) { stillBroken = true; break; }
      }
      if (fixed !== trans && !stillBroken) {
        prevTrans[key] = trans;
        updates[key] = fixed;
        perFile[entry.msbtFile] = (perFile[entry.msbtFile] || 0) + 1;
        if (examples.length < 5) {
          examples.push({ key, before: trans, after: fixed });
        }
      } else {
        notFixable++;
        const reasons: string[] = [];
        if (missing.length > 0) reasons.push(`ينقص ${missing.length} وسم`);
        if (extra.length > 0) reasons.push(`زائد ${extra.length} وسم (مكرر)`);
        if (orderDiff) reasons.push('ترتيب الوسوم مختلف');
        if (manualReview.length < 50) {
          manualReview.push({
            key, file: entry.msbtFile, label: entry.label,
            reason: reasons.join(' • '), current: trans,
          });
        }
      }
    }

    const fixedCount = Object.keys(updates).length;
    // Preview mode: do NOT apply until user confirms via setDeepScanReport callback
    setDeepScanReport({
      scanned, fixed: fixedCount, notFixable, perFile, examples,
      pendingUpdates: fixedCount > 0 ? updates : undefined,
      pendingPrev: fixedCount > 0 ? prevTrans : undefined,
      manualReview,
    });
    toast({
      title: fixedCount > 0 ? "🔍 الفحص مكتمل — راجع المعاينة" : "ℹ️ لا توجد إصلاحات تلقائية",
      description: `فُحص ${scanned} نص — ${fixedCount} قابل للإصلاح${notFixable > 0 ? ` — ${notFixable} يحتاج مراجعة يدوية` : ''}`,
    });
  }, [state, setState, setPreviousTranslations]);

  // Apply pending fixes from the deep scan after user confirmation
  const applyDeepScanFixes = useCallback(() => {
    setDeepScanReport(prev => {
      if (!prev?.pendingUpdates || !prev.pendingPrev) return prev;
      setPreviousTranslations(old => ({ ...old, ...prev.pendingPrev! }));
      setState(s => s ? { ...s, translations: { ...s.translations, ...prev.pendingUpdates! } } : null);
      toast({ title: "✅ تم تطبيق الإصلاحات", description: `أُصلح ${Object.keys(prev.pendingUpdates).length} نص` });
      return { ...prev, pendingUpdates: undefined, pendingPrev: undefined };
    });
  }, [setState, setPreviousTranslations]);


  // === Redistribute tags at word boundaries for already-fixed translations ===
  const handleRedistributeTags = useCallback(() => {
    if (!state) return;
    const charRegexG = /[\uFFF9-\uFFFC\uE000-\uF8FF]/g;
    const updates: Record<string, string> = {};
    const prevTrans: Record<string, string> = {};
    for (const entry of state.entries) {
      if (!hasTechnicalTags(entry.original)) continue;
      const key = `${entry.msbtFile}:${entry.index}`;
      const trans = state.translations[key] || '';
      if (!trans.trim()) continue;
      // Strip ALL tags from translation first, then let restoreTagsLocally
      // reinsert them at correct word boundaries from scratch
      const strippedTrans = trans.replace(charRegexG, '');
      if (!strippedTrans.trim()) continue;
      const fixed = restoreTagsLocally(entry.original, strippedTrans);
      if (fixed !== trans) {
        prevTrans[key] = trans;
        updates[key] = fixed;
      }
    }
    const count = Object.keys(updates).length;
    if (count === 0) {
      toast({ title: "ℹ️ لا تغيير", description: "جميع الرموز موزعة بشكل صحيح بالفعل" });
      return;
    }
    setPreviousTranslations(old => ({ ...old, ...prevTrans }));
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...updates } } : null);
    toast({ title: "✅ تم إعادة التوزيع", description: `تم إعادة توزيع الرموز في ${count} نص عند حدود الكلمات` });
    showLastSaved(`✅ إعادة توزيع ${count} نص`, 4000);
  }, [state, setState, setPreviousTranslations, setLastSaved]);

  // === Review handlers ===
  const handleReviewTranslations = async () => {
    if (!state) return;
    setReviewing(true);
    setReviewResults(null);
    try {
      const reviewEntries = filteredEntries
        .filter(e => { const key = `${e.msbtFile}:${e.index}`; return state.translations[key]?.trim(); })
        .map(e => ({ key: `${e.msbtFile}:${e.index}`, original: e.original, translation: state.translations[`${e.msbtFile}:${e.index}`], maxBytes: e.maxBytes || 0 }));
      if (reviewEntries.length === 0) { setReviewResults({ issues: [], summary: { total: 0, errors: 0, warnings: 0, checked: 0 } }); return; }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/review-translations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: reviewEntries, glossary: activeGlossary }),
      });
      if (!response.ok) throw new Error(`خطأ ${response.status}`);
      setReviewResults(await response.json());
    } catch (err) {
      setTranslateProgress(`❌ خطأ في المراجعة: ${err instanceof Error ? err.message : 'غير معروف'}`);
      setTimeout(() => setTranslateProgress(""), 4000);
    } finally { setReviewing(false); }
  };

  const handleSuggestShorterTranslations = async () => {
    if (!state || !reviewResults) return;
    setSuggestingShort(true);
    setShortSuggestions(null);
    try {
      const reviewEntries = state.entries
        .filter(e => { const key = `${e.msbtFile}:${e.index}`; return state.translations[key]?.trim(); })
        .map(e => ({ key: `${e.msbtFile}:${e.index}`, original: e.original, translation: state.translations[`${e.msbtFile}:${e.index}`], maxBytes: e.maxBytes || 0 }));
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/review-translations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: reviewEntries, glossary: activeGlossary, action: 'suggest-short' }),
      });
      if (!response.ok) throw new Error(`خطأ ${response.status}`);
      const data = await response.json();
      setShortSuggestions(data.suggestions || []);
    } catch (e) { console.warn('Short suggestions failed', e); setShortSuggestions([]); }
    finally { setSuggestingShort(false); }
  };

  const handleApplyShorterTranslation = (key: string, suggested: string) => {
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, [key]: suggested } } : null);
  };

  const handleApplyAllShorterTranslations = () => {
    if (!state || !shortSuggestions) return;
    const updates: Record<string, string> = {};
    shortSuggestions.forEach((s) => { updates[s.key] = s.suggested; });
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...updates } } : null);
    setShortSuggestions(null);
    showLastSaved(`✅ تم تطبيق ${Object.keys(updates).length} اقتراح قصير`);
  };

  // === Advanced AI review actions (ported from Xenoblade) ===
  // Helper to call review-translations edge function with action
  const callAdvancedReview = async (
    action: 'smart-review' | 'grammar-check' | 'context-review' | 'auto-correct' | 'detect-weak' | 'context-retranslate',
    extraBody: Record<string, unknown> = {}
  ): Promise<any> => {
    if (!state) return null;
    const reviewEntries = filteredEntries
      .filter(e => { const k = `${e.msbtFile}:${e.index}`; return state.translations[k]?.trim(); })
      .map(e => ({ key: `${e.msbtFile}:${e.index}`, original: e.original, translation: state.translations[`${e.msbtFile}:${e.index}`], maxBytes: e.maxBytes || 0 }));
    if (reviewEntries.length === 0) {
      toast({ title: 'ℹ️ لا توجد ترجمات', description: 'لا توجد ترجمات في النطاق الحالي لتحليلها' });
      return null;
    }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/review-translations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: reviewEntries, glossary: activeGlossary, action, geminiModel: resolveGeminiModel(geminiModel, reviewEntries), ...extraBody }),
    }, 120000);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.error || `خطأ ${response.status}`);
    }
    return await response.json();
  };

  // Run any of the 4 findings-producing actions (smart/grammar/context/detect-weak) and show unified panel
  const runFindingsAction = async (
    action: 'smart-review' | 'grammar-check' | 'context-review' | 'detect-weak',
    withContext = false
  ) => {
    setAdvancedBusy(action);
    setAdvancedAction(null);
    setAdvancedFindings([]);
    try {
      const extraBody: Record<string, unknown> = {};
      if (withContext && state) {
        // Include surrounding entries from same file as context (up to 30)
        const contextSrc = state.entries
          .filter(e => { const k = `${e.msbtFile}:${e.index}`; return state.translations[k]?.trim(); })
          .slice(0, 30)
          .map(e => ({ key: `${e.msbtFile}:${e.index}`, original: e.original, translation: state.translations[`${e.msbtFile}:${e.index}`] }));
        extraBody.contextEntries = contextSrc;
      }
      const data = await callAdvancedReview(action, extraBody);
      if (!data) return;
      // Normalize shapes: smart/grammar/context return `findings`; detect-weak returns `weakEntries`
      const raw: any[] = data.findings || data.weakEntries || [];
      const normalized = raw.map((f: any) => ({
        key: f.key,
        original: f.original,
        current: f.current,
        fix: f.fix || f.suggestion || '',
        issue: f.issue || f.reason || '',
        type: f.type,
        score: f.score,
      })).filter((f: any) => f.fix);
      setAdvancedAction(action);
      setAdvancedFindings(normalized);
      if (normalized.length === 0) toast({ title: '✅ لا توجد مشاكل', description: 'جميع الترجمات في النطاق الحالي سليمة' });
    } catch (err) {
      toast({ title: '❌ فشل', description: err instanceof Error ? err.message : 'خطأ غير معروف', variant: 'destructive' });
    } finally { setAdvancedBusy(null); }
  };

  const handleSmartReview = () => runFindingsAction('smart-review');
  const handleGrammarCheck = () => runFindingsAction('grammar-check');
  const handleContextReview = () => runFindingsAction('context-review', true);
  const handleDetectWeak = () => runFindingsAction('detect-weak');

  // auto-correct: returns {corrections: [{key, original, current, corrected}]}
  const handleAutoCorrect = async () => {
    setAdvancedBusy('auto-correct');
    setAdvancedAction(null);
    setAdvancedFindings([]);
    try {
      const data = await callAdvancedReview('auto-correct');
      if (!data) return;
      const corrections: any[] = data.corrections || [];
      const normalized = corrections.map((c: any) => ({ key: c.key, original: c.original, current: c.current, fix: c.corrected, issue: 'تصحيح إملائي/نحوي آلي' }));
      setAdvancedAction('auto-correct');
      setAdvancedFindings(normalized);
      if (normalized.length === 0) toast({ title: '✅ لا توجد تصحيحات', description: 'جميع الترجمات سليمة إملائياً' });
    } catch (err) {
      toast({ title: '❌ فشل', description: err instanceof Error ? err.message : 'خطأ غير معروف', variant: 'destructive' });
    } finally { setAdvancedBusy(null); }
  };

  // context-retranslate: returns {retranslations: [{key, original, current, retranslated, changes}]}
  const handleContextRetranslate = async () => {
    setAdvancedBusy('context-retranslate');
    setAdvancedAction(null);
    setAdvancedFindings([]);
    try {
      const extraBody: Record<string, unknown> = {};
      if (state) {
        const contextSrc = state.entries
          .filter(e => { const k = `${e.msbtFile}:${e.index}`; return state.translations[k]?.trim(); })
          .slice(0, 30)
          .map(e => ({ key: `${e.msbtFile}:${e.index}`, original: e.original, translation: state.translations[`${e.msbtFile}:${e.index}`] }));
        extraBody.contextEntries = contextSrc;
      }
      const data = await callAdvancedReview('context-retranslate', extraBody);
      if (!data) return;
      const retrans: any[] = data.retranslations || [];
      const normalized = retrans.map((r: any) => ({ key: r.key, original: r.original, current: r.current, fix: r.retranslated, issue: r.changes || 'إعادة ترجمة مع سياق' }));
      setAdvancedAction('context-retranslate');
      setAdvancedFindings(normalized);
      if (normalized.length === 0) toast({ title: '✅ لا حاجة لإعادة ترجمة', description: 'الترجمات الحالية مناسبة للسياق' });
    } catch (err) {
      toast({ title: '❌ فشل', description: err instanceof Error ? err.message : 'خطأ غير معروف', variant: 'destructive' });
    } finally { setAdvancedBusy(null); }
  };

  // quick-alternatives: fetch 3 style-variants for a single entry
  const handleQuickAlternatives = async (entryKey: string) => {
    if (!state) return;
    const entry = state.entries.find(e => `${e.msbtFile}:${e.index}` === entryKey);
    if (!entry) return;
    const translation = state.translations[entryKey];
    if (!translation?.trim()) {
      toast({ title: 'ℹ️ لا توجد ترجمة', description: 'اكتب ترجمة أولاً قبل طلب البدائل' });
      return;
    }
    setAdvancedBusy('quick-alternatives');
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      // Build small context: 6 surrounding entries from same file
      const fileEntries = state.entries.filter(e => e.msbtFile === entry.msbtFile);
      const idx = fileEntries.findIndex(e => e.index === entry.index);
      const contextSlice = fileEntries.slice(Math.max(0, idx - 3), idx + 4)
        .filter(e => e.index !== entry.index)
        .map(e => ({ key: `${e.msbtFile}:${e.index}`, original: e.original, translation: state.translations[`${e.msbtFile}:${e.index}`] || '' }))
        .filter(c => c.translation);
      const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/review-translations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: [{ key: entryKey, original: entry.original, translation, maxBytes: entry.maxBytes || 0 }],
          glossary: activeGlossary,
          action: 'quick-alternatives',
          geminiModel: resolveGeminiModel(geminiModel, [{ original: entry.original }]),
          contextEntries: contextSlice,
        }),
      }, 60000);
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || `خطأ ${response.status}`);
      }
      const data = await response.json();
      const alts: any[] = data.alternatives || [];
      if (alts.length === 0) {
        toast({ title: 'ℹ️ لا بدائل', description: 'لم يقترح الذكاء الاصطناعي بدائل مختلفة' });
        return;
      }
      setQuickAlternatives({ key: entryKey, original: entry.original, current: translation, alternatives: alts });
    } catch (err) {
      toast({ title: '❌ فشل', description: err instanceof Error ? err.message : 'خطأ غير معروف', variant: 'destructive' });
    } finally { setAdvancedBusy(null); }
  };

  // Apply/dismiss helpers for advanced findings
  const applyAdvancedFinding = (key: string) => {
    const f = advancedFindings.find(x => x.key === key);
    if (!f || !state) return;
    setPreviousTranslations(old => ({ ...old, [key]: state.translations[key] || '' }));
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, [key]: f.fix } } : null);
    setAdvancedFindings(findings => findings.filter(x => x.key !== key));
  };
  const applyAllAdvancedFindings = () => {
    if (!state || advancedFindings.length === 0) return;
    const updates: Record<string, string> = {};
    const prev: Record<string, string> = {};
    advancedFindings.forEach(f => { updates[f.key] = f.fix; prev[f.key] = state.translations[f.key] || ''; });
    setPreviousTranslations(old => ({ ...old, ...prev }));
    setState(p => p ? { ...p, translations: { ...p.translations, ...updates } } : null);
    const n = advancedFindings.length;
    setAdvancedFindings([]);
    setAdvancedAction(null);
    showLastSaved(`✅ طُبّق ${n} تحسين`);
  };
  const dismissAdvancedFinding = (key: string) => {
    setAdvancedFindings(findings => findings.filter(x => x.key !== key));
  };
  const dismissAllAdvanced = () => {
    setAdvancedFindings([]);
    setAdvancedAction(null);
  };

  // Apply a single quick-alternative
  const applyQuickAlternative = (text: string) => {
    if (!quickAlternatives || !state) return;
    const { key } = quickAlternatives;
    setPreviousTranslations(old => ({ ...old, [key]: state.translations[key] || '' }));
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, [key]: text } } : null);
    setQuickAlternatives(null);
    showLastSaved('✅ طُبّق البديل');
  };

  // === File IO (extracted to useEditorFileIO) ===
  const filterLabel = filterCategory !== "all" ? filterCategory
    : filterFile !== "all" ? filterFile
    : filterStatus.size > 0 ? Array.from(filterStatus).join('+')
    : filterTechnical !== "all" ? filterTechnical
    : "";
  const fileIO = useEditorFileIO({ state, setState, setLastSaved, filteredEntries, filterLabel });
  const { normalizeArabicPresentationForms } = fileIO;

  // === Improve translations ===
  const handleImproveTranslations = async () => {
    if (!state) return;
    setImprovingTranslations(true); setImproveResults(null);
    try {
      const translatedEntries = filteredEntries
        .filter(e => { const key = `${e.msbtFile}:${e.index}`; return state.translations[key]?.trim(); })
        .map(e => ({ key: `${e.msbtFile}:${e.index}`, original: e.original, translation: state.translations[`${e.msbtFile}:${e.index}`], maxBytes: e.maxBytes || 0 }));
      if (translatedEntries.length === 0) { setTranslateProgress("⚠️ لا توجد ترجمات لتحسينها في النطاق المحدد"); setTimeout(() => setTranslateProgress(""), 3000); return; }
      setTranslateProgress(`جاري تحسين ${translatedEntries.length} ترجمة...`);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/review-translations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: translatedEntries, glossary: activeGlossary, action: 'improve' }),
      });
      if (!response.ok) throw new Error(`خطأ ${response.status}`);
      const data = await response.json();
      const improvements = data.improvements || [];
      if (improvements.length === 0) { setTranslateProgress("✅ جميع الترجمات ممتازة — لا تحتاج تحسين!"); }
      else { setTranslateProgress(`✅ تم اقتراح تحسينات لـ ${improvements.length} ترجمة`); setImproveResults(improvements); }
      setTimeout(() => setTranslateProgress(""), 4000);
    } catch (err) { setTranslateProgress(`❌ خطأ في التحسين: ${err instanceof Error ? err.message : 'غير معروف'}`); setTimeout(() => setTranslateProgress(""), 4000); }
    finally { setImprovingTranslations(false); }
  };

  const handleApplyImprovement = (key: string, improved: string) => {
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, [key]: improved } } : null);
  };

  const handleApplyAllImprovements = () => {
    if (!state || !improveResults) return;
    const updates: Record<string, string> = {};
    improveResults.forEach((item) => { if (item.improvedBytes <= item.maxBytes || item.maxBytes === 0) updates[item.key] = item.improved; });
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...updates } } : null);
    setImproveResults(null);
    showLastSaved(`✅ تم تطبيق ${Object.keys(updates).length} تحسين`);
  };

  const handleImproveSingleTranslation = async (entry: ExtractedEntry) => {
    if (!state) return;
    const key = `${entry.msbtFile}:${entry.index}`;
    const translation = state.translations[key];
    if (!translation?.trim()) { setTranslateProgress("⚠️ لا توجد ترجمة لتحسينها"); setTimeout(() => setTranslateProgress(""), 3000); return; }
    setImprovingTranslations(true); setImproveResults(null);
    try {
      setTranslateProgress(`جاري تحسين الترجمة...`);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/review-translations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: [{ key, original: entry.original, translation, maxBytes: entry.maxBytes || 0 }], glossary: activeGlossary, action: 'improve' }),
      });
      if (!response.ok) throw new Error(`خطأ ${response.status}`);
      const data = await response.json();
      const improvements = data.improvements || [];
      if (improvements.length === 0) setTranslateProgress("✅ هذه الترجمة ممتازة — لا تحتاج تحسين!");
      else { setTranslateProgress(`✅ تم اقتراح تحسين لهذه الترجمة`); setImproveResults(improvements); }
      setTimeout(() => setTranslateProgress(""), 4000);
    } catch (err) { setTranslateProgress(`❌ خطأ في التحسين: ${err instanceof Error ? err.message : 'غير معروف'}`); setTimeout(() => setTranslateProgress(""), 4000); }
    finally { setImprovingTranslations(false); }
  };

  const handleApplyFixPreview = useCallback(() => {
    if (!state || !fixPreview) return;
    const prev: Record<string, string> = {};
    for (const key of Object.keys(fixPreview.updates)) {
      prev[key] = state.translations[key] || '';
    }
    setPreviousTranslations(p => ({ ...p, ...prev }));
    setState(s => s ? { ...s, translations: { ...s.translations, ...fixPreview.updates } } : null);
    toast({ title: `✅ تم تطبيق ${fixPreview.items.length} إصلاح`, description: fixPreview.title });
    setFixPreview(null);
  }, [state, fixPreview]);

  const handleBulkReplace = useCallback((replacements: Record<string, string>) => {
    if (!state) return;
    const prev: Record<string, string> = {};
    for (const key of Object.keys(replacements)) {
      prev[key] = state.translations[key] || '';
    }
    setPreviousTranslations(p => ({ ...p, ...prev }));
    setState(s => s ? { ...s, translations: { ...s.translations, ...replacements } } : null);
    showLastSaved(`✅ تم استبدال ${Object.keys(replacements).length} نص`);
  }, [state]);




  return {
    state, search, filterFile, filterCategory, filterStatus, filterTechnical, showFindReplace, userGeminiKey, userClaudeKey, userBedrockApiKey, userBedrockRegion, bedrockModel, bedrockProxyUrl, translationEngine, isFilterActive, myMemoryEmail, myMemoryCharsUsed, myMemoryDailyLimit,
    building, buildProgress, translating, translateProgress,
    lastSaved, cloudSyncing, cloudStatus,
    technicalEditingMode, showPreview, previewKey,
    reviewing, reviewResults, tmStats,
    suggestingShort, shortSuggestions,
    quickReviewMode, quickReviewIndex,
    showQualityStats, translatingSingle,
    previousTranslations, currentPage,
    showRetranslateConfirm, arabicNumerals, mirrorPunctuation,
    applyingArabic, improvingTranslations, improveResults,
    fixingMixed, filtersOpen, isPinned, isPageLocked, buildStats, buildPreview, showBuildConfirm, fixPreview,
    categoryProgress, qualityStats, needsImproveCount, translatedCount, tagsCount, exportQualityReport,
    ...glossary,
    msbtFiles, filteredEntries, displayedEntries, paginatedEntries, totalPages,
    user,

    // Setters
    setSearch, setFilterFile, setFilterCategory, setFilterStatus, toggleFilterStatus, clearFilterStatus, setFilterTechnical,
    setFiltersOpen, togglePin, setIsPageLocked, setShowQualityStats, setQuickReviewMode, setQuickReviewIndex, setShowFindReplace,
    setCurrentPage, setShowRetranslateConfirm, setShowPreview, setPreviewKey,
    setArabicNumerals, setMirrorPunctuation, setUserGeminiKey, setUserClaudeKey, setUserBedrockApiKey, setUserBedrockRegion, setTranslationEngine, translationQuality, setTranslationQuality,
    geminiModel, setGeminiModel,
    setBedrockModel, setBedrockProxyUrl,
    customPromptInstructions, setCustomPromptInstructions,
    setReviewResults, setShortSuggestions, setImproveResults, setBuildStats, setShowBuildConfirm,
    setMyMemoryEmail, setMyMemoryCharsUsed, setFixPreview,
    // Engine controls (per-engine creativity, MyMemory rotation, fallback chain)
    geminiTemperature, setGeminiTemperature,
    claudeTemperature, setClaudeTemperature,
    bedrockTemperature, setBedrockTemperature,
    lovableTemperature, setLovableTemperature,
    myMemoryEmailIndex, setMyMemoryEmailIndex,
    autoFallback, setAutoFallback,
    fallbackChainRaw, setFallbackChainRaw,

    // Handlers
    toggleProtection, toggleTechnicalBypass,
    handleProtectAllArabic, handleFixReversed, handleFixAllReversed,
    updateTranslation, handleUndoTranslation,
    handleTranslateSingle, handleAutoTranslate, handleStopTranslate,
    handleRetranslatePage, handleFixDamagedTags, handleLocalFixDamagedTag, handleLocalFixAllDamagedTags, handleRedistributeTags, handleReviewTranslations,
    handleDeepTagScan, deepScanReport, setDeepScanReport, applyDeepScanFixes,
    handleTranslatePage, handleTranslateFromGlossaryOnly,
    showPageCompare, pendingPageTranslations, oldPageTranslations, pageTranslationOriginals,
    applyPageTranslations, discardPageTranslations,
    handleSuggestShorterTranslations, handleApplyShorterTranslation, handleApplyAllShorterTranslations,
    // Advanced AI review (7 new actions ported from Xenoblade)
    advancedBusy, advancedAction, advancedFindings, quickAlternatives,
    handleSmartReview, handleGrammarCheck, handleContextReview, handleDetectWeak,
    handleAutoCorrect, handleContextRetranslate, handleQuickAlternatives,
    applyAdvancedFinding, applyAllAdvancedFindings, dismissAdvancedFinding, dismissAllAdvanced,
    applyQuickAlternative, setQuickAlternatives,
    handleFixAllStuckCharacters, handleFixMixedLanguage, handleFixAllPunctuation, handleFixAllBrackets,
    handleFixAllDiacritics, handleFixAllSpaces, handleFixAllHamza,
    handleFixAllLonelyLam, handleFixAllTaaHaa,
    ...fileIO,
    handleImproveTranslations, handleApplyImprovement, handleApplyAllImprovements,
    handleImproveSingleTranslation,
    handleCloudSave, handleCloudLoad,
    handleApplyArabicProcessing, handlePreBuild, handleBuild, handleBulkReplace, handleApplyFixPreview,

    // Quality helpers
    isTranslationTooShort, isTranslationTooLong, hasStuckChars, isMixedLanguage, needsImprovement,
  };
}
