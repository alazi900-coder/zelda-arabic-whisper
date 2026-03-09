import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SHORTCUT_LIST } from "@/hooks/useKeyboardShortcuts";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsDialog({ open, onClose }: Props) {
  const grouped = SHORTCUT_LIST.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, typeof SHORTCUT_LIST>);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-sm font-display flex items-center gap-2">
            ⌨️ اختصارات لوحة المفاتيح
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            استخدم الاختصارات لتسريع عملك في المحرر
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {Object.entries(grouped).map(([category, shortcuts]) => (
            <div key={category}>
              <p className="text-xs font-semibold text-muted-foreground mb-2">{category}</p>
              <div className="space-y-1.5">
                {shortcuts.map(s => (
                  <div key={s.keys} className="flex items-center justify-between">
                    <span className="text-sm font-body">{s.description}</span>
                    <Badge variant="outline" className="text-[10px] font-mono px-2">{s.keys}</Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
