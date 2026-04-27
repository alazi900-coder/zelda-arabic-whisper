import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { EditorState } from "@/components/editor/types";

interface UseEditorCloudProps {
  state: EditorState | null;
  setState: React.Dispatch<React.SetStateAction<EditorState | null>>;
  user: User | null;
  setCloudSyncing: (v: boolean) => void;
  setCloudStatus: (msg: string) => void;
}

export function useEditorCloud({
  state, setState, user, setCloudSyncing, setCloudStatus,
}: UseEditorCloudProps) {

  const handleCloudSave = useCallback(async () => {
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
  }, [state, user, setCloudSyncing, setCloudStatus]);

  const handleCloudLoad = useCallback(async () => {
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
  }, [user, setState, setCloudSyncing, setCloudStatus]);

  return { handleCloudSave, handleCloudLoad };
}
