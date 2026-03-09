import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EditorState, ExtractedEntry } from "@/components/editor/types";

interface UseEditorGlossaryProps {
  state: EditorState | null;
  setState: React.Dispatch<React.SetStateAction<EditorState | null>>;
  setLastSaved: (msg: string) => void;
  setCloudSyncing: (v: boolean) => void;
  setCloudStatus: (msg: string) => void;
  userId?: string;
  filteredEntries?: ExtractedEntry[];
  isFilterActive?: boolean;
}

export function useEditorGlossary({
  state, setState, setLastSaved, setCloudSyncing, setCloudStatus, userId, filteredEntries, isFilterActive,
}: UseEditorGlossaryProps) {
  const [glossaryEnabled, setGlossaryEnabled] = useState(true);

  // === Computed ===
  const glossaryTermCount = useMemo(() => {
    if (!state?.glossary?.trim()) return 0;
    return state.glossary.split('\n').filter(l => {
      const t = l.trim();
      return t && !t.startsWith('#') && !t.startsWith('//') && t.includes('=');
    }).length;
  }, [state?.glossary]);

  const activeGlossary = glossaryEnabled ? (state?.glossary || '') : '';

  // === Coverage stats: how many glossary terms appear in loaded entries ===
  const glossaryCoverage = useMemo(() => {
    if (!state?.glossary?.trim() || !state?.entries?.length) return null;
    const terms: { eng: string; arb: string }[] = [];
    for (const line of state.glossary.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || t.startsWith('//')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const eng = t.slice(0, eq).trim();
      const arb = t.slice(eq + 1).trim();
      if (eng && arb) terms.push({ eng: eng.toLowerCase(), arb });
    }
    if (terms.length === 0) return null;

    // Build a combined text from all original entries for fast lookup
    const allOriginals = state.entries.map(e => e.original.toLowerCase()).join(' \n ');

    let matched = 0;
    const matchedTerms: { eng: string; arb: string }[] = [];
    const unmatchedTerms: { eng: string; arb: string }[] = [];
    for (const term of terms) {
      if (allOriginals.includes(term.eng)) {
        matched++;
        if (matchedTerms.length < 20) matchedTerms.push(term);
      } else {
        if (unmatchedTerms.length < 10) unmatchedTerms.push(term);
      }
    }

    // Check how many translated entries use glossary terms correctly
    let translatedWithGlossary = 0;
    let translatedTotal = 0;
    for (const entry of state.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = state.translations[key]?.trim();
      if (!translation || translation === entry.original) continue;
      translatedTotal++;
      const origLower = entry.original.toLowerCase();
      for (const term of terms) {
        if (origLower.includes(term.eng) && translation.includes(term.arb)) {
          translatedWithGlossary++;
          break;
        }
      }
    }

    return {
      totalTerms: terms.length,
      matchedInSource: matched,
      coveragePercent: Math.round((matched / terms.length) * 100),
      translatedWithGlossary,
      translatedTotal,
      consistencyPercent: translatedTotal > 0 ? Math.round((translatedWithGlossary / translatedTotal) * 100) : 0,
      topMatched: matchedTerms,
      topUnmatched: unmatchedTerms,
    };
  }, [state?.glossary, state?.entries, state?.translations]);

  // === Parse glossary into lookup map (exact match) ===
  const parseGlossaryMap = useCallback((glossaryText: string): Map<string, string> => {
    const map = new Map<string, string>();
    if (!glossaryText?.trim()) return map;
    for (const line of glossaryText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 1) continue;
      const eng = trimmed.slice(0, eqIdx).trim();
      const arb = trimmed.slice(eqIdx + 1).trim();
      if (eng && arb) {
        map.set(eng.toLowerCase(), arb);
      }
    }
    return map;
  }, []);

  // === Parse glossary for partial matching (used in AI context injection) ===
  const getGlossaryContext = useCallback((text: string, glossaryText: string): string => {
    if (!glossaryText?.trim() || !text?.trim()) return '';
    const textLower = text.toLowerCase();
    const hints: string[] = [];
    for (const line of glossaryText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 1) continue;
      const eng = trimmed.slice(0, eqIdx).trim();
      const arb = trimmed.slice(eqIdx + 1).trim();
      if (!eng || !arb) continue;
      if (textLower.includes(eng.toLowerCase())) {
        hints.push(`${eng}=${arb}`);
      }
    }
    return hints.slice(0, 15).join('\n');
  }, []);

  // === Merge helper with validation and dedup ===
  const mergeGlossaryText = (prev: EditorState, newText: string): EditorState => {
    const existing = prev.glossary?.trim() || '';
    const merged = existing ? existing + '\n' + newText : newText;
    const seen = new Map<string, string>();
    let skipped = 0;
    for (const line of merged.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 1) { skipped++; continue; }
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!key || !val) { skipped++; continue; }
      // Keep the latest version (new overwrites old)
      seen.set(key.toLowerCase(), `${key}=${val}`);
    }
    return { ...prev, glossary: Array.from(seen.values()).join('\n') };
  };

  // === Import from file ===
  const handleImportGlossary = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.csv,.json';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      try {
        let newTerms = '';
        for (const file of Array.from(files)) {
          const text = await file.text();
          newTerms += (newTerms ? '\n' : '') + text;
        }
        // Validate and count valid terms
        const validLines = newTerms.split('\n').filter(l => {
          const t = l.trim();
          if (!t || t.startsWith('#') || t.startsWith('//')) return false;
          const eqIdx = t.indexOf('=');
          if (eqIdx < 1) return false;
          const key = t.slice(0, eqIdx).trim();
          const val = t.slice(eqIdx + 1).trim();
          return key.length > 0 && val.length > 0;
        });
        const invalidLines = newTerms.split('\n').filter(l => {
          const t = l.trim();
          return t && !t.startsWith('#') && !t.startsWith('//') && !t.includes('=');
        }).length;

        setState(prev => {
          if (!prev) return null;
          return mergeGlossaryText(prev, newTerms);
        });
        const fileNames = Array.from(files).map(f => f.name).join('، ');
        let msg = `📖 تم دمج ${validLines.length} مصطلح من (${fileNames})`;
        if (invalidLines > 0) msg += ` — ⚠️ ${invalidLines} سطر غير صالح تم تجاهله`;
        setLastSaved(msg);
        setTimeout(() => setLastSaved(""), 5000);
      } catch { alert('خطأ في قراءة الملف'); }
    };
    input.click();
  };

  // === Load from URL ===
  const loadGlossary = useCallback(async (url: string, name: string, replace = false) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('فشل تحميل القاموس');
      const text = await response.text();
      const validCount = text.split('\n').filter(l => {
        const t = l.trim();
        if (!t || t.startsWith('#') || t.startsWith('//')) return false;
        const eq = t.indexOf('=');
        return eq > 0 && t.slice(0, eq).trim() && t.slice(eq + 1).trim();
      }).length;
      if (replace) {
        setState(prev => prev ? { ...prev, glossary: text } : null);
      } else {
        setState(prev => prev ? mergeGlossaryText(prev, text) : null);
      }
      setLastSaved(`📖 تم ${replace ? 'تحميل' : 'دمج'} ${name} (${validCount} مصطلح صالح)`);
      setTimeout(() => setLastSaved(""), 3000);
    } catch { alert(`خطأ في تحميل ${name}`); }
  }, [setState, setLastSaved]);

  const handleLoadDefaultGlossary = useCallback(() => loadGlossary('/zelda-glossary.txt', 'القاموس الافتراضي', true), [loadGlossary]);
  const handleLoadTOTKGlossary = useCallback(() => loadGlossary('/zelda-totk-glossary.txt', 'قاموس TOTK'), [loadGlossary]);
  const handleLoadTOTKItemsGlossary = useCallback(() => loadGlossary('/zelda-totk-items-glossary.txt', 'قاموس العناصر'), [loadGlossary]);
  const handleLoadMaterialsGlossary = useCallback(() => loadGlossary('/zelda-materials-glossary.txt', 'قاموس المواد والأسلحة'), [loadGlossary]);
  const handleLoadUIGlossary = useCallback(() => loadGlossary('/zelda-ui-glossary.txt', 'قاموس الواجهة والقوائم'), [loadGlossary]);
  const handleLoadLocationsGlossary = useCallback(() => loadGlossary('/zelda-locations-characters-glossary.txt', 'قاموس المواقع والشخصيات'), [loadGlossary]);
  const handleLoadCreaturesGlossary = useCallback(() => loadGlossary('/zelda-creatures-glossary.txt', 'قاموس المخلوقات والوحوش'), [loadGlossary]);
  const handleLoadAbilitiesGlossary = useCallback(() => loadGlossary('/zelda-abilities-glossary.txt', 'قاموس القدرات والتأثيرات'), [loadGlossary]);

  const handleLoadAllGlossaries = async () => {
    try {
      const urls = [
        '/zelda-glossary.txt', '/zelda-totk-glossary.txt', '/zelda-totk-items-glossary.txt',
        '/zelda-materials-glossary.txt', '/zelda-ui-glossary.txt', '/zelda-locations-characters-glossary.txt',
        '/zelda-creatures-glossary.txt', '/zelda-abilities-glossary.txt',
      ];
      const responses = await Promise.all(urls.map(u => fetch(u)));
      const failedUrls = urls.filter((_, i) => !responses[i].ok);
      if (failedUrls.length > 0) {
        alert(`فشل تحميل: ${failedUrls.join(', ')}`);
        // Continue with successful ones
      }
      const texts = await Promise.all(responses.map((r, i) => r.ok ? r.text() : Promise.resolve('')));
      const combined = texts.filter(Boolean).join('\n');
      // Use replace mode for "load all" to ensure clean state
      setState(prev => {
        if (!prev) return null;
        return mergeGlossaryText({ ...prev, glossary: '' }, combined);
      });
      // Count after dedup
      const dedupedCount = combined.split('\n').filter(l => {
        const t = l.trim();
        if (!t || t.startsWith('#') || t.startsWith('//')) return false;
        return t.includes('=');
      }).length;
      setLastSaved(`📖 تم تحميل جميع القواميس (${dedupedCount} مصطلح — بعد إزالة التكرار)`);
      setTimeout(() => setLastSaved(""), 4000);
    } catch { alert('خطأ في تحميل القواميس'); }
  };

  // === Apply glossary terms to all translations for consistency ===
  const handleApplyGlossaryToAll = useCallback(() => {
    if (!state?.glossary?.trim() || !state?.entries?.length) return;

    const glossaryMap = parseGlossaryMap(state.glossary);
    if (glossaryMap.size === 0) return;

    // Sort terms by length descending so longer terms are matched first
    const sortedTerms = Array.from(glossaryMap.entries()).sort((a, b) => b[0].length - a[0].length);

    const newTranslations = { ...state.translations };
    let appliedCount = 0;
    let entriesAffected = 0;

    for (const entry of state.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = newTranslations[key]?.trim();
      if (!translation || translation === entry.original) continue;

      const origLower = entry.original.toLowerCase();
      let updated = translation;

      for (const [engTerm, arbTerm] of sortedTerms) {
        if (!origLower.includes(engTerm)) continue;
        // Already contains the correct Arabic term
        if (updated.includes(arbTerm)) continue;

        // Find common wrong translations of this term in the text
        // Use word-boundary-aware replacement: find the English term if it leaked into Arabic text
        const engRegex = new RegExp(engTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (engRegex.test(updated)) {
          updated = updated.replace(engRegex, arbTerm);
          appliedCount++;
        }
      }

      if (updated !== translation) {
        newTranslations[key] = updated;
        entriesAffected++;
      }
    }

    setState(prev => prev ? { ...prev, translations: newTranslations } : null);
    setLastSaved(
      appliedCount > 0
        ? `✅ تم تطبيق ${appliedCount} مصطلح على ${entriesAffected} ترجمة`
        : '⚠️ لم يتم العثور على مصطلحات إنجليزية تحتاج استبدال'
    );
    setTimeout(() => setLastSaved(""), 5000);
  }, [state, parseGlossaryMap, setState, setLastSaved]);

  // === Apply glossary terms to filtered translations only ===
  const handleApplyGlossaryToFiltered = useCallback(() => {
    if (!state?.glossary?.trim() || !filteredEntries?.length) return;

    const glossaryMap = parseGlossaryMap(state.glossary);
    if (glossaryMap.size === 0) return;

    const sortedTerms = Array.from(glossaryMap.entries()).sort((a, b) => b[0].length - a[0].length);

    const newTranslations = { ...state.translations };
    let appliedCount = 0;
    let entriesAffected = 0;

    for (const entry of filteredEntries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = newTranslations[key]?.trim();
      if (!translation || translation === entry.original) continue;

      const origLower = entry.original.toLowerCase();
      let updated = translation;

      for (const [engTerm, arbTerm] of sortedTerms) {
        if (!origLower.includes(engTerm)) continue;
        if (updated.includes(arbTerm)) continue;
        const engRegex = new RegExp(engTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (engRegex.test(updated)) {
          updated = updated.replace(engRegex, arbTerm);
          appliedCount++;
        }
      }

      if (updated !== translation) {
        newTranslations[key] = updated;
        entriesAffected++;
      }
    }

    setState(prev => prev ? { ...prev, translations: newTranslations } : null);
    setLastSaved(
      appliedCount > 0
        ? `✅ تم تطبيق ${appliedCount} مصطلح على ${entriesAffected} ترجمة (مفلترة)`
        : '⚠️ لم يتم العثور على مصطلحات إنجليزية تحتاج استبدال في النصوص المفلترة'
    );
    setTimeout(() => setLastSaved(""), 5000);
  }, [state, filteredEntries, parseGlossaryMap, setState, setLastSaved]);

  // === Cloud glossary ===
  const handleSaveGlossaryToCloud = async () => {
    if (!state || !userId || !state.glossary) { setCloudStatus('❌ لا يوجد قاموس لحفظه'); setTimeout(() => setCloudStatus(""), 3000); return; }
    setCloudSyncing(true); setCloudStatus('جاري حفظ القاموس...');
    try {
      const { error } = await supabase.from('glossaries').insert({ user_id: userId, name: 'قاموسي', content: state.glossary }).select().single();
      if (error) throw error;
      setCloudStatus(`✅ تم حفظ القاموس في السحابة (${state.glossary.split('\n').filter(l => l.includes('=') && l.trim()).length} مصطلح)`);
      setTimeout(() => setCloudStatus(""), 3000);
    } catch (error) { console.error('خطأ في حفظ القاموس:', error); setCloudStatus('❌ فشل حفظ القاموس في السحابة'); setTimeout(() => setCloudStatus(""), 3000); }
    finally { setCloudSyncing(false); }
  };

  const handleLoadGlossaryFromCloud = async () => {
    if (!userId) { setCloudStatus('❌ يجب تسجيل الدخول أولاً'); setTimeout(() => setCloudStatus(""), 3000); return; }
    setCloudSyncing(true); setCloudStatus('جاري تحميل القاموس من السحابة...');
    try {
      const { data, error } = await supabase.from('glossaries').select('content').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!data) { setCloudStatus('❌ لم يتم العثور على قاموس محفوظ'); setTimeout(() => setCloudStatus(""), 3000); return; }
      setState(prev => prev ? { ...prev, glossary: data.content } : null);
      setCloudStatus(`✅ تم تحميل القاموس من السحابة (${data.content.split('\n').filter(l => l.includes('=') && l.trim()).length} مصطلح)`);
      setTimeout(() => setCloudStatus(""), 3000);
    } catch (error) { console.error('خطأ في تحميل القاموس من السحابة:', error); setCloudStatus('❌ فشل تحميل القاموس من السحابة'); setTimeout(() => setCloudStatus(""), 3000); }
    finally { setCloudSyncing(false); }
  };

  return {
    glossaryEnabled, setGlossaryEnabled,
    glossaryTermCount, activeGlossary, glossaryCoverage,
    parseGlossaryMap, getGlossaryContext,
    handleImportGlossary,
    handleLoadDefaultGlossary, handleLoadTOTKGlossary, handleLoadTOTKItemsGlossary,
    handleLoadMaterialsGlossary, handleLoadUIGlossary, handleLoadLocationsGlossary,
    handleLoadCreaturesGlossary, handleLoadAbilitiesGlossary,
    handleLoadAllGlossaries, handleApplyGlossaryToAll,
    handleSaveGlossaryToCloud, handleLoadGlossaryFromCloud,
  };
}
