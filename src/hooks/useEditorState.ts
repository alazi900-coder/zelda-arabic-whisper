import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { idbSet, idbGet } from "@/lib/idb-storage";
import { processArabicText, hasArabicChars as hasArabicCharsProcessing, hasArabicPresentationForms, removeArabicPresentationForms } from "@/lib/arabic-processing";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { utf8ByteLength } from "@/lib/byte-utils";
import { useEditorGlossary } from "@/hooks/useEditorGlossary";
import { useEditorFileIO } from "@/hooks/useEditorFileIO";
import { useEditorQuality } from "@/hooks/useEditorQuality";
import { useEditorBuild } from "@/hooks/useEditorBuild";
import { useEditorTranslation } from "@/hooks/useEditorTranslation";
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
  const [fixingMixed, setFixingMixed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [userGeminiKey, _setUserGeminiKey] = useState(() => {
    try { return localStorage.getItem('userGeminiKey') || ''; } catch { return ''; }
  });
  const setUserGeminiKey = useCallback((key: string) => {
    _setUserGeminiKey(key);
    try { if (key) localStorage.setItem('userGeminiKey', key); else localStorage.removeItem('userGeminiKey'); } catch {}
  }, []);
  const [translationEngine, _setTranslationEngine] = useState<'gemini' | 'lovable' | 'mymemory'>(() => {
    try { return (localStorage.getItem('translationEngine') as 'gemini' | 'lovable' | 'mymemory') || 'lovable'; } catch { return 'lovable'; }
  });
  const setTranslationEngine = useCallback((engine: 'gemini' | 'lovable' | 'mymemory') => {
    _setTranslationEngine(engine);
    try { localStorage.setItem('translationEngine', engine); } catch {}
  }, []);
  const [translationQuality, _setTranslationQuality] = useState<'fast' | 'quality'>(() => {
    try { return (localStorage.getItem('translationQuality') as 'fast' | 'quality') || 'fast'; } catch { return 'fast'; }
  });
  const setTranslationQuality = useCallback((q: 'fast' | 'quality') => {
    _setTranslationQuality(q);
    try { localStorage.setItem('translationQuality', q); } catch {}
  }, []);
  const [myMemoryEmail, _setMyMemoryEmail] = useState(() => {
    try { return localStorage.getItem('myMemoryEmail') || ''; } catch { return ''; }
  });
  const setMyMemoryEmail = useCallback((email: string) => {
    _setMyMemoryEmail(email);
    try { if (email) localStorage.setItem('myMemoryEmail', email); else localStorage.removeItem('myMemoryEmail'); } catch {}
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
    const arabicRegex = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF\u0750-\u077F\u08A0-\u08FF]/;
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
    setLastSaved(`✅ تم حماية ${count} نص معرّب من العكس`);
    setTimeout(() => setLastSaved(""), 3000);
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
    setLastSaved((count > 0 ? "✅ " : "⚠️ ") + parts.join(" | "));
    setTimeout(() => setLastSaved(""), 5000);
  };

  // === Load / Save ===
  const detectPreTranslated = useCallback((editorState: EditorState): Record<string, string> => {
    const arabicRegex = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF\u0750-\u077F\u08A0-\u08FF]/;
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
        const protectedSet = new Set<string>(
          Array.isArray(stored.protectedEntries) ? (stored.protectedEntries as string[]) : []
        );
        const bypassSet = new Set<string>(
          Array.isArray((stored as any).technicalBypass) ? ((stored as any).technicalBypass as string[]) : []
        );
        const arabicRegex = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF\u0750-\u077F\u08A0-\u08FF]/;
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

        const autoCount = Object.keys(autoTranslations).length;
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
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        // Flush pending save immediately on unmount / dependency change
        if (stateRef.current) saveToIDB(stateRef.current);
      }
    };
  }, [state?.translations, saveToIDB]);

  // Save before browser/tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimerRef.current && stateRef.current) {
        clearTimeout(saveTimerRef.current);
        // Synchronous-safe: use navigator.sendBeacon as fallback isn't needed
        // because idbSet is fire-and-forget here (IDB transactions survive page unload briefly)
        saveToIDB(stateRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveToIDB]);

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

  useEffect(() => { setCurrentPage(0); }, [search, filterFile, filterCategory, filterStatus, filterTechnical]);

  const totalPages = Math.ceil(filteredEntries.length / PAGE_SIZE);
  const paginatedEntries = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredEntries.slice(start, start + PAGE_SIZE);
  }, [filteredEntries, currentPage]);


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
    filterCategory, activeGlossary, parseGlossaryMap, paginatedEntries, userGeminiKey, translationEngine, translationQuality,
    filteredEntries, isFilterActive, myMemoryEmail, myMemoryCharsUsed, setMyMemoryCharsUsed, myMemoryDailyLimit,
  });
  const { translating, translatingSingle, tmStats, handleTranslateSingle, handleAutoTranslate, handleStopTranslate, handleRetranslatePage, handleFixDamagedTags } = translation;

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
      setLastSaved("لا توجد رموز تالفة يمكن إصلاحها محلياً");
      setTimeout(() => setLastSaved(""), 3000);
      return;
    }
    setPreviousTranslations(old => ({ ...old, ...prevTrans }));
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...updates } } : null);
    toast({ title: "✅ تم الإصلاح المحلي", description: `تم استعادة الرموز في ${fixedCount} نص بدون ذكاء اصطناعي` });
    setLastSaved(`✅ تم إصلاح ${fixedCount} نص محلياً`);
    setTimeout(() => setLastSaved(""), 4000);
  }, [state, setState, setPreviousTranslations, setLastSaved]);

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
    setLastSaved(`✅ إعادة توزيع ${count} نص`);
    setTimeout(() => setLastSaved(""), 4000);
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
      const response = await fetch(`${supabaseUrl}/functions/v1/review-translations`, {
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
      const response = await fetch(`${supabaseUrl}/functions/v1/review-translations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: reviewEntries, glossary: activeGlossary, action: 'suggest-short' }),
      });
      if (!response.ok) throw new Error(`خطأ ${response.status}`);
      const data = await response.json();
      setShortSuggestions(data.suggestions || []);
    } catch { setShortSuggestions([]); }
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
    setLastSaved(`✅ تم تطبيق ${Object.keys(updates).length} اقتراح قصير`);
    setTimeout(() => setLastSaved(""), 3000);
  };

  // === Fix handlers ===
  const handleFixAllStuckCharacters = () => {
    if (!state) return;
    let fixedCount = 0;
    const updates: Record<string, string> = {};
    for (const [key, translation] of Object.entries(state.translations)) {
      if (translation?.trim() && hasArabicPresentationForms(translation)) {
        const fixed = removeArabicPresentationForms(translation);
        if (fixed !== translation) { updates[key] = fixed; fixedCount++; }
      }
    }
    if (fixedCount === 0) { setLastSaved("لا توجد ترجمات بها أحرف ملتصقة"); setTimeout(() => setLastSaved(""), 3000); return; }
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...updates } } : null);
    setLastSaved(`✅ تم إصلاح ${fixedCount} ترجمة من الأحرف الملتصقة`);
    setTimeout(() => setLastSaved(""), 3000);
  };

  const handleFixAllPunctuation = useCallback(() => {
    if (!state) return;
    const updates: Record<string, string> = {};
    let fixedCount = 0;
    for (const entry of state.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = state.translations[key]?.trim();
      if (!translation) continue;
      const origEnd = entry.original.trim();
      let fixed = translation;
      if (origEnd.endsWith('?') && !fixed.endsWith('؟') && !fixed.endsWith('?')) {
        fixed = fixed.replace(/[.。،]+$/, '') + '؟';
      } else if (origEnd.endsWith('!') && !fixed.endsWith('!')) {
        fixed = fixed.replace(/[.。،]+$/, '') + '!';
      } else {
        continue;
      }
      if (fixed !== translation) {
        setPreviousTranslations(prev => ({ ...prev, [key]: state.translations[key] || '' }));
        updates[key] = fixed;
        fixedCount++;
      }
    }
    if (fixedCount === 0) {
      toast({ title: "لا توجد علامات ترقيم مفقودة للإصلاح", variant: "default" });
      return;
    }
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...updates } } : null);
    toast({ title: `✅ تم إصلاح علامات الترقيم في ${fixedCount} ترجمة`, description: `تم تصحيح ${fixedCount} إدخال تلقائياً` });
  }, [state]);

  const handleFixAllBrackets = useCallback(() => {
    if (!state) return;
    const updates: Record<string, string> = {};
    let fixedCount = 0;
    for (const entry of state.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = state.translations[key]?.trim();
      if (!translation) continue;
      const orig = entry.original;
      const origTags = orig.match(/\[[^\]]*\]/g) || [];
      let depth = 0;
      let broken = false;
      for (const ch of translation) {
        if (ch === '[') depth++;
        else if (ch === ']') { depth--; if (depth < 0) { broken = true; break; } }
      }
      if (depth !== 0) broken = true;
      if (!broken) continue;
      let fixed = translation;
      if (depth > 0) {
        fixed = fixed + ']'.repeat(depth);
      } else if (depth < 0) {
        fixed = '['.repeat(-depth) + fixed;
      }
      // If original has specific tags, try to restore missing ones
      for (const tag of origTags) {
        if (!fixed.includes(tag)) {
          fixed = fixed.trimEnd() + ' ' + tag;
        }
      }
      fixed = fixed.replace(/\s{2,}/g, ' ').trim();
      if (fixed !== translation) {
        setPreviousTranslations(prev => ({ ...prev, [key]: state.translations[key] || '' }));
        updates[key] = fixed;
        fixedCount++;
      }
    }
    if (fixedCount === 0) {
      toast({ title: "لا توجد أقواس مكسورة للإصلاح", variant: "default" });
      return;
    }
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...updates } } : null);
    toast({ title: `✅ تم إصلاح الأقواس في ${fixedCount} ترجمة`, description: `تم تصحيح ${fixedCount} إدخال تلقائياً` });
  }, [state]);

  // === Fix diacritics (harakat) ===
  const handleFixAllDiacritics = useCallback(() => {
    if (!state) return;
    const updates: Record<string, string> = {};
    let fixedCount = 0;
    const diacriticsRegex = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;
    for (const entry of state.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = state.translations[key];
      if (!translation?.trim()) continue;
      const fixed = translation.replace(diacriticsRegex, '');
      if (fixed !== translation) {
        setPreviousTranslations(prev => ({ ...prev, [key]: state.translations[key] || '' }));
        updates[key] = fixed;
        fixedCount++;
      }
    }
    if (fixedCount === 0) {
      toast({ title: "لا توجد تشكيلات زائدة للإزالة" });
      return;
    }
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...updates } } : null);
    toast({ title: `✅ تم إزالة التشكيل من ${fixedCount} ترجمة`, description: `تم تصحيح ${fixedCount} إدخال تلقائياً` });
  }, [state]);

  // === Fix double/extra spaces ===
  const handleFixAllSpaces = useCallback(() => {
    if (!state) return;
    const updates: Record<string, string> = {};
    let fixedCount = 0;
    for (const entry of state.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = state.translations[key];
      if (!translation?.trim()) continue;
      let fixed = translation;
      fixed = fixed.replace(/ {2,}/g, ' ');
      fixed = fixed.replace(/ ([،؛؟!.,;?])/g, '$1');
      fixed = fixed.replace(/([،؛؟!.,;?])([^\s\]،؛؟!.,;?\u0000-\u001F])/g, '$1 $2');
      fixed = fixed.trim();
      if (fixed !== translation) {
        setPreviousTranslations(prev => ({ ...prev, [key]: state.translations[key] || '' }));
        updates[key] = fixed;
        fixedCount++;
      }
    }
    if (fixedCount === 0) {
      toast({ title: "لا توجد مسافات مزدوجة للإصلاح" });
      return;
    }
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...updates } } : null);
    toast({ title: `✅ تم إصلاح المسافات في ${fixedCount} ترجمة`, description: `تم تصحيح ${fixedCount} إدخال تلقائياً` });
  }, [state]);

  // === Normalize hamza/alef ===
  const handleFixAllHamza = useCallback(() => {
    if (!state) return;
    const updates: Record<string, string> = {};
    let fixedCount = 0;
    for (const entry of state.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = state.translations[key];
      if (!translation?.trim()) continue;
      let fixed = translation;
      fixed = fixed.replace(/[أإآ]/g, 'ا');
      fixed = fixed.replace(/ى\b/g, 'ي');
      if (fixed !== translation) {
        setPreviousTranslations(prev => ({ ...prev, [key]: state.translations[key] || '' }));
        updates[key] = fixed;
        fixedCount++;
      }
    }
    if (fixedCount === 0) {
      toast({ title: "لا توجد همزات أو ألفات تحتاج توحيد" });
      return;
    }
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...updates } } : null);
    toast({ title: `✅ تم توحيد الهمزات في ${fixedCount} ترجمة`, description: `تم تصحيح ${fixedCount} إدخال تلقائياً` });
  }, [state]);

  const handleFixMixedLanguage = async () => {
    if (!state) return;
    setFixingMixed(true);
    setTranslateProgress("🌐 جاري إصلاح النصوص المختلطة...");
    try {
      const mixedEntries = state.entries
        .filter(e => { const key = `${e.msbtFile}:${e.index}`; const t = state.translations[key]; return t?.trim() && isMixedLanguage(t); })
        .map(e => ({ key: `${e.msbtFile}:${e.index}`, original: e.original, translation: state.translations[`${e.msbtFile}:${e.index}`] }));
      if (mixedEntries.length === 0) { setTranslateProgress("لا توجد نصوص مختلطة للإصلاح"); setTimeout(() => setTranslateProgress(""), 3000); return; }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const BATCH = 20;
      const allUpdates: Record<string, string> = {};
      let processed = 0;
      for (let i = 0; i < mixedEntries.length; i += BATCH) {
        const batch = mixedEntries.slice(i, i + BATCH);
        setTranslateProgress(`🌐 إصلاح النصوص المختلطة... ${processed}/${mixedEntries.length}`);
        const response = await fetch(`${supabaseUrl}/functions/v1/fix-mixed-language`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: batch, glossary: activeGlossary }),
        });
        if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || `خطأ ${response.status}`); }
        const data = await response.json();
        if (data.translations) {
          for (const [key, val] of Object.entries(data.translations)) {
            if (state.translations[key] !== val) {
              setPreviousTranslations(prev => ({ ...prev, [key]: state.translations[key] || '' }));
              allUpdates[key] = val as string;
            }
          }
        }
        processed += batch.length;
      }
      const fixedCount = Object.keys(allUpdates).length;
      if (fixedCount > 0) setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...allUpdates } } : null);
      setTranslateProgress(`✅ تم إصلاح ${fixedCount} ترجمة مختلطة اللغة`);
      setTimeout(() => setTranslateProgress(""), 4000);
    } catch (err) {
      setTranslateProgress(`❌ خطأ: ${err instanceof Error ? err.message : 'غير معروف'}`);
      setTimeout(() => setTranslateProgress(""), 4000);
    } finally { setFixingMixed(false); }
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
      const response = await fetch(`${supabaseUrl}/functions/v1/review-translations`, {
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
    setLastSaved(`✅ تم تطبيق ${Object.keys(updates).length} تحسين`);
    setTimeout(() => setLastSaved(""), 3000);
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
      const response = await fetch(`${supabaseUrl}/functions/v1/review-translations`, {
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

  // === Cloud save/load ===
  const handleCloudSave = async () => {
    if (!state || !user) return;
    setCloudSyncing(true); setCloudStatus("جاري الحفظ في السحابة...");
    try {
      const translated = Object.values(state.translations).filter(v => v.trim() !== '').length;
      const { data: existing } = await supabase.from('translation_projects').select('id').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1);
      if (existing && existing.length > 0) {
        await supabase.from('translation_projects').update({ translations: state.translations, entry_count: state.entries.length, translated_count: translated }).eq('id', existing[0].id);
      } else {
        await supabase.from('translation_projects').insert({ user_id: user.id, translations: state.translations, entry_count: state.entries.length, translated_count: translated });
      }
      setCloudStatus("☁️ تم الحفظ في السحابة بنجاح!");
    } catch (err) { setCloudStatus(`❌ ${err instanceof Error ? err.message : 'خطأ في الحفظ'}`); }
    finally { setCloudSyncing(false); setTimeout(() => setCloudStatus(""), 4000); }
  };

  const handleCloudLoad = async () => {
    if (!user) return;
    setCloudSyncing(true); setCloudStatus("جاري التحميل من السحابة...");
    try {
      const { data, error } = await supabase.from('translation_projects').select('translations').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!data) { setCloudStatus("لا توجد ترجمات محفوظة في السحابة"); setTimeout(() => setCloudStatus(""), 3000); return; }
      const cloudTranslations = data.translations as Record<string, string>;
      setState(prev => { if (!prev) return null; return { ...prev, translations: { ...prev.translations, ...cloudTranslations } }; });
      setCloudStatus(`☁️ تم تحميل ${Object.keys(cloudTranslations).length} ترجمة من السحابة`);
    } catch (err) { setCloudStatus(`❌ ${err instanceof Error ? err.message : 'خطأ في التحميل'}`); }
    finally { setCloudSyncing(false); setTimeout(() => setCloudStatus(""), 4000); }
  };


  const handleBulkReplace = useCallback((replacements: Record<string, string>) => {
    if (!state) return;
    const prev: Record<string, string> = {};
    for (const key of Object.keys(replacements)) {
      prev[key] = state.translations[key] || '';
    }
    setPreviousTranslations(p => ({ ...p, ...prev }));
    setState(s => s ? { ...s, translations: { ...s.translations, ...replacements } } : null);
    setLastSaved(`✅ تم استبدال ${Object.keys(replacements).length} نص`);
    setTimeout(() => setLastSaved(""), 3000);
  }, [state]);




  return {
    state, search, filterFile, filterCategory, filterStatus, filterTechnical, showFindReplace, userGeminiKey, translationEngine, isFilterActive, myMemoryEmail, myMemoryCharsUsed, myMemoryDailyLimit,
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
    fixingMixed, filtersOpen, buildStats, buildPreview, showBuildConfirm,
    categoryProgress, qualityStats, needsImproveCount, translatedCount, tagsCount, exportQualityReport,
    ...glossary,
    msbtFiles, filteredEntries, paginatedEntries, totalPages,
    user,

    // Setters
    setSearch, setFilterFile, setFilterCategory, setFilterStatus, toggleFilterStatus, clearFilterStatus, setFilterTechnical,
    setFiltersOpen, setShowQualityStats, setQuickReviewMode, setQuickReviewIndex, setShowFindReplace,
    setCurrentPage, setShowRetranslateConfirm, setShowPreview, setPreviewKey,
    setArabicNumerals, setMirrorPunctuation, setUserGeminiKey, setTranslationEngine, translationQuality, setTranslationQuality,
    setReviewResults, setShortSuggestions, setImproveResults, setBuildStats, setShowBuildConfirm,
    setMyMemoryEmail, setMyMemoryCharsUsed,

    // Handlers
    toggleProtection, toggleTechnicalBypass,
    handleProtectAllArabic, handleFixReversed, handleFixAllReversed,
    updateTranslation, handleUndoTranslation,
    handleTranslateSingle, handleAutoTranslate, handleStopTranslate,
    handleRetranslatePage, handleFixDamagedTags, handleLocalFixDamagedTag, handleLocalFixAllDamagedTags, handleRedistributeTags, handleReviewTranslations,
    handleSuggestShorterTranslations, handleApplyShorterTranslation, handleApplyAllShorterTranslations,
    handleFixAllStuckCharacters, handleFixMixedLanguage, handleFixAllPunctuation, handleFixAllBrackets,
    ...fileIO,
    handleImproveTranslations, handleApplyImprovement, handleApplyAllImprovements,
    handleImproveSingleTranslation,
    handleCloudSave, handleCloudLoad,
    handleApplyArabicProcessing, handlePreBuild, handleBuild, handleBulkReplace,

    // Quality helpers
    isTranslationTooShort, isTranslationTooLong, hasStuckChars, isMixedLanguage, needsImprovement,
  };
}
