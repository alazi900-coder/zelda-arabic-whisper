import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, ChevronDown, ChevronUp } from "lucide-react";
import type { ExtractedEntry } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  entry: ExtractedEntry;
  entries: ExtractedEntry[];
  translations: Record<string, string>;
  range?: number;
  onApplyTranslation?: (key: string, translation: string) => void;
}

// Detect dialogue speaker from file name or label
function detectSpeaker(entry: ExtractedEntry): string | null {
  const fileName = entry.msbtFile.toLowerCase();
  const npcMatch = fileName.match(/npc_(\w+)/i) || fileName.match(/(\w+)_dialog/i);
  if (npcMatch) return npcMatch[1].charAt(0).toUpperCase() + npcMatch[1].slice(1);

  if (fileName.includes('link')) return 'Link';
  if (fileName.includes('zelda')) return 'Zelda';
  if (fileName.includes('impa')) return 'Impa';
  if (fileName.includes('purah')) return 'Purah';
  if (fileName.includes('ganon')) return 'Ganon';
  if (fileName.includes('sidon')) return 'Sidon';
  if (fileName.includes('riju')) return 'Riju';
  if (fileName.includes('tulin')) return 'Tulin';
  if (fileName.includes('yunobo')) return 'Yunobo';

  return null;
}

// Detect scene type from file path
function detectSceneType(entry: ExtractedEntry): { icon: string; label: string } {
  const file = entry.msbtFile.toLowerCase();
  if (file.includes('eventflow') || file.includes('dialog')) return { icon: '💬', label: 'حوار' };
  if (file.includes('story') || file.includes('mainquest')) return { icon: '📖', label: 'قصة رئيسية' };
  if (file.includes('challenge') || file.includes('shrine')) return { icon: '⚔️', label: 'تحدي' };
  if (file.includes('layout') || file.includes('common')) return { icon: '🖥️', label: 'واجهة' };
  if (file.includes('actor')) return { icon: '👤', label: 'شخصية' };
  if (file.includes('tips') || file.includes('loading')) return { icon: '💡', label: 'نصائح' };
  if (file.includes('item') || file.includes('pouch')) return { icon: '🎒', label: 'عناصر' };
  return { icon: '📝', label: 'نص' };
}

export default function SceneContextPanel({ open, onClose, entry, entries, translations, range = 6 }: Props) {
  const [expandedRange, setExpandedRange] = useState(range);

  const contextEntries = useMemo(() => {
    const sameFile = entries
      .filter(e => e.msbtFile === entry.msbtFile)
      .sort((a, b) => a.index - b.index);

    const currentIdx = sameFile.findIndex(e => e.index === entry.index);
    if (currentIdx === -1) return [];

    const start = Math.max(0, currentIdx - expandedRange);
    const end = Math.min(sameFile.length, currentIdx + expandedRange + 1);

    return sameFile.slice(start, end).map(e => ({
      ...e,
      isCurrent: e.index === entry.index,
      key: `${e.msbtFile}:${e.index}`,
      speaker: detectSpeaker(e),
    }));
  }, [entry, entries, expandedRange]);

  const sceneType = detectSceneType(entry);
  const speaker = detectSpeaker(entry);

  // Calculate translation progress for this scene
  const sceneProgress = useMemo(() => {
    const sameFile = entries.filter(e => e.msbtFile === entry.msbtFile);
    const translated = sameFile.filter(e => {
      const k = `${e.msbtFile}:${e.index}`;
      const t = translations[k]?.trim();
      return t && t !== e.original;
    }).length;
    return { total: sameFile.length, translated, percent: sameFile.length > 0 ? Math.round((translated / sameFile.length) * 100) : 0 };
  }, [entry, entries, translations]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="w-[calc(100vw-1rem)] max-w-2xl h-[92dvh] sm:h-[85vh] max-h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden"
        dir="rtl"
      >
        <DialogHeader className="p-4 pb-2 border-b border-border/50 shrink-0">
          <DialogTitle className="text-sm font-display flex items-center gap-2 flex-wrap">
            🎬 سياق المشهد
            <Badge variant="secondary" className="text-[10px]">{sceneType.icon} {sceneType.label}</Badge>
            {speaker && (
              <Badge variant="outline" className="text-[10px] bg-primary/10">
                <User className="w-3 h-3 ml-1" /> {speaker}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span className="truncate max-w-[60%]" title={entry.msbtFile}>{entry.msbtFile}</span>
            <span className="text-[10px]">•</span>
            <span className="text-[10px] shrink-0">{sceneProgress.translated}/{sceneProgress.total} مترجم ({sceneProgress.percent}%)</span>
          </DialogDescription>
        </DialogHeader>

        {/* Scene flow visualization */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-3 space-y-1.5">
            {contextEntries.map((ce, idx) => {
              const translation = translations[ce.key]?.trim();
              const isTranslated = translation && translation !== ce.original;

              return (
                <div key={ce.key} className="relative">
                  {/* Connection line */}
                  {idx > 0 && (
                    <div className="absolute -top-1 right-4 w-px h-2 bg-border/40" />
                  )}

                  <div
                    className={`rounded-lg border p-2.5 transition-all ${
                      ce.isCurrent
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/40 shadow-md'
                        : 'border-border/30 hover:border-border/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {ce.speaker ? (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-accent/10">
                          {ce.speaker}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-mono">#{ce.index}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground truncate max-w-[40%]">{ce.label}</span>
                      {ce.isCurrent && (
                        <Badge variant="default" className="text-[9px] h-4 px-1.5">◀ الحالي</Badge>
                      )}
                      {!isTranslated && (
                        <span className="text-[9px] text-amber-500 mr-auto">⚠️ غير مترجم</span>
                      )}
                    </div>
                    <p className="text-xs text-foreground/80 mb-1 leading-relaxed" dir="ltr">{ce.original}</p>
                    {isTranslated ? (
                      <p className="text-xs text-primary/90 leading-relaxed" dir="rtl">
                        {translation}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground/50 italic">— غير مترجم —</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Expand range button */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => setExpandedRange(r => r + 5)}
                disabled={contextEntries.length >= entries.filter(e => e.msbtFile === entry.msbtFile).length}
              >
                <ChevronDown className="w-3 h-3" /> توسيع النطاق (+5)
              </Button>
              {expandedRange > range && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setExpandedRange(range)}
                >
                  <ChevronUp className="w-3 h-3" /> تقليص
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
