import { useState, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { ARABIC_REGEX } from "@/lib/arabic-processing";
import {
  ExtractedEntry, EditorState, AI_BATCH_SIZE,
  categorizeFile, isTechnicalText, hasTechnicalTags, restoreTagsLocally,
} from "@/components/editor/types";

interface UseEditorTranslationProps {
  state: EditorState | null;
  setState: React.Dispatch<React.SetStateAction<EditorState | null>>;
  setLastSaved: (msg: string) => void;
  setTranslateProgress: (msg: string) => void;
  setPreviousTranslations: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateTranslation: (key: string, value: string) => void;
  filterCategory: string;
  activeGlossary: string;
  parseGlossaryMap: (glossary: string) => Map<string, string>;
  paginatedEntries: ExtractedEntry[];
  userGeminiKey: string;
  userClaudeKey: string;
  translationEngine: 'gemini' | 'lovable' | 'mymemory' | 'google' | 'claude' | 'bedrock';
  translationQuality: 'fast' | 'quality';
  geminiModel?: 'gemini-2.0-flash' | 'gemini-2.5-flash' | 'gemini-2.5-pro';
  filteredEntries: ExtractedEntry[];
  isFilterActive: boolean;
  myMemoryEmail: string;
  myMemoryCharsUsed: number;
  setMyMemoryCharsUsed: React.Dispatch<React.SetStateAction<number>>;
  myMemoryDailyLimit: number;
  customPromptInstructions?: string;
  userBedrockApiKey: string;
  userBedrockRegion: string;
  bedrockModel: string;
  bedrockProxyUrl: string;
}

export function useEditorTranslation({
  state, setState, setLastSaved, setTranslateProgress, setPreviousTranslations, updateTranslation,
  filterCategory, activeGlossary, parseGlossaryMap, paginatedEntries, userGeminiKey, userClaudeKey, translationEngine, translationQuality,
  geminiModel,
  filteredEntries, isFilterActive, myMemoryEmail, myMemoryCharsUsed, setMyMemoryCharsUsed, myMemoryDailyLimit,
  customPromptInstructions,
  userBedrockApiKey, userBedrockRegion, bedrockModel, bedrockProxyUrl,
}: UseEditorTranslationProps) {
  const [translating, setTranslating] = useState(false);
  const [translatingSingle, setTranslatingSingle] = useState<string | null>(null);
  const [tmStats, setTmStats] = useState<{ reused: number; sent: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Page translation compare state (ported from Xenoblade)
  const [showPageCompare, setShowPageCompare] = useState(false);
  const [pendingPageTranslations, setPendingPageTranslations] = useState<Record<string, string>>({});
  const [oldPageTranslations, setOldPageTranslations] = useState<Record<string, string>>({});
  const [pageTranslationOriginals, setPageTranslationOriginals] = useState<Record<string, string>>({});

  /** Auto-fix: restore any tags the AI dropped from translations.
   *  Uses the provided entryMap for O(1) lookups instead of stale state reference. */
  const autoFixTags = (translations: Record<string, string>, entryMap?: Map<string, ExtractedEntry>): Record<string, string> => {
    const lookup = entryMap || (state ? new Map(state.entries.map(e => [`${e.msbtFile}:${e.index}`, e])) : null);
    if (!lookup) return translations;
    const fixed: Record<string, string> = {};
    for (const [key, trans] of Object.entries(translations)) {
      const entry = lookup.get(key);
      if (entry && hasTechnicalTags(entry.original)) {
        fixed[key] = restoreTagsLocally(entry.original, trans);
      } else {
        fixed[key] = trans;
      }
    }
    return fixed;
  };

  const handleTranslateSingle = async (entry: ExtractedEntry) => {
    if (!state) return;
    const key = `${entry.msbtFile}:${entry.index}`;
    setTranslatingSingle(key);
    try {
      const glossaryMap = parseGlossaryMap(activeGlossary);
      const originalNorm = entry.original.trim().toLowerCase();
      const glossaryHit = glossaryMap.get(originalNorm);
      if (glossaryHit) {
        updateTranslation(key, glossaryHit);
        setLastSaved(`📖 ترجمة مباشرة من القاموس (بدون ذكاء اصطناعي)`);
        setTimeout(() => setLastSaved(""), 3000);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const idx = state.entries.indexOf(entry);
      const contextEntries = [-3, -2, -1, 1, 2, 3]
        .map(offset => state.entries[idx + offset])
        .filter(n => n && state.translations[`${n.msbtFile}:${n.index}`]?.trim())
        .map(n => ({ key: `${n.msbtFile}:${n.index}`, original: n.original, translation: state.translations[`${n.msbtFile}:${n.index}`] }));
      const entryCategory = categorizeFile(entry.msbtFile, entry.label);

      const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/translate-entries`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: [{ key, original: entry.original, label: entry.label, maxBytes: entry.maxBytes }],
          glossary: activeGlossary,
          context: contextEntries.length > 0 ? contextEntries : undefined,
          userApiKey: userGeminiKey || undefined,
          userClaudeKey: userClaudeKey || undefined,
          userBedrockApiKey: userBedrockApiKey || undefined,
          userBedrockRegion: userBedrockRegion || undefined,
          userBedrockModel: bedrockModel || undefined,
          bedrockProxyUrl: bedrockProxyUrl || undefined,
          translationEngine,
          translationQuality,
          geminiModel,
          myMemoryEmail: myMemoryEmail || undefined,
          category: entryCategory,
          filePath: entry.msbtFile,
          extraInstructions: customPromptInstructions || undefined,
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `خطأ ${response.status}`);
      }
      const data = await response.json();
      if (data.translations && data.translations[key]) {
        let translated = data.translations[key];
        if (hasTechnicalTags(entry.original)) {
          translated = restoreTagsLocally(entry.original, translated);
        }
        updateTranslation(key, translated);
      }
    } catch (err) { console.error('Single translate error:', err); }
    finally { setTranslatingSingle(null); }
  };

  const handleAutoTranslate = async () => {
    if (!state) return;
    const arabicRegex = ARABIC_REGEX;
    let skipEmpty = 0, skipArabic = 0, skipTechnical = 0, skipTranslated = 0;
    
    // Use filtered entries when a filter is active, otherwise use all entries
    const sourceEntries = isFilterActive ? filteredEntries : state.entries;
    
    const untranslated = sourceEntries.filter(e => {
      const key = `${e.msbtFile}:${e.index}`;
      if (!e.original.trim()) { skipEmpty++; return false; }
      if (arabicRegex.test(e.original)) { skipArabic++; return false; }
      if (isTechnicalText(e.original) && !state.technicalBypass?.has(key)) { skipTechnical++; return false; }
      if (state.translations[key]?.trim()) { skipTranslated++; return false; }
      return true;
    });

    if (untranslated.length === 0) {
      const reasons: string[] = [];
      if (isFilterActive) reasons.push(`🔍 الفلتر نشط — ${sourceEntries.length} نص محدد`);
      if (skipArabic > 0) reasons.push(`${skipArabic} نص عربي أصلاً`);
      if (skipTechnical > 0) reasons.push(`${skipTechnical} نص تقني`);
      if (skipTranslated > 0) reasons.push(`${skipTranslated} مترجم بالفعل`);
      setTranslateProgress(`✅ لا توجد نصوص تحتاج ترجمة${reasons.length > 0 ? ` (${reasons.join('، ')})` : ''}`);
      setTimeout(() => setTranslateProgress(""), 5000);
      return;
    }

    // Build entry lookup map once for O(1) access
    const entryMap = new Map(state.entries.map(e => [`${e.msbtFile}:${e.index}`, e]));

    // Translation Memory
    const tmMap = new Map<string, string>();
    for (const [key, val] of Object.entries(state.translations)) {
      if (val.trim()) {
        const entry = entryMap.get(key);
        if (entry) {
          const norm = entry.original.trim().toLowerCase();
          if (!tmMap.has(norm)) tmMap.set(norm, val);
        }
      }
    }
    const tmReused: Record<string, string> = {};
    const afterTM: typeof untranslated = [];
    for (const e of untranslated) {
      const norm = e.original.trim().toLowerCase();
      const cached = tmMap.get(norm);
      if (cached) { tmReused[`${e.msbtFile}:${e.index}`] = cached; }
      else { afterTM.push(e); }
    }

    // Glossary direct translation (free, no AI)
    const glossaryMap = parseGlossaryMap(activeGlossary);
    const glossaryReused: Record<string, string> = {};
    const needsAI: typeof untranslated = [];
    for (const e of afterTM) {
      const norm = e.original.trim().toLowerCase();
      const glossaryHit = glossaryMap.get(norm);
      if (glossaryHit) { glossaryReused[`${e.msbtFile}:${e.index}`] = glossaryHit; }
      else { needsAI.push(e); }
    }

    const freeTranslations = { ...tmReused, ...glossaryReused };
    if (Object.keys(freeTranslations).length > 0) {
      setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...freeTranslations } } : null);
    }
    const tmCount = Object.keys(tmReused).length;
    const glossaryCount = Object.keys(glossaryReused).length;
    setTmStats({ reused: tmCount + glossaryCount, sent: needsAI.length });
    if (needsAI.length === 0) {
      const parts: string[] = [];
      if (tmCount > 0) parts.push(`${tmCount} من الذاكرة`);
      if (glossaryCount > 0) parts.push(`${glossaryCount} من القاموس 📖`);
      setTranslateProgress(`✅ تم ترجمة ${tmCount + glossaryCount} نص مجاناً (${parts.join(' + ')}) — لا حاجة للذكاء الاصطناعي!`);
      setTimeout(() => setTranslateProgress(""), 5000);
      return;
    }

    setTranslating(true);
    const totalBatches = Math.ceil(needsAI.length / AI_BATCH_SIZE);
    let allTranslations: Record<string, string> = {};
    abortControllerRef.current = new AbortController();

    try {
      for (let b = 0; b < totalBatches; b++) {
        if (abortControllerRef.current.signal.aborted) {
          setTranslateProgress("⏹️ تم إيقاف الترجمة");
          setTimeout(() => setTranslateProgress(""), 3000);
          break;
        }
        const batch = needsAI.slice(b * AI_BATCH_SIZE, (b + 1) * AI_BATCH_SIZE);
        setTranslateProgress(`🔄 ترجمة الدفعة ${b + 1}/${totalBatches} (${batch.length} نص)...`);

        const entries = batch.map(e => ({ key: `${e.msbtFile}:${e.index}`, original: e.original, label: e.label, maxBytes: e.maxBytes }));
        const contextEntries: { key: string; original: string; translation?: string }[] = [];
        const contextKeys = new Set<string>();
        for (const e of batch) {
          const idx = state.entries.indexOf(e);
          for (const offset of [-3, -2, -1, 1, 2, 3]) {
            const neighbor = state.entries[idx + offset];
            if (neighbor) {
              const nKey = `${neighbor.msbtFile}:${neighbor.index}`;
              if (!contextKeys.has(nKey) && state.translations[nKey]?.trim()) {
                contextKeys.add(nKey);
                contextEntries.push({ key: nKey, original: neighbor.original, translation: state.translations[nKey] });
              }
            }
          }
        }

        // Detect category from first entry in batch
        const batchCategory = categorizeFile(batch[0].msbtFile, batch[0].label);
        const batchFilePath = batch[0].msbtFile;

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        let response: Response;
        let retries = 0;
        const maxRetries = 3;
        while (true) {
          response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/translate-entries`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' },
            signal: abortControllerRef.current.signal,
            body: JSON.stringify({
              entries,
              glossary: activeGlossary,
              context: contextEntries.length > 0 ? contextEntries.slice(0, 15) : undefined,
              userApiKey: userGeminiKey || undefined,
              userClaudeKey: userClaudeKey || undefined,
              userBedrockApiKey: userBedrockApiKey || undefined,
              userBedrockRegion: userBedrockRegion || undefined,
              userBedrockModel: bedrockModel || undefined,
              bedrockProxyUrl: bedrockProxyUrl || undefined,
              translationEngine,
              translationQuality,
          geminiModel,
              myMemoryEmail: myMemoryEmail || undefined,
              category: batchCategory,
              filePath: batchFilePath,
              extraInstructions: customPromptInstructions || undefined,
            }),
          });
          if (response.status === 429 && retries < maxRetries) {
            retries++;
            const waitSec = retries * 20;
            setTranslateProgress(`⏳ حد الطلبات — انتظار ${waitSec} ثانية ثم إعادة المحاولة (${retries}/${maxRetries})...`);
            await new Promise(r => setTimeout(r, waitSec * 1000));
            continue;
          }
          break;
        }
        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error || `خطأ ${response.status}`);
        }
        const data = await response.json();
        if (data.translations) {
          const fixedTranslations = autoFixTags(data.translations, entryMap);
          allTranslations = { ...allTranslations, ...fixedTranslations };
          setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...fixedTranslations } } : null);
        }
        if (data.warning) {
          console.warn('Translation warning:', data.warning);
        }
        if (data.charsUsed) {
          setMyMemoryCharsUsed(prev => {
            const next = prev + data.charsUsed;
            try {
              localStorage.setItem('myMemoryCharsUsed', String(next));
              if (!localStorage.getItem('myMemoryResetTime')) {
                localStorage.setItem('myMemoryResetTime', String(Date.now() + 86400000));
              }
            } catch {}
            return next;
          });
        }
        // Delay between batches to avoid rate limits (especially Gemini free tier: 15 req/min)
        if (b < totalBatches - 1 && (translationEngine === 'gemini' || userGeminiKey)) {
          await new Promise(r => setTimeout(r, 5000));
        }
      }
      if (!abortControllerRef.current?.signal.aborted) {
        const total = Object.keys(allTranslations).length;
        setTranslateProgress(`✅ تم ترجمة ${total} نص بنجاح${tmCount > 0 ? ` + ${tmCount} من الذاكرة` : ''}`);
        setTimeout(() => setTranslateProgress(""), 5000);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setTranslateProgress("⏹️ تم إيقاف الترجمة يدوياً");
        setTimeout(() => setTranslateProgress(""), 4000);
      } else {
        const savedCount = Object.keys(allTranslations).length;
        const errMsg = err instanceof Error ? err.message : 'خطأ في الترجمة';
        setTranslateProgress(`❌ ${errMsg}${savedCount > 0 ? ` (تم حفظ ${savedCount} نص قبل الخطأ)` : ''}`);
        setTimeout(() => setTranslateProgress(""), 5000);
      }
    } finally {
      setTranslating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopTranslate = () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };

  const handleRetranslatePage = async () => {
    if (!state) return;
    const entriesToRetranslate = paginatedEntries.filter(e => {
      const key = `${e.msbtFile}:${e.index}`;
      return state.translations[key]?.trim() && !isTechnicalText(e.original);
    });
    if (entriesToRetranslate.length === 0) {
      setTranslateProgress("⚠️ لا توجد ترجمات في هذه الصفحة لإعادة ترجمتها");
      setTimeout(() => setTranslateProgress(""), 3000);
      return;
    }
    const prevTrans: Record<string, string> = {};
    for (const e of entriesToRetranslate) {
      const key = `${e.msbtFile}:${e.index}`;
      prevTrans[key] = state.translations[key] || '';
    }
    setPreviousTranslations(old => ({ ...old, ...prevTrans }));
    setTranslating(true);
    abortControllerRef.current = new AbortController();
    try {
      const totalBatches = Math.ceil(entriesToRetranslate.length / AI_BATCH_SIZE);
      for (let b = 0; b < totalBatches; b++) {
        if (abortControllerRef.current.signal.aborted) {
          setTranslateProgress("⏹️ تم إيقاف إعادة الترجمة");
          setTimeout(() => setTranslateProgress(""), 3000);
          break;
        }
        const batch = entriesToRetranslate.slice(b * AI_BATCH_SIZE, (b + 1) * AI_BATCH_SIZE);
        setTranslateProgress(`🔄 إعادة ترجمة الدفعة ${b + 1}/${totalBatches} (${batch.length} نص)...`);
        const entries = batch.map(e => ({ key: `${e.msbtFile}:${e.index}`, original: e.original, label: e.label, maxBytes: e.maxBytes }));
        const contextEntries: { key: string; original: string; translation?: string }[] = [];
        const contextKeys = new Set<string>();
        for (const e of batch) {
          const idx = state.entries.indexOf(e);
          for (const offset of [-3, -2, -1, 1, 2, 3]) {
            const neighbor = state.entries[idx + offset];
            if (neighbor) {
              const nKey = `${neighbor.msbtFile}:${neighbor.index}`;
              if (!contextKeys.has(nKey) && state.translations[nKey]?.trim()) {
                contextKeys.add(nKey);
                contextEntries.push({ key: nKey, original: neighbor.original, translation: state.translations[nKey] });
              }
            }
          }
        }
        const batchCategory = categorizeFile(batch[0].msbtFile, batch[0].label);
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/translate-entries`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' },
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({
            entries,
            glossary: activeGlossary,
            context: contextEntries.length > 0 ? contextEntries.slice(0, 15) : undefined,
            userApiKey: userGeminiKey || undefined,
            userClaudeKey: userClaudeKey || undefined,
            userBedrockApiKey: userBedrockApiKey || undefined,
            userBedrockRegion: userBedrockRegion || undefined,
            userBedrockModel: bedrockModel || undefined,
            bedrockProxyUrl: bedrockProxyUrl || undefined,
            translationEngine,
            translationQuality,
          geminiModel,
            myMemoryEmail: myMemoryEmail || undefined,
            category: batchCategory,
            filePath: batch[0].msbtFile,
            extraInstructions: customPromptInstructions || undefined,
          }),
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error || `خطأ ${response.status}`);
        }
        const data = await response.json();
        if (data.translations) {
          const fixedTranslations = autoFixTags(data.translations);
          setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...fixedTranslations } } : null);
        }
      }
      setTranslateProgress(`✅ تم إعادة ترجمة ${entriesToRetranslate.length} نص في هذه الصفحة`);
      setTimeout(() => setTranslateProgress(""), 4000);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setTranslateProgress(`❌ خطأ: ${err instanceof Error ? err.message : 'غير معروف'}`);
        setTimeout(() => setTranslateProgress(""), 4000);
      }
    } finally { setTranslating(false); }
  };

  const handleFixDamagedTags = async (damagedTagKeys: Set<string>) => {
    if (!state || damagedTagKeys.size === 0) return;
    const entriesToFix = state.entries.filter(e => {
      const key = `${e.msbtFile}:${e.index}`;
      return damagedTagKeys.has(key);
    });
    if (entriesToFix.length === 0) return;

    // Save previous translations for undo
    const prevTrans: Record<string, string> = {};
    for (const e of entriesToFix) {
      const key = `${e.msbtFile}:${e.index}`;
      prevTrans[key] = state.translations[key] || '';
    }
    setPreviousTranslations(old => ({ ...old, ...prevTrans }));

    setTranslating(true);
    abortControllerRef.current = new AbortController();
    let fixedCount = 0;
    try {
      const totalBatches = Math.ceil(entriesToFix.length / AI_BATCH_SIZE);
      for (let b = 0; b < totalBatches; b++) {
        if (abortControllerRef.current.signal.aborted) break;
        const batch = entriesToFix.slice(b * AI_BATCH_SIZE, (b + 1) * AI_BATCH_SIZE);
        setTranslateProgress(`🔧 إصلاح الرموز التالفة ${b + 1}/${totalBatches} (${batch.length} نص)...`);
        const entries = batch.map(e => ({ key: `${e.msbtFile}:${e.index}`, original: e.original }));
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/translate-entries`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' },
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({ entries, glossary: activeGlossary, userApiKey: userGeminiKey || undefined, userClaudeKey: userClaudeKey || undefined, userBedrockApiKey: userBedrockApiKey || undefined, userBedrockRegion: userBedrockRegion || undefined, userBedrockModel: bedrockModel || undefined, bedrockProxyUrl: bedrockProxyUrl || undefined, translationEngine, translationQuality, geminiModel, myMemoryEmail: myMemoryEmail || undefined, extraInstructions: customPromptInstructions || undefined }),
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error || `خطأ ${response.status}`);
        }
        const data = await response.json();
        if (data.translations) {
          const fixedTranslations = autoFixTags(data.translations);
          fixedCount += Object.keys(fixedTranslations).length;
          setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...fixedTranslations } } : null);
        }
      }
      setTranslateProgress(`✅ تم إصلاح ${fixedCount} نص تالف بنجاح`);
      toast({ title: "✅ تم الإصلاح", description: `تم إصلاح ${fixedCount} نص تالف وإعادة ترجمته بنجاح` });
      setTimeout(() => setTranslateProgress(""), 5000);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : 'غير معروف';
        setTranslateProgress(`❌ خطأ: ${msg}`);
        toast({ title: "❌ فشل الإصلاح", description: msg, variant: "destructive" });
        setTimeout(() => setTranslateProgress(""), 4000);
      }
    } finally { setTranslating(false); }
  };

  /**
   * Translate current (possibly filtered) page with compare dialog.
   * - memoryOnly=true → use TM + Glossary only, no AI
   * - forceRetranslate=true → re-translate even entries that already have a translation
   * On completion, shows PageTranslationCompare dialog; user picks which translations to apply.
   */
  const handleTranslatePage = async (forceRetranslate = false, memoryOnly = false) => {
    if (!state) return;
    const arabicRegex = ARABIC_REGEX;
    let skipEmpty = 0, skipArabic = 0, skipTechnical = 0, skipTranslated = 0;
    const candidates = paginatedEntries.filter(e => {
      const key = `${e.msbtFile}:${e.index}`;
      if (!e.original.trim()) { skipEmpty++; return false; }
      if (arabicRegex.test(e.original)) { skipArabic++; return false; }
      if (isTechnicalText(e.original) && !state.technicalBypass?.has(key)) { skipTechnical++; return false; }
      if (!forceRetranslate && state.translations[key]?.trim()) { skipTranslated++; return false; }
      return true;
    });

    if (candidates.length === 0 && skipTranslated > 0 && !forceRetranslate) {
      const confirmed = window.confirm(
        `✅ الصفحة مترجمة بالكامل (${skipTranslated} نص مترجم).\n\nهل تريد إعادة ترجمتها؟`
      );
      if (confirmed) return handleTranslatePage(true, memoryOnly);
      return;
    }

    if (candidates.length === 0) {
      const reasons: string[] = [];
      if (skipArabic > 0) reasons.push(`${skipArabic} نص عربي أصلاً`);
      if (skipTechnical > 0) reasons.push(`${skipTechnical} نص تقني`);
      setTranslateProgress(`✅ لا توجد نصوص تحتاج ترجمة في هذه الصفحة${reasons.length > 0 ? ` (${reasons.join('، ')})` : ''}`);
      setTimeout(() => setTranslateProgress(""), 5000);
      return;
    }

    const oldTrans: Record<string, string> = {};
    const originalsMap: Record<string, string> = {};
    for (const e of candidates) {
      const key = `${e.msbtFile}:${e.index}`;
      oldTrans[key] = state.translations[key] || '';
      originalsMap[key] = e.original;
    }

    if (memoryOnly) {
      // TM + Glossary only — no AI
      const tmMap = new Map<string, string>();
      for (const [key, val] of Object.entries(state.translations)) {
        if (val.trim()) {
          const entry = state.entries.find(e => `${e.msbtFile}:${e.index}` === key);
          if (entry) {
            const norm = entry.original.trim().toLowerCase();
            if (!tmMap.has(norm)) tmMap.set(norm, val);
          }
        }
      }
      const tmReused: Record<string, string> = {};
      const afterTM: typeof candidates = [];
      for (const e of candidates) {
        const norm = e.original.trim().toLowerCase();
        const cached = tmMap.get(norm);
        if (cached) tmReused[`${e.msbtFile}:${e.index}`] = cached;
        else afterTM.push(e);
      }

      const glossaryMap = parseGlossaryMap(activeGlossary);
      const glossaryReused: Record<string, string> = {};
      const remaining: typeof candidates = [];
      for (const e of afterTM) {
        const norm = e.original.trim().toLowerCase();
        const hit = glossaryMap.get(norm);
        if (hit) glossaryReused[`${e.msbtFile}:${e.index}`] = hit;
        else remaining.push(e);
      }

      const free = { ...tmReused, ...glossaryReused };
      const totalFree = Object.keys(free).length;
      const tmCount = Object.keys(tmReused).length;
      const glossaryCount = Object.keys(glossaryReused).length;
      setTmStats({ reused: tmCount + glossaryCount, sent: 0 });

      if (totalFree > 0) {
        setOldPageTranslations(oldTrans);
        setPageTranslationOriginals(originalsMap);
        setPendingPageTranslations(autoFixTags(free));
        setShowPageCompare(true);
      }
      const parts: string[] = [];
      if (tmCount > 0) parts.push(`${tmCount} من الذاكرة`);
      if (glossaryCount > 0) parts.push(`${glossaryCount} من القاموس 📖`);
      if (totalFree === 0) {
        setTranslateProgress(`⚠️ لم يجد أي تطابق في الذاكرة أو القاموس (${candidates.length} نص يحتاج ذكاء اصطناعي)`);
      } else if (remaining.length > 0) {
        setTranslateProgress(`✅ تم ترجمة ${totalFree} نص مجاناً (${parts.join(' + ')}) — تم تخطي ${remaining.length} نص (بدون ذكاء اصطناعي)`);
      } else {
        setTranslateProgress(`✅ تم ترجمة ${totalFree} نص مجاناً (${parts.join(' + ')}) — لا حاجة للذكاء الاصطناعي!`);
      }
      setTimeout(() => setTranslateProgress(""), 5000);
      return;
    }

    // AI mode: translate in batches
    const PAGE_AI_BATCH = 10;
    setTmStats({ reused: 0, sent: candidates.length });
    setTranslating(true);
    const allTranslations: Record<string, string> = {};
    abortControllerRef.current = new AbortController();

    const entryMap = new Map(state.entries.map(e => [`${e.msbtFile}:${e.index}`, e]));

    try {
      const totalBatches = Math.ceil(candidates.length / PAGE_AI_BATCH);
      for (let b = 0; b < totalBatches; b++) {
        if (abortControllerRef.current.signal.aborted) {
          setTranslateProgress("⏹️ تم إيقاف الترجمة");
          setTimeout(() => setTranslateProgress(""), 3000);
          break;
        }
        const batch = candidates.slice(b * PAGE_AI_BATCH, (b + 1) * PAGE_AI_BATCH);
        setTranslateProgress(`🔄 ترجمة الدفعة ${b + 1}/${totalBatches} (${batch.length} نص)...`);

        const entries = batch.map(e => ({ key: `${e.msbtFile}:${e.index}`, original: e.original, label: e.label, maxBytes: e.maxBytes }));
        const batchCategory = categorizeFile(batch[0].msbtFile, batch[0].label);
        const batchFilePath = batch[0].msbtFile;

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/translate-entries`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey, 'Content-Type': 'application/json' },
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({
            entries,
            glossary: activeGlossary,
            userApiKey: userGeminiKey || undefined,
            userClaudeKey: userClaudeKey || undefined,
            userBedrockApiKey: userBedrockApiKey || undefined,
            userBedrockRegion: userBedrockRegion || undefined,
            userBedrockModel: bedrockModel || undefined,
            bedrockProxyUrl: bedrockProxyUrl || undefined,
            translationEngine,
            translationQuality,
          geminiModel,
            myMemoryEmail: myMemoryEmail || undefined,
            category: batchCategory,
            filePath: batchFilePath,
            extraInstructions: customPromptInstructions || undefined,
          }),
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error || `خطأ ${response.status}`);
        }
        const data = await response.json();
        if (data.translations) {
          const fixed = autoFixTags(data.translations, entryMap);
          for (const [k, v] of Object.entries(fixed)) allTranslations[k] = v;
        }
        if (data.charsUsed) {
          setMyMemoryCharsUsed(prev => {
            const next = prev + data.charsUsed;
            try {
              localStorage.setItem('myMemoryCharsUsed', String(next));
              if (!localStorage.getItem('myMemoryResetTime')) {
                localStorage.setItem('myMemoryResetTime', String(Date.now() + 86400000));
              }
            } catch {}
            return next;
          });
        }
      }

      if (Object.keys(allTranslations).length > 0) {
        setOldPageTranslations(oldTrans);
        setPageTranslationOriginals(originalsMap);
        setPendingPageTranslations(allTranslations);
        setShowPageCompare(true);
        setTranslateProgress(`✅ تم ترجمة ${Object.keys(allTranslations).length} نص — راجع النتائج`);
        setTimeout(() => setTranslateProgress(""), 5000);
      } else if (!abortControllerRef.current?.signal.aborted) {
        setTranslateProgress(`⚠️ لم يتم ترجمة أي نص`);
        setTimeout(() => setTranslateProgress(""), 5000);
      }
    } catch (err) {
      // Even on abort/error, show what we got so user doesn't lose progress
      if (Object.keys(allTranslations).length > 0) {
        setOldPageTranslations(oldTrans);
        setPageTranslationOriginals(originalsMap);
        setPendingPageTranslations(allTranslations);
        setShowPageCompare(true);
      }
      if ((err as Error).name === 'AbortError') {
        setTranslateProgress(`⏹️ تم إيقاف الترجمة${Object.keys(allTranslations).length > 0 ? ` — ${Object.keys(allTranslations).length} نص جاهز للمراجعة` : ' يدوياً'}`);
      } else {
        const errMsg = err instanceof Error ? err.message : 'خطأ في الترجمة';
        setTranslateProgress(`❌ ${errMsg}${Object.keys(allTranslations).length > 0 ? ` (${Object.keys(allTranslations).length} نص جاهز للمراجعة)` : ''}`);
      }
      setTimeout(() => setTranslateProgress(""), 5000);
    } finally {
      setTranslating(false);
      abortControllerRef.current = null;
    }
  };

  /**
   * Translate current (possibly filtered) page from glossary only — no TM, no AI.
   */
  const handleTranslateFromGlossaryOnly = (forceRetranslate = false) => {
    if (!state) return;
    const arabicRegex = ARABIC_REGEX;
    let skipTranslated = 0;
    const candidates = paginatedEntries.filter(e => {
      const key = `${e.msbtFile}:${e.index}`;
      if (!e.original.trim()) return false;
      if (arabicRegex.test(e.original)) return false;
      if (isTechnicalText(e.original) && !state.technicalBypass?.has(key)) return false;
      if (!forceRetranslate && state.translations[key]?.trim()) { skipTranslated++; return false; }
      return true;
    });
    if (candidates.length === 0 && skipTranslated > 0 && !forceRetranslate) {
      const confirmed = window.confirm(
        `✅ الصفحة مترجمة بالكامل (${skipTranslated} نص مترجم).\n\nهل تريد إعادة الترجمة من القاموس؟`
      );
      if (confirmed) return handleTranslateFromGlossaryOnly(true);
      return;
    }
    if (candidates.length === 0) {
      setTranslateProgress(`✅ لا توجد نصوص غير مترجمة في هذه الصفحة`);
      setTimeout(() => setTranslateProgress(""), 4000);
      return;
    }
    const oldTrans: Record<string, string> = {};
    const originalsMap: Record<string, string> = {};
    for (const e of candidates) {
      const key = `${e.msbtFile}:${e.index}`;
      oldTrans[key] = state.translations[key] || '';
      originalsMap[key] = e.original;
    }
    const glossaryMap = parseGlossaryMap(activeGlossary);
    const hits: Record<string, string> = {};
    for (const e of candidates) {
      const norm = e.original.trim().toLowerCase();
      const hit = glossaryMap.get(norm);
      if (hit) hits[`${e.msbtFile}:${e.index}`] = hit;
    }
    if (Object.keys(hits).length === 0) {
      setTranslateProgress(`⚠️ لم يجد أي تطابق في القاموس (${candidates.length} نص)`);
      setTimeout(() => setTranslateProgress(""), 4000);
      return;
    }
    setOldPageTranslations(oldTrans);
    setPageTranslationOriginals(originalsMap);
    setPendingPageTranslations(autoFixTags(hits));
    setShowPageCompare(true);
    setTranslateProgress(`✅ ${Object.keys(hits).length} ترجمة من القاموس 📖 — راجع النتائج`);
    setTimeout(() => setTranslateProgress(""), 5000);
  };

  /** Apply selected pending page translations. */
  const applyPageTranslations = (selectedKeys: Set<string>) => {
    const toApply: Record<string, string> = {};
    for (const key of selectedKeys) {
      if (pendingPageTranslations[key] !== undefined) toApply[key] = pendingPageTranslations[key];
    }
    if (Object.keys(toApply).length > 0) {
      // Save old translations for undo
      const prev: Record<string, string> = {};
      for (const key of Object.keys(toApply)) {
        prev[key] = oldPageTranslations[key] || '';
      }
      setPreviousTranslations(old => ({ ...old, ...prev }));
      setState(prev2 => prev2 ? { ...prev2, translations: { ...prev2.translations, ...toApply } } : null);
      setLastSaved(`✅ تم تطبيق ${Object.keys(toApply).length} ترجمة`);
      setTimeout(() => setLastSaved(""), 3000);
    }
    setShowPageCompare(false);
    setPendingPageTranslations({});
    setOldPageTranslations({});
    setPageTranslationOriginals({});
  };

  /** Discard all pending page translations. */
  const discardPageTranslations = () => {
    setShowPageCompare(false);
    setPendingPageTranslations({});
    setOldPageTranslations({});
    setPageTranslationOriginals({});
    setLastSaved(`🗑️ تم تجاهل الترجمات المقترحة`);
    setTimeout(() => setLastSaved(""), 3000);
  };

  return {
    translating,
    translatingSingle,
    tmStats,
    handleTranslateSingle,
    handleAutoTranslate,
    handleStopTranslate,
    handleRetranslatePage,
    handleFixDamagedTags,
    handleTranslatePage,
    handleTranslateFromGlossaryOnly,
    showPageCompare,
    pendingPageTranslations,
    oldPageTranslations,
    pageTranslationOriginals,
    applyPageTranslations,
    discardPageTranslations,
  };
}
