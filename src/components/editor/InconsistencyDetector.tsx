import React, { useMemo, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Copy, Wand2, Loader2, Check } from "lucide-react";
import type { ExtractedEntry } from "./types";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface InconsistencyGroup {
  englishTerm: string;
  variants: { arabicText: string; keys: string[]; count: number }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  entries: ExtractedEntry[];
  translations: Record<string, string>;
  glossary?: string;
  onJumpToEntry?: (key: string) => void;
}

export default function InconsistencyDetector({ open, onClose, entries, translations, glossary, onJumpToEntry }: Props) {
  const [minOccurrences, setMinOccurrences] = useState(2);

  const inconsistencies = useMemo(() => {
    if (!entries?.length) return [];

    // Parse glossary for reference terms
    const glossaryTerms = new Map<string, string>();
    if (glossary?.trim()) {
      for (const line of glossary.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#') || t.startsWith('//')) continue;
        const eq = t.indexOf('=');
        if (eq < 1) continue;
        const eng = t.slice(0, eq).trim().toLowerCase();
        const arb = t.slice(eq + 1).trim();
        if (eng && arb) glossaryTerms.set(eng, arb);
      }
    }

    // Find English words/phrases that appear multiple times in source
    // and have different Arabic translations
    const termTranslationMap = new Map<string, Map<string, string[]>>();

    // Extract significant English words (3+ chars) from each entry
    for (const entry of entries) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = translations[key]?.trim();
      if (!translation || translation === entry.original) continue;

      // Extract words (lowercase)
      const words = entry.original.toLowerCase().match(/[a-z]{3,}/g);
      if (!words) continue;

      // For single-word entries, use the whole original as term
      const origLower = entry.original.toLowerCase().trim();
      if (origLower.length <= 30 && /^[a-z\s]+$/i.test(origLower)) {
        if (!termTranslationMap.has(origLower)) termTranslationMap.set(origLower, new Map());
        const variants = termTranslationMap.get(origLower)!;
        const transNorm = translation.trim();
        if (!variants.has(transNorm)) variants.set(transNorm, []);
        variants.get(transNorm)!.push(key);
      }

      // Also check glossary terms
      for (const [gTerm] of glossaryTerms) {
        if (origLower.includes(gTerm) && gTerm.length >= 3) {
          if (!termTranslationMap.has(gTerm)) termTranslationMap.set(gTerm, new Map());
          // We can't precisely extract which Arabic word maps to this term,
          // so we'll track the full translation for context
        }
      }
    }

    // Find terms with multiple different translations
    const groups: InconsistencyGroup[] = [];

    for (const [term, variantsMap] of termTranslationMap) {
      if (variantsMap.size < 2) continue; // No inconsistency

      const totalCount = Array.from(variantsMap.values()).reduce((sum, keys) => sum + keys.length, 0);
      if (totalCount < minOccurrences) continue;

      const variants = Array.from(variantsMap.entries())
        .map(([arabicText, keys]) => ({ arabicText, keys, count: keys.length }))
        .sort((a, b) => b.count - a.count);

      groups.push({ englishTerm: term, variants });
    }

    // Sort by number of variants (most inconsistent first)
    groups.sort((a, b) => b.variants.length - a.variants.length);

    return groups.slice(0, 100);
  }, [entries, translations, glossary, minOccurrences]);

  const glossaryRef = useMemo(() => {
    const map = new Map<string, string>();
    if (glossary?.trim()) {
      for (const line of glossary.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#') || t.startsWith('//')) continue;
        const eq = t.indexOf('=');
        if (eq < 1) continue;
        map.set(t.slice(0, eq).trim().toLowerCase(), t.slice(eq + 1).trim());
      }
    }
    return map;
  }, [glossary]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0" dir="rtl">
        <DialogHeader className="p-4 pb-2 border-b border-border/50">
          <DialogTitle className="text-sm font-display flex items-center gap-2">
            🔍 كشف التناقضات
            <Badge variant={inconsistencies.length > 0 ? "destructive" : "secondary"} className="text-[10px]">
              {inconsistencies.length} تناقض
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            مصطلحات إنجليزية مترجمة بطرق مختلفة في أماكن متعددة
          </DialogDescription>
        </DialogHeader>

        {inconsistencies.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-primary/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد تناقضات واضحة — الترجمات متسقة 👏</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 space-y-3">
              {inconsistencies.map((group, gi) => {
                const glossaryTranslation = glossaryRef.get(group.englishTerm);
                return (
                  <div key={gi} className="rounded-lg border border-border/50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="text-sm font-semibold font-mono" dir="ltr">
                        {group.englishTerm}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-4">
                        {group.variants.length} نسخة مختلفة
                      </Badge>
                      {glossaryTranslation && (
                        <Badge variant="default" className="text-[10px] h-4 px-1.5">
                          📖 {glossaryTranslation}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {group.variants.map((v, vi) => (
                        <div key={vi} className="flex items-center gap-2 text-xs">
                          <span className={`px-2 py-1 rounded border ${
                            glossaryTranslation && v.arabicText.includes(glossaryTranslation)
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'border-border/30 bg-muted/30'
                          }`}>
                            {v.arabicText.length > 60 ? v.arabicText.slice(0, 60) + '...' : v.arabicText}
                          </span>
                          <Badge variant="secondary" className="text-[10px] h-4 shrink-0">
                            ×{v.count}
                          </Badge>
                          {onJumpToEntry && v.keys[0] && (
                            <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]"
                              onClick={() => { onJumpToEntry(v.keys[0]); onClose(); }}>
                              عرض
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
