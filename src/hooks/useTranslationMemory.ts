import { useMemo } from "react";
import type { ExtractedEntry } from "@/components/editor/types";

export interface TMMatch {
  key: string;
  original: string;
  translation: string;
  similarity: number;
  file: string;
}

// Simple word-overlap similarity (Jaccard-like)
function wordSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const wordsA = new Set(normalize(a).split(/\s+/).filter(Boolean));
  const wordsB = new Set(normalize(b).split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  return intersection / Math.max(wordsA.size, wordsB.size);
}

// Build a TM index from all translated entries
export function findSimilarTranslations(
  targetEntry: ExtractedEntry,
  allEntries: ExtractedEntry[],
  translations: Record<string, string>,
  maxResults = 5,
  minSimilarity = 0.4,
): TMMatch[] {
  const targetKey = `${targetEntry.msbtFile}:${targetEntry.index}`;
  const targetText = targetEntry.original;

  if (!targetText || targetText.length < 5) return [];

  const matches: TMMatch[] = [];

  for (const entry of allEntries) {
    const key = `${entry.msbtFile}:${entry.index}`;
    if (key === targetKey) continue;

    const translation = translations[key]?.trim();
    if (!translation || translation === entry.original) continue;

    const sim = wordSimilarity(targetText, entry.original);
    if (sim >= minSimilarity) {
      matches.push({
        key,
        original: entry.original,
        translation,
        similarity: sim,
        file: entry.msbtFile,
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
  return useMemo(() => {
    if (!targetEntry) return [];
    return findSimilarTranslations(targetEntry, allEntries, translations);
  }, [targetEntry?.msbtFile, targetEntry?.index, allEntries.length, Object.keys(translations).length]);
}
