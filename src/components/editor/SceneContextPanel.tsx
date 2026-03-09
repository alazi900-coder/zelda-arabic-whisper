import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { ExtractedEntry } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  entry: ExtractedEntry;
  entries: ExtractedEntry[];
  translations: Record<string, string>;
  range?: number;
}

export default function SceneContextPanel({ open, onClose, entry, entries, translations, range = 5 }: Props) {
  const contextEntries = useMemo(() => {
    // Find entries from the same file, sorted by index
    const sameFile = entries
      .filter(e => e.msbtFile === entry.msbtFile)
      .sort((a, b) => a.index - b.index);

    const currentIdx = sameFile.findIndex(e => e.index === entry.index);
    if (currentIdx === -1) return [];

    const start = Math.max(0, currentIdx - range);
    const end = Math.min(sameFile.length, currentIdx + range + 1);

    return sameFile.slice(start, end).map(e => ({
      ...e,
      isCurrent: e.index === entry.index,
      key: `${e.msbtFile}:${e.index}`,
    }));
  }, [entry, entries, range]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0" dir="rtl">
        <DialogHeader className="p-4 pb-2 border-b border-border/50">
          <DialogTitle className="text-sm font-display flex items-center gap-2">
            🎬 سياق المشهد
            <Badge variant="secondary" className="text-[10px]">{entry.msbtFile}</Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            النصوص المحيطة من نفس الملف لفهم سياق الحوار
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-1.5">
            {contextEntries.map(ce => {
              const translation = translations[ce.key]?.trim();
              return (
                <div
                  key={ce.key}
                  className={`rounded-lg border p-2.5 transition-colors ${
                    ce.isCurrent
                      ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/30'
                      : 'border-border/30 hover:border-border/60'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-muted-foreground font-mono">#{ce.index}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{ce.label}</span>
                    {ce.isCurrent && (
                      <Badge variant="default" className="text-[9px] h-4 px-1.5">الحالي</Badge>
                    )}
                  </div>
                  <p className="text-xs text-foreground/80 mb-1 leading-relaxed" dir="ltr">{ce.original}</p>
                  {translation && translation !== ce.original ? (
                    <p className="text-xs text-primary/80 leading-relaxed" dir="rtl">
                      {translation}
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground/50 italic">— غير مترجم —</p>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
