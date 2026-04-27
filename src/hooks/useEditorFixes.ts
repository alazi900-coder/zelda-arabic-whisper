import { useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { hasArabicPresentationForms, removeArabicPresentationForms } from "@/lib/arabic-processing";
import type { EditorState, ExtractedEntry } from "@/components/editor/types";
import type { FixPreviewItem } from "@/components/editor/FixPreviewDialog";

interface UseEditorFixesProps {
  state: EditorState | null;
  setState: React.Dispatch<React.SetStateAction<EditorState | null>>;
  setLastSaved: (msg: string) => void;
  setTranslateProgress: (msg: string) => void;
  setPreviousTranslations: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setFixPreview: (preview: { title: string; items: FixPreviewItem[]; updates: Record<string, string> } | null) => void;
  isMixedLanguage: (translation: string) => boolean;
  activeGlossary: string;
  showTimedMessage: (setter: (msg: string) => void, msg: string, duration?: number) => void;
}

export function useEditorFixes({
  state, setState, setLastSaved, setTranslateProgress, setPreviousTranslations,
  setFixPreview, isMixedLanguage, activeGlossary, showTimedMessage,
}: UseEditorFixesProps) {
  const [fixingMixed, setFixingMixed] = useState(false);

  const handleFixAllStuckCharacters = useCallback(() => {
    if (!state) return;
    let fixedCount = 0;
    const updates: Record<string, string> = {};
    for (const [key, translation] of Object.entries(state.translations)) {
      if (translation?.trim() && hasArabicPresentationForms(translation)) {
        const fixed = removeArabicPresentationForms(translation);
        if (fixed !== translation) { updates[key] = fixed; fixedCount++; }
      }
    }
    if (fixedCount === 0) { showTimedMessage(setLastSaved, "لا توجد ترجمات بها أحرف ملتصقة"); return; }
    setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...updates } } : null);
    showTimedMessage(setLastSaved, `✅ تم إصلاح ${fixedCount} ترجمة من الأحرف الملتصقة`);
  }, [state, setState, setLastSaved, showTimedMessage]);

  const handleFixAllPunctuation = useCallback(() => {
    if (!state) return;
    const updates: Record<string, string> = {};
    const items: FixPreviewItem[] = [];
    for (const entry of state.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = state.translations[key];
      if (!translation?.trim()) continue;
      const origEnd = entry.original.trim();
      let fixed = translation;
      if (origEnd.endsWith('?') && !fixed.trimEnd().endsWith('؟') && !fixed.trimEnd().endsWith('?')) {
        fixed = fixed.replace(/[.。،]+\s*$/, '') + '؟';
      } else if (origEnd.endsWith('!') && !fixed.trimEnd().endsWith('!')) {
        fixed = fixed.replace(/[.。،]+\s*$/, '') + '!';
      } else { continue; }
      if (fixed !== translation) {
        updates[key] = fixed;
        items.push({ key, label: entry.label, file: entry.msbtFile, oldText: translation, newText: fixed });
      }
    }
    if (items.length === 0) { toast({ title: "لا توجد علامات ترقيم مفقودة للإصلاح" }); return; }
    setFixPreview({ title: "إصلاح الترقيم", items, updates });
  }, [state, setFixPreview]);

  const handleFixAllBrackets = useCallback(() => {
    if (!state) return;
    const updates: Record<string, string> = {};
    const items: FixPreviewItem[] = [];
    for (const entry of state.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = state.translations[key];
      if (!translation?.trim()) continue;
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
      depth = 0;
      for (const ch of fixed) { if (ch === '[') depth++; else if (ch === ']') depth--; }
      if (depth > 0) fixed = fixed + ']'.repeat(depth);
      else if (depth < 0) fixed = '['.repeat(-depth) + fixed;
      for (const tag of origTags) { if (!fixed.includes(tag)) fixed = fixed.trimEnd() + ' ' + tag; }
      fixed = fixed.replace(/ {2,}/g, ' ');
      if (fixed !== translation) {
        updates[key] = fixed;
        items.push({ key, label: entry.label, file: entry.msbtFile, oldText: translation, newText: fixed });
      }
    }
    if (items.length === 0) { toast({ title: "لا توجد أقواس مكسورة للإصلاح" }); return; }
    setFixPreview({ title: "إصلاح الأقواس", items, updates });
  }, [state, setFixPreview]);

  const handleFixAllDiacritics = useCallback(() => {
    if (!state) return;
    const updates: Record<string, string> = {};
    const items: FixPreviewItem[] = [];
    const diacriticsRegex = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;
    for (const entry of state.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = state.translations[key];
      if (!translation?.trim()) continue;
      const fixed = translation.replace(diacriticsRegex, '');
      if (fixed !== translation) {
        updates[key] = fixed;
        items.push({ key, label: entry.label, file: entry.msbtFile, oldText: translation, newText: fixed });
      }
    }
    if (items.length === 0) { toast({ title: "لا توجد تشكيلات زائدة للإزالة" }); return; }
    setFixPreview({ title: "إزالة التشكيل", items, updates });
  }, [state, setFixPreview]);

  const handleFixAllSpaces = useCallback(() => {
    if (!state) return;
    const updates: Record<string, string> = {};
    const items: FixPreviewItem[] = [];
    for (const entry of state.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = state.translations[key];
      if (!translation?.trim()) continue;
      let fixed = translation;
      const tagPlaceholders: string[] = [];
      fixed = fixed.replace(/\[[^\]]*\]/g, (match) => { tagPlaceholders.push(match); return `\uFFFE${tagPlaceholders.length - 1}\uFFFE`; });
      fixed = fixed.replace(/ {2,}/g, ' ');
      fixed = fixed.replace(/ ([،؛؟!.,;?])/g, '$1');
      // eslint-disable-next-line no-control-regex
      fixed = fixed.replace(/([،؛؟!.,;?])([^\s\uFFFE،؛؟!.,;?\u0000-\u001F])/g, '$1 $2');
      fixed = fixed.replace(/\uFFFE(\d+)\uFFFE/g, (_, idx) => tagPlaceholders[parseInt(idx)]);
      fixed = fixed.trim();
      if (fixed !== translation) {
        updates[key] = fixed;
        items.push({ key, label: entry.label, file: entry.msbtFile, oldText: translation, newText: fixed });
      }
    }
    if (items.length === 0) { toast({ title: "لا توجد مسافات مزدوجة للإصلاح" }); return; }
    setFixPreview({ title: "إصلاح المسافات", items, updates });
  }, [state, setFixPreview]);

  const handleFixAllHamza = useCallback(() => {
    if (!state) return;
    const updates: Record<string, string> = {};
    const items: FixPreviewItem[] = [];
    for (const entry of state.entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = state.translations[key];
      if (!translation?.trim()) continue;
      let fixed = translation;
      fixed = fixed.replace(/[أإآ]/g, 'ا');
      // eslint-disable-next-line no-control-regex, no-useless-escape
      fixed = fixed.replace(/ى(?=[\s،؛؟!.,;?\]\[」』】）》〉\u0000-\u001F]|$)/g, 'ي');
      if (fixed !== translation) {
        updates[key] = fixed;
        items.push({ key, label: entry.label, file: entry.msbtFile, oldText: translation, newText: fixed });
      }
    }
    if (items.length === 0) { toast({ title: "لا توجد همزات أو ألفات تحتاج توحيد" }); return; }
    setFixPreview({ title: "توحيد الهمزات", items, updates });
  }, [state, setFixPreview]);

  const handleFixMixedLanguage = useCallback(async () => {
    if (!state) return;
    setFixingMixed(true);
    setTranslateProgress("🌐 جاري إصلاح النصوص المختلطة...");
    try {
      const mixedEntries = state.entries
        .filter(e => { const key = `${e.msbtFile}:${e.index}`; const t = state.translations[key]; return t?.trim() && isMixedLanguage(t); })
        .map(e => ({ key: `${e.msbtFile}:${e.index}`, original: e.original, translation: state.translations[`${e.msbtFile}:${e.index}`] }));
      if (mixedEntries.length === 0) { setTranslateProgress("لا توجد نصوص مختلطة للإصلاح"); setTimeout(() => setTranslateProgress(""), 3000); setFixingMixed(false); return; }
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
  }, [state, setState, setTranslateProgress, setPreviousTranslations, isMixedLanguage, activeGlossary]);

  return {
    fixingMixed,
    handleFixAllStuckCharacters,
    handleFixAllPunctuation,
    handleFixAllBrackets,
    handleFixAllDiacritics,
    handleFixAllSpaces,
    handleFixAllHamza,
    handleFixMixedLanguage,
  };
}
