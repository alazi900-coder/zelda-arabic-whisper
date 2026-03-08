import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, X } from "lucide-react";

export interface FixPreviewItem {
  key: string;
  label: string;
  file: string;
  oldText: string;
  newText: string;
}

interface FixPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  title: string;
  items: FixPreviewItem[];
}

/** Highlight differences between old and new text */
function DiffHighlight({ oldText, newText }: { oldText: string; newText: string }) {
  // Simple char-level diff: find common prefix and suffix, highlight the middle
  let prefixLen = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (prefixLen < minLen && oldText[prefixLen] === newText[prefixLen]) prefixLen++;

  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) suffixLen++;

  const oldChanged = oldText.slice(prefixLen, oldText.length - suffixLen);
  const newChanged = newText.slice(prefixLen, newText.length - suffixLen);
  const prefix = newText.slice(0, prefixLen);
  const suffix = newText.slice(newText.length - suffixLen);

  return (
    <div className="space-y-1">
      {/* Old */}
      <div className="text-xs font-body" dir="rtl">
        <span className="text-muted-foreground/60 text-[10px] ml-1">قبل:</span>
        <span>{prefix}</span>
        {oldChanged && (
          <span className="bg-destructive/20 text-destructive line-through rounded-sm px-0.5">
            {oldChanged || '∅'}
          </span>
        )}
        <span>{suffix}</span>
      </div>
      {/* New */}
      <div className="text-xs font-body" dir="rtl">
        <span className="text-muted-foreground/60 text-[10px] ml-1">بعد:</span>
        <span>{prefix}</span>
        {newChanged !== undefined && (
          <span className="bg-primary/20 text-primary font-bold rounded-sm px-0.5">
            {newChanged || '∅'}
          </span>
        )}
        <span>{suffix}</span>
      </div>
    </div>
  );
}

const FixPreviewDialog: React.FC<FixPreviewDialogProps> = ({
  open, onClose, onApply, title, items,
}) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            🔍 معاينة الإصلاحات — {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            سيتم تعديل {items.length} ترجمة. راجع التغييرات قبل التطبيق.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[55vh] border border-border rounded-md">
          <div className="divide-y divide-border">
            {items.map((item, i) => (
              <div key={item.key} className="p-3 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] text-muted-foreground font-mono bg-muted/30 px-1.5 py-0.5 rounded">
                    {i + 1}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                    {item.file}
                  </span>
                  <span className="text-[11px] text-muted-foreground/60 truncate">
                    {item.label}
                  </span>
                </div>
                <DiffHighlight oldText={item.oldText} newText={item.newText} />
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose} className="font-body">
            <X className="w-4 h-4 ml-1" /> إلغاء
          </Button>
          <Button onClick={onApply} className="font-body">
            <CheckCircle2 className="w-4 h-4 ml-1" /> تطبيق {items.length} إصلاح
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FixPreviewDialog;
