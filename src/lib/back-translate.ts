import { fetchWithTimeout } from "./fetch-with-timeout";

/**
 * Translate Arabic text back to English using Google Translate free API.
 * Used to verify translation accuracy by comparing with original.
 */
export async function backTranslate(arabicText: string): Promise<string> {
  const text = encodeURIComponent(arabicText);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=en&dt=t&q=${text}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Back-translate failed: ${response.status}`);
  const data = await response.json();
  return ((data?.[0] as [string, string][] | undefined)
    ?.map((seg: [string, string]) => seg[0])
    .join('') || '').trim();
}

/**
 * Calculate similarity between original English and back-translated English.
 * Returns 0–100 percentage.
 */
export function textSimilarity(a: string, b: string): number {
  const aNorm = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const bNorm = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  if (aNorm === bNorm) return 100;
  if (!aNorm || !bNorm) return 0;

  const aWords = new Set(aNorm.split(/\s+/));
  const bWords = new Set(bNorm.split(/\s+/));
  let overlap = 0;
  for (const w of aWords) {
    if (bWords.has(w)) overlap++;
  }
  const union = new Set([...aWords, ...bWords]).size;
  return Math.round((overlap / Math.max(union, 1)) * 100);
}
