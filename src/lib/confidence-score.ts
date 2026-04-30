import { ARABIC_REGEX } from "./arabic-processing";

interface ConfidenceInput {
  original: string;
  translation: string;
  maxBytes: number;
  glossaryMatches?: { term: string; translation: string }[];
  hasTMMatch?: boolean;
}

/**
 * Calculate a translation confidence score (0–100).
 * Factors: length ratio, Arabic presence, glossary usage, tag preservation, byte limit.
 */
export function calcConfidence(input: ConfidenceInput): number {
  const { original, translation, maxBytes, glossaryMatches = [], hasTMMatch } = input;
  if (!translation?.trim()) return 0;

  let score = 0;

  // 1. Length ratio (max 25) — translation should be roughly 0.5x–2x the original
  const ratio = translation.length / Math.max(original.length, 1);
  if (ratio >= 0.3 && ratio <= 3) {
    score += 25 - Math.abs(1 - ratio) * 10;
  }
  score = Math.max(score, 0);

  // 2. Arabic presence (max 25) — translation should contain Arabic characters
  const arabicChars = (translation.match(new RegExp(ARABIC_REGEX.source, 'g')) || []).length;
  const arabicRatio = arabicChars / Math.max(translation.replace(/\s/g, '').length, 1);
  score += Math.min(25, Math.round(arabicRatio * 30));

  // 3. Glossary adherence (max 20) — used glossary terms present in translation
  if (glossaryMatches.length > 0) {
    let matched = 0;
    for (const g of glossaryMatches) {
      if (translation.includes(g.translation)) matched++;
    }
    score += Math.round((matched / glossaryMatches.length) * 20);
  } else {
    score += 15; // no glossary terms to check = neutral
  }

  // 4. Tag preservation (max 15) — technical tags from original present in translation
  const origTags: string[] = original.match(/[\uFFF9-\uFFFC\uE000-\uF8FF]/g) || [];
  if (origTags.length > 0) {
    const transTags: string[] = translation.match(/[\uFFF9-\uFFFC\uE000-\uF8FF]/g) || [];
    const preserved = origTags.filter((t: string) => transTags.includes(t)).length;
    score += Math.round((preserved / origTags.length) * 15);
  } else {
    score += 15;
  }

  // 5. Byte limit compliance (max 15)
  if (maxBytes > 0) {
    const byteLen = new TextEncoder().encode(translation).length;
    score += byteLen <= maxBytes ? 15 : Math.max(0, 15 - Math.round(((byteLen - maxBytes) / maxBytes) * 30));
  } else {
    score += 15;
  }

  // Bonus for TM match
  if (hasTMMatch) score = Math.min(100, score + 5);

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function confidenceColor(score: number): string {
  if (score >= 80) return 'text-green-600 bg-green-500/10 border-green-500/20';
  if (score >= 50) return 'text-amber-600 bg-amber-500/10 border-amber-500/20';
  return 'text-red-500 bg-red-500/10 border-red-500/20';
}

export function confidenceLabel(score: number): string {
  if (score >= 80) return 'عالية';
  if (score >= 50) return 'متوسطة';
  return 'منخفضة';
}
