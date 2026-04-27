import { useState, useMemo, useCallback } from "react";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { supabase } from "@/integrations/supabase/client";
import type { EditorState, ExtractedEntry } from "@/components/editor/types";
import type { GlossaryChange } from "@/components/editor/GlossaryApplyPreview";

interface UseEditorGlossaryProps {
  state: EditorState | null;
  setState: React.Dispatch<React.SetStateAction<EditorState | null>>;
  setLastSaved: (msg: string) => void;
  setCloudSyncing: (v: boolean) => void;
  setCloudStatus: (msg: string) => void;
  userId?: string;
}

export function useEditorGlossary({
  state, setState, setLastSaved, setCloudSyncing, setCloudStatus, userId,
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

    // Check each glossary term against entry originals
    const lowerOriginals = state.entries.map(e => e.original.toLowerCase());
    let matched = 0;
    const matchedTerms: { eng: string; arb: string }[] = [];
    const unmatchedTerms: { eng: string; arb: string }[] = [];
    for (const term of terms) {
      if (lowerOriginals.some(orig => orig.includes(term.eng))) {
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
      const response = await fetchWithTimeout(url);
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

  // === Generate preview of glossary changes (without applying) ===
  const generateGlossaryPreview = useCallback((entries: ExtractedEntry[], customGlossaryText?: string): GlossaryChange[] => {
    const glossaryText = customGlossaryText ?? state?.glossary;
    if (!glossaryText?.trim() || !entries?.length) return [];

    const glossaryMap = parseGlossaryMap(glossaryText);
    if (glossaryMap.size === 0) return [];

    const sortedTerms = Array.from(glossaryMap.entries()).sort((a, b) => b[0].length - a[0].length);
    const changes: GlossaryChange[] = [];

    for (const entry of entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = state?.translations[key]?.trim();
      if (!translation || translation === entry.original) continue;

      const origLower = entry.original.toLowerCase();
      let updated = translation;
      const replacedTerms: { eng: string; arb: string }[] = [];

      for (const [engTerm, arbTerm] of sortedTerms) {
        if (!origLower.includes(engTerm)) continue;
        if (updated.includes(arbTerm)) continue;
        const engRegex = new RegExp(engTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (engRegex.test(updated)) {
          updated = updated.replace(engRegex, arbTerm);
          replacedTerms.push({ eng: engTerm, arb: arbTerm });
        }
      }

      if (updated !== translation) {
        changes.push({
          key,
          msbtFile: entry.msbtFile,
          index: entry.index,
          original: entry.original,
          oldTranslation: translation,
          newTranslation: updated,
          replacedTerms,
        });
      }
    }

    return changes;
  }, [state, parseGlossaryMap]);

  // === Apply only approved changes ===
  const applyApprovedGlossaryChanges = useCallback((changes: GlossaryChange[], approvedKeys: Set<string>) => {
    if (approvedKeys.size === 0) return;

    const newTranslations = { ...state!.translations };
    let count = 0;

    for (const change of changes) {
      if (approvedKeys.has(change.key)) {
        newTranslations[change.key] = change.newTranslation;
        count++;
      }
    }

    setState(prev => prev ? { ...prev, translations: newTranslations } : null);
    setLastSaved(`✅ تم تطبيق التغييرات على ${count} ترجمة`);
    setTimeout(() => setLastSaved(""), 5000);
  }, [state, setState, setLastSaved]);

  // === Legacy direct apply (kept for backward compat but now generates preview) ===
  const handleApplyGlossaryToAll = useCallback(() => {
    if (!state?.entries) return;
    const changes = generateGlossaryPreview(state.entries);
    if (changes.length === 0) {
      setLastSaved('⚠️ لم يتم العثور على مصطلحات إنجليزية تحتاج استبدال');
      setTimeout(() => setLastSaved(""), 5000);
    }
    return changes;
  }, [state, generateGlossaryPreview, setLastSaved]);

  const handleApplyGlossaryToFiltered = useCallback((entries: ExtractedEntry[]) => {
    const changes = generateGlossaryPreview(entries);
    if (changes.length === 0) {
      setLastSaved('⚠️ لم يتم العثور على مصطلحات إنجليزية تحتاج استبدال في النصوص المفلترة');
      setTimeout(() => setLastSaved(""), 5000);
    }
    return changes;
  }, [generateGlossaryPreview, setLastSaved]);

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

  // Smart Glossary Suggestions: find repeated English terms (2+ words, appearing 3+ times) not in glossary
  const smartGlossarySuggestions = useMemo(() => {
    if (!state?.entries?.length) return [];
    const glossaryTerms = new Set<string>();
    if (state.glossary) {
      for (const line of state.glossary.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#') || t.startsWith('//')) continue;
        const eq = t.indexOf('=');
        if (eq < 1) continue;
        glossaryTerms.add(t.slice(0, eq).trim().toLowerCase());
      }
    }
    // Count multi-word phrases (2-4 words) appearing in originals
    const phraseCount = new Map<string, number>();
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'not', 'it', 'this', 'that', 'with', 'from', 'by', 'as', 'be', 'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'its']);
    for (const entry of state.entries) {
      const words = entry.original.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
      // Single meaningful words
      for (const w of words) {
        if (!glossaryTerms.has(w) && w.length > 3) {
          phraseCount.set(w, (phraseCount.get(w) || 0) + 1);
        }
      }
      // Two-word phrases
      for (let i = 0; i < words.length - 1; i++) {
        const phrase = `${words[i]} ${words[i + 1]}`;
        if (!glossaryTerms.has(phrase)) {
          phraseCount.set(phrase, (phraseCount.get(phrase) || 0) + 1);
        }
      }
    }
    // Return terms appearing 3+ times, sorted by frequency
    return Array.from(phraseCount.entries())
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([term, count]) => ({ term, count }));
  }, [state?.entries, state?.glossary]);

  const handleAddToGlossary = useCallback((term: string, translation: string) => {
    setState(prev => {
      if (!prev) return null;
      const newLine = `${term}=${translation}`;
      const currentGlossary = prev.glossary || '';
      return { ...prev, glossary: currentGlossary ? `${currentGlossary}\n${newLine}` : newLine };
    });
  }, [setState]);

  // Glossary Export as CSV or JSON
  const handleExportGlossary = useCallback((format: 'csv' | 'json') => {
    if (!state?.glossary?.trim()) return;
    const entries: { english: string; arabic: string }[] = [];
    for (const line of state.glossary.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || t.startsWith('//')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      entries.push({ english: t.slice(0, eq).trim(), arabic: t.slice(eq + 1).trim() });
    }
    let content: string;
    let mimeType: string;
    let ext: string;
    if (format === 'json') {
      content = JSON.stringify(entries, null, 2);
      mimeType = 'application/json';
      ext = 'json';
    } else {
      content = 'English,Arabic\n' + entries.map(e => `"${e.english.replace(/"/g, '""')}","${e.arabic.replace(/"/g, '""')}"`).join('\n');
      mimeType = 'text/csv';
      ext = 'csv';
    }
    const blob = new Blob(['\uFEFF' + content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glossary.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state?.glossary]);

  return {
    glossaryEnabled, setGlossaryEnabled,
    glossaryTermCount, activeGlossary, glossaryCoverage,
    parseGlossaryMap, getGlossaryContext,
    handleImportGlossary,
    handleLoadDefaultGlossary, handleLoadTOTKGlossary, handleLoadTOTKItemsGlossary,
    handleLoadMaterialsGlossary, handleLoadUIGlossary, handleLoadLocationsGlossary,
    handleLoadCreaturesGlossary, handleLoadAbilitiesGlossary,
    handleLoadAllGlossaries, handleApplyGlossaryToAll, handleApplyGlossaryToFiltered,
    generateGlossaryPreview, applyApprovedGlossaryChanges,
    handleSaveGlossaryToCloud, handleLoadGlossaryFromCloud,
    smartGlossarySuggestions, handleAddToGlossary, handleExportGlossary,
  };
}
