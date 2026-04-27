import { useMemo } from "react";
import type { ExtractedEntry } from "@/components/editor/types";

export interface TMMatch {
  key: string;
  original: string;
  translation: string;
  similarity: number;
  file: string;
  matchType: 'exact' | 'fuzzy' | 'partial';
  matchedWords?: string[];
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (m > 200 || n > 200) return Math.abs(m - n); // Skip expensive computation for long strings
  
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

// N-gram similarity for better phrase matching
function ngramSimilarity(a: string, b: string, n = 3): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const na = normalize(a), nb = normalize(b);
  if (na.length < n || nb.length < n) return 0;
  
  const gramsA = new Set<string>();
  const gramsB = new Set<string>();
  for (let i = 0; i <= na.length - n; i++) gramsA.add(na.slice(i, i + n));
  for (let i = 0; i <= nb.length - n; i++) gramsB.add(nb.slice(i, i + n));
  
  let intersection = 0;
  for (const g of gramsA) if (gramsB.has(g)) intersection++;
  return (2 * intersection) / (gramsA.size + gramsB.size);
}

// Word overlap similarity (Jaccard-like)
function wordSimilarity(a: string, b: string): { score: number; matched: string[] } {
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const wordsA = new Set(normalize(a).split(/\s+/).filter(Boolean));
  const wordsB = new Set(normalize(b).split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return { score: 0, matched: [] };
  
  const matched: string[] = [];
  for (const w of wordsA) if (wordsB.has(w)) matched.push(w);
  const score = matched.length / Math.max(wordsA.size, wordsB.size);
  return { score, matched };
}

// Combined similarity with multiple algorithms
function combinedSimilarity(a: string, b: string): { score: number; matchType: TMMatch['matchType']; matchedWords: string[] } {
  // Exact match
  if (a.toLowerCase().trim() === b.toLowerCase().trim()) {
    return { score: 1, matchType: 'exact', matchedWords: [] };
  }

  const wordResult = wordSimilarity(a, b);
  const ngram = ngramSimilarity(a, b);
  
  // Edit distance similarity (normalized)
  const maxLen = Math.max(a.length, b.length);
  const editSim = maxLen > 0 ? 1 - (levenshteinDistance(a.toLowerCase(), b.toLowerCase()) / maxLen) : 0;
  
  // Weighted combination
  const score = wordResult.score * 0.4 + ngram * 0.35 + editSim * 0.25;
  const matchType: TMMatch['matchType'] = score >= 0.7 ? 'fuzzy' : 'partial';
  
  return { score, matchType, matchedWords: wordResult.matched };
}

// Build a TM index from all translated entries
export function findSimilarTranslations(
  targetEntry: ExtractedEntry,
  allEntries: ExtractedEntry[],
  translations: Record<string, string>,
  maxResults = 10,
  minSimilarity = 0.3,
): TMMatch[] {
  const targetKey = `${targetEntry.msbtFile}:${targetEntry.index}`;
  const targetText = targetEntry.original;

  if (!targetText || targetText.length < 3) return [];

  const matches: TMMatch[] = [];
  const targetLen = targetText.length;

  for (const entry of allEntries) {
    const key = `${entry.msbtFile}:${entry.index}`;
    if (key === targetKey) continue;

    const translation = translations[key]?.trim();
    if (!translation || translation === entry.original) continue;

    // Skip entries with very different lengths (unlikely to match)
    const lenRatio = entry.original.length / targetLen;
    if (lenRatio < 0.3 || lenRatio > 3) continue;

    const { score, matchType, matchedWords } = combinedSimilarity(targetText, entry.original);
    if (score >= minSimilarity) {
      matches.push({
        key,
        original: entry.original,
        translation,
        similarity: score,
        file: entry.msbtFile,
        matchType,
        matchedWords,
      });
    }
  }

  // Sort by similarity descending
  matches.sort((a, b) => b.similarity - a.similarity);
  return matches.slice(0, maxResults);
}

export function useTranslationMemory(
  targetEntry: ExtractedEntry | null,
  allEntries: ExtractedEntry[],
  translations: Record<string, string>,
): TMMatch[] {
  const translationCount = Object.keys(translations).length;
  return useMemo(() => {
    if (!targetEntry) return [];
    return findSimilarTranslations(targetEntry, allEntries, translations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetEntry, allEntries, translationCount]);
}
