import { useMemo } from "react";
import type { ExtractedEntry } from "@/components/editor/types";
import { hasTechnicalTags, isTechnicalText } from "@/components/editor/types";

export type DifficultyLevel = 'simple' | 'medium' | 'complex';

export interface DifficultyInfo {
  level: DifficultyLevel;
  score: number;
  reasons: string[];
  estimatedMinutes: number;
}

// Common Zelda proper nouns that need cultural context
const ZELDA_CULTURAL_TERMS = /\b(Triforce|Master Sword|Sheikah|Gerudo|Zonai|Korok|Goron|Zora|Rito|Purah|Impa|Ganondorf|Malice|Gloom|Calamity|Divine Beast|Ancient|Guardian|Lynel|Hinox|Molduga|Talus)\b/i;

// Idiomatic expressions that are hard to translate
const IDIOMATIC_PATTERNS = /\b(it's time to|once upon a|in the blink of|at the end of the day|the last straw|bite the bullet|break a leg|by the skin of)\b/i;

// Emotional/poetic language markers
const EMOTIONAL_MARKERS = /\b(alas|behold|forsooth|thy|thou|hark|o mighty|brave hero|ancient prophecy|eternal|destiny|fate|legend)\b/i;

export function classifyDifficulty(entry: ExtractedEntry): DifficultyInfo {
  let score = 0;
  const reasons: string[] = [];
  const text = entry.original;

  // Length factor (progressive)
  if (text.length > 300) { score += 4; reasons.push('نص طويل جداً'); }
  else if (text.length > 200) { score += 3; reasons.push('نص طويل'); }
  else if (text.length > 80) { score += 1; reasons.push('نص متوسط'); }

  // Technical tags
  if (hasTechnicalTags(text)) { score += 2; reasons.push('يحتوي رموز تقنية'); }

  // Technical text
  if (isTechnicalText(text)) { score += 2; reasons.push('مصطلحات تقنية'); }

  // Multiple sentences
  const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 3);
  if (sentences.length > 5) { score += 3; reasons.push('فقرة كاملة'); }
  else if (sentences.length > 3) { score += 2; reasons.push('جمل متعددة'); }

  // Game-specific names (capitalized words)
  const capitalWords = text.match(/\b[A-Z][a-z]{2,}\b/g);
  if (capitalWords && capitalWords.length > 5) { score += 2; reasons.push('أسماء خاصة كثيرة'); }
  else if (capitalWords && capitalWords.length > 3) { score += 1; reasons.push('أسماء خاصة متعددة'); }

  // Variables/placeholders
  const varCount = (text.match(/[\uFFF9-\uFFFC\uE000-\uF8FF]/g) || []).length;
  if (varCount > 6) { score += 3; reasons.push('متغيرات كثيرة جداً'); }
  else if (varCount > 4) { score += 2; reasons.push('متغيرات كثيرة'); }
  else if (varCount > 0) { score += 1; }

  // Dialogue markers
  if (text.includes('"') || text.includes("'")) { score += 1; reasons.push('حوار'); }

  // Line breaks
  const lineBreaks = (text.match(/\n/g) || []).length;
  if (lineBreaks > 3) { score += 2; reasons.push('أسطر متعددة'); }
  else if (lineBreaks > 0) { score += 1; }

  // Cultural/Zelda terms requiring localization knowledge
  const culturalMatches = text.match(new RegExp(ZELDA_CULTURAL_TERMS.source, 'gi'));
  if (culturalMatches && culturalMatches.length > 2) { score += 2; reasons.push('مصطلحات ثقافية'); }
  else if (culturalMatches && culturalMatches.length > 0) { score += 1; reasons.push('اسم خاص بالعالم'); }

  // Idiomatic expressions
  if (IDIOMATIC_PATTERNS.test(text)) { score += 2; reasons.push('تعبير اصطلاحي'); }

  // Emotional/poetic language
  const emotionalMatches = text.match(new RegExp(EMOTIONAL_MARKERS.source, 'gi'));
  if (emotionalMatches && emotionalMatches.length > 1) { score += 2; reasons.push('أسلوب أدبي'); }

  // Byte constraint tightness
  if (entry.maxBytes > 0) {
    const expansionRatio = entry.maxBytes / (text.length * 3); // rough estimate
    if (expansionRatio < 1.2) { score += 2; reasons.push('حد بايت ضيق'); }
    else if (expansionRatio < 1.5) { score += 1; reasons.push('حد بايت محدود'); }
  }

  // Numbers and mixed content
  const hasNumbers = /\d+/.test(text);
  const hasMixedScript = /[\u0600-\u06FF]/.test(text) && /[a-zA-Z]/.test(text);
  if (hasMixedScript) { score += 1; reasons.push('محتوى مختلط'); }
  if (hasNumbers && text.length > 50) { score += 1; }

  const level: DifficultyLevel = score >= 6 ? 'complex' : score >= 3 ? 'medium' : 'simple';

  // Estimated translation time in minutes
  const estimatedMinutes = level === 'complex' ? 3 : level === 'medium' ? 1.5 : 0.5;

  return { level, score, reasons, estimatedMinutes };
}

export const DIFFICULTY_CONFIG: Record<DifficultyLevel, { label: string; emoji: string; color: string; bgColor: string }> = {
  simple: { label: 'بسيط', emoji: '🟢', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  medium: { label: 'متوسط', emoji: '🟡', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  complex: { label: 'معقد', emoji: '🔴', color: 'text-destructive', bgColor: 'bg-destructive/10' },
};

export function useDifficultyStats(entries: ExtractedEntry[]) {
  return useMemo(() => {
    const stats = { simple: 0, medium: 0, complex: 0, totalMinutes: 0 };
    for (const entry of entries) {
      const { level, estimatedMinutes } = classifyDifficulty(entry);
      stats[level]++;
      stats.totalMinutes += estimatedMinutes;
    }
    return stats;
  }, [entries]);
}
