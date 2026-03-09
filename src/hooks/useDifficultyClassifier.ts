import { useMemo } from "react";
import type { ExtractedEntry } from "@/components/editor/types";
import { hasTechnicalTags, isTechnicalText } from "@/components/editor/types";

export type DifficultyLevel = 'simple' | 'medium' | 'complex';

export interface DifficultyInfo {
  level: DifficultyLevel;
  score: number;
  reasons: string[];
}

export function classifyDifficulty(entry: ExtractedEntry): DifficultyInfo {
  let score = 0;
  const reasons: string[] = [];
  const text = entry.original;

  // Length factor
  if (text.length > 200) { score += 3; reasons.push('نص طويل'); }
  else if (text.length > 80) { score += 1; reasons.push('نص متوسط'); }

  // Technical tags
  if (hasTechnicalTags(text)) { score += 2; reasons.push('يحتوي رموز تقنية'); }

  // Technical text
  if (isTechnicalText(text)) { score += 2; reasons.push('مصطلحات تقنية'); }

  // Multiple sentences
  const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 3);
  if (sentences.length > 3) { score += 2; reasons.push('جمل متعددة'); }

  // Game-specific names (capitalized words)
  const capitalWords = text.match(/\b[A-Z][a-z]{2,}\b/g);
  if (capitalWords && capitalWords.length > 3) { score += 1; reasons.push('أسماء خاصة متعددة'); }

  // Variables/placeholders
  const varCount = (text.match(/[\uFFF9-\uFFFC\uE000-\uF8FF]/g) || []).length;
  if (varCount > 4) { score += 2; reasons.push('متغيرات كثيرة'); }
  else if (varCount > 0) { score += 1; }

  // Dialogue markers
  if (text.includes('"') || text.includes("'")) { score += 1; reasons.push('حوار'); }

  // Line breaks
  if (text.includes('\n')) { score += 1; reasons.push('أسطر متعددة'); }

  const level: DifficultyLevel = score >= 5 ? 'complex' : score >= 2 ? 'medium' : 'simple';

  return { level, score, reasons };
}

export const DIFFICULTY_CONFIG: Record<DifficultyLevel, { label: string; emoji: string; color: string }> = {
  simple: { label: 'بسيط', emoji: '🟢', color: 'text-emerald-500' },
  medium: { label: 'متوسط', emoji: '🟡', color: 'text-amber-500' },
  complex: { label: 'معقد', emoji: '🔴', color: 'text-destructive' },
};

export function useDifficultyStats(entries: ExtractedEntry[]) {
  return useMemo(() => {
    const stats = { simple: 0, medium: 0, complex: 0 };
    for (const entry of entries) {
      const { level } = classifyDifficulty(entry);
      stats[level]++;
    }
    return stats;
  }, [entries]);
}
