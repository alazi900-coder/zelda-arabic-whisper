import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, X, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  entryKey: string;
  notes: Record<string, string>;
  onUpdateNote: (key: string, note: string) => void;
}

export default function TranslatorNote({ entryKey, notes, onUpdateNote }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const existingNote = notes[entryKey] || "";

  const handleOpen = useCallback(() => {
    setDraft(existingNote);
    setEditing(true);
  }, [existingNote]);

  const handleSave = useCallback(() => {
    onUpdateNote(entryKey, draft.trim());
    setEditing(false);
    if (draft.trim()) {
      toast({ title: "📝 تم حفظ الملاحظة" });
    }
  }, [entryKey, draft, onUpdateNote]);

  if (editing) {
    return (
      <div className="mt-1.5 flex items-start gap-1.5">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="أضف ملاحظة للمترجم..."
          className="flex-1 px-2 py-1.5 rounded bg-background border border-border text-xs font-body resize-none min-h-[40px]"
          dir="rtl"
          autoFocus
          rows={2}
        />
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleSave}>
          <Save className="w-3.5 h-3.5 text-primary" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditing(false)}>
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  if (existingNote) {
    return (
      <button
        onClick={handleOpen}
        className="mt-1.5 w-full text-right rounded bg-accent/5 border border-accent/10 px-2 py-1 text-[10px] text-accent-foreground/70 hover:bg-accent/10 transition-colors"
        dir="rtl"
      >
        📝 {existingNote}
      </button>
    );
  }

  return (
    <button
      onClick={handleOpen}
      className="mt-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors flex items-center gap-1"
    >
      <MessageSquare className="w-3 h-3" /> ملاحظة
    </button>
  );
}
