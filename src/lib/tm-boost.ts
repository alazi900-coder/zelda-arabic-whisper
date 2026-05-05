// Translation Memory Boost — pick the top-K already-translated entries whose
// English source is most similar to a needle (or a whole batch), so they can
// be injected into the AI prompt as few-shot examples for terminology and
// style consistency.
//
// Similarity uses Sorensen–Dice over (unigrams + bigrams) of word tokens.
// The candidate token-sets are precomputed once so a batch of N needles
// against M candidates costs O((N + M) * tokens) instead of O(N * M).

export interface TmCandidate {
  original: string;
  translation: string;
}

export interface TmExample {
  original: string;
  translation: string;
  sim: number;
}

export interface PrecomputedCandidate {
  original: string;
  translation: string;
  set: Set<string>;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function buildSet(s: string): Set<string> {
  const tokens = tokenize(s);
  const out = new Set<string>(tokens);
  for (let i = 0; i < tokens.length - 1; i++) {
    out.add(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
}

function diceFromSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return (2 * inter) / (a.size + b.size);
}

export function precomputeCandidates(
  candidates: ReadonlyArray<TmCandidate>,
): PrecomputedCandidate[] {
  return candidates.map((c) => ({
    original: c.original,
    translation: c.translation,
    set: buildSet(c.original),
  }));
}

/**
 * Find the top-`k` candidates most similar to `needle` (Sorensen–Dice).
 * Excludes exact-original matches (those are covered by the existing
 * exact-TM short-circuit).
 */
export function findTopTmMatches(
  needle: string,
  candidates: ReadonlyArray<PrecomputedCandidate>,
  k = 5,
  minSim = 0.3,
): TmExample[] {
  if (!needle.trim() || candidates.length === 0) return [];
  const needleSet = buildSet(needle);
  if (needleSet.size === 0) return [];
  const scored: TmExample[] = [];
  for (const c of candidates) {
    if (c.original === needle) continue;
    if (!c.translation.trim()) continue;
    const sim = diceFromSets(needleSet, c.set);
    if (sim >= minSim) {
      scored.push({ original: c.original, translation: c.translation, sim });
    }
  }
  scored.sort((a, b) => b.sim - a.sim);
  return scored.slice(0, k);
}

/**
 * Build a deduplicated, capped list of TM examples for a whole batch.
 *
 * For each entry in the batch, take its top-`perEntry` matches; merge them
 * across the batch keeping the maximum similarity per `original`; sort by
 * similarity desc; truncate to `totalCap`.
 */
export function buildBatchTmExamples(
  batch: ReadonlyArray<{ original: string }>,
  candidates: ReadonlyArray<PrecomputedCandidate>,
  perEntry = 3,
  totalCap = 8,
  minSim = 0.3,
): TmExample[] {
  if (batch.length === 0 || candidates.length === 0) return [];
  const seen = new Map<string, TmExample>();
  for (const e of batch) {
    const matches = findTopTmMatches(e.original, candidates, perEntry, minSim);
    for (const m of matches) {
      const existing = seen.get(m.original);
      if (!existing || m.sim > existing.sim) seen.set(m.original, m);
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.sim - a.sim)
    .slice(0, totalCap);
}
