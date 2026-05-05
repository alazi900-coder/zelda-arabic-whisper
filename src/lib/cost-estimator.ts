// Cost estimator for batch translation jobs.
//
// Token counts are estimated heuristically from character length (Latin: ~4
// chars/token; Arabic in the response: ~2.5 chars/token). Per-1M-token prices
// are provider list prices as of Q2 2025 — they're tuned for "ballpark" not
// for billing. Update PRICING when providers change rates.
//
// Pricing convention: USD per 1,000,000 tokens, [input, output].

export type EngineId =
  | "gemini"
  | "lovable"
  | "claude"
  | "bedrock"
  | "mymemory"
  | "google"
  | "openrouter";

export type ModelId =
  | "gemini-2.0-flash"
  | "gemini-2.5-flash"
  | "gemini-2.5-pro"
  | "claude-haiku"
  | "claude-sonnet"
  | "bedrock-deepseek-r1"
  | "bedrock-claude-sonnet"
  | "bedrock-llama"
  | "lovable"
  | "mymemory"
  | "google"
  | "openrouter-unknown";

interface Pricing {
  input: number;
  output: number;
  /** Whether this engine is free (no per-token charge). */
  free?: boolean;
}

// USD per 1M tokens. Free engines (mymemory/google) are flagged.
const PRICING: Readonly<Record<ModelId, Pricing>> = {
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10.0 },
  "claude-haiku": { input: 1.0, output: 5.0 },
  "claude-sonnet": { input: 3.0, output: 15.0 },
  "bedrock-deepseek-r1": { input: 1.35, output: 5.4 },
  "bedrock-claude-sonnet": { input: 3.0, output: 15.0 },
  "bedrock-llama": { input: 0.72, output: 0.72 },
  // Lovable is free for users (proxied through Lovable Cloud), so 0 cost.
  "lovable": { input: 0, output: 0, free: true },
  "mymemory": { input: 0, output: 0, free: true },
  "google": { input: 0, output: 0, free: true },
  // OpenRouter pricing varies wildly per model (free models exist; some
  // are pricier than Claude). We use a conservative middle estimate; for an
  // exact cost the user can check the model card on openrouter.ai.
  "openrouter-unknown": { input: 1.0, output: 5.0 },
};

export interface CostEstimate {
  /** Estimated tokens we'll send (prompt + entries). */
  inputTokens: number;
  /** Estimated tokens the model will return (Arabic translations). */
  outputTokens: number;
  /** Estimated USD cost. 0 for free engines. */
  costUSD: number;
  /** Whether this engine is free (cost is always 0). */
  free: boolean;
  /** Number of source entries the estimate covered. */
  entryCount: number;
}

/** Rough heuristic: ~4 ASCII chars per token (Latin), ~2.5 for Arabic output. */
const CHARS_PER_INPUT_TOKEN = 4;
const CHARS_PER_OUTPUT_TOKEN = 2.5;

/** Approximate token count of arbitrary text. */
export function estimateTokens(text: string, mode: "input" | "output" = "input"): number {
  if (!text) return 0;
  const cpt = mode === "input" ? CHARS_PER_INPUT_TOKEN : CHARS_PER_OUTPUT_TOKEN;
  return Math.ceil(text.length / cpt);
}

/** Map UI-level engine + model selection onto a pricing key. */
export function resolveModelId(
  engine: EngineId,
  geminiModel?: "gemini-2.0-flash" | "gemini-2.5-flash" | "gemini-2.5-pro" | "auto",
  translationQuality?: "fast" | "quality",
  bedrockModel?: string,
): ModelId {
  if (engine === "google") return "google";
  if (engine === "mymemory") return "mymemory";
  if (engine === "lovable") return "lovable";
  if (engine === "gemini") {
    if (!geminiModel || geminiModel === "auto") return "gemini-2.5-flash";
    return geminiModel;
  }
  if (engine === "claude") {
    return translationQuality === "quality" ? "claude-sonnet" : "claude-haiku";
  }
  if (engine === "bedrock") {
    if (bedrockModel?.includes("claude")) return "bedrock-claude-sonnet";
    if (bedrockModel?.includes("llama")) return "bedrock-llama";
    return "bedrock-deepseek-r1";
  }
  if (engine === "openrouter") return "openrouter-unknown";
  return "lovable";
}

export interface EstimateInputEntry {
  original: string;
}

/**
 * Estimate the cost of translating `entries` with the given engine/model.
 *
 * - inputTokens = sum of source character lengths / 4, plus a fixed prompt
 *   overhead (~400 tokens for instructions + glossary + context).
 * - outputTokens ≈ inputTokens × 1.3 (Arabic is typically slightly longer
 *   than English in word count but encoded with fewer chars per token).
 */
export function estimateBatchCost(
  entries: ReadonlyArray<EstimateInputEntry>,
  modelId: ModelId,
  promptOverheadTokens = 400,
): CostEstimate {
  const pricing = PRICING[modelId];
  if (!pricing) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      costUSD: 0,
      free: true,
      entryCount: entries.length,
    };
  }

  let inputChars = 0;
  for (const e of entries) {
    if (e.original) inputChars += e.original.length;
  }
  const sourceTokens = Math.ceil(inputChars / CHARS_PER_INPUT_TOKEN);
  const inputTokens = sourceTokens + promptOverheadTokens;
  const outputTokens = Math.ceil(sourceTokens * 1.3);

  if (pricing.free) {
    return {
      inputTokens,
      outputTokens,
      costUSD: 0,
      free: true,
      entryCount: entries.length,
    };
  }

  const costUSD =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output;

  return {
    inputTokens,
    outputTokens,
    costUSD,
    free: false,
    entryCount: entries.length,
  };
}

/** Pretty-print a cost estimate as a short Arabic-friendly string. */
export function formatCostEstimate(est: CostEstimate): string {
  if (est.entryCount === 0) return "—";
  if (est.free) return "مجاني";
  if (est.costUSD < 0.001) return "< $0.001";
  if (est.costUSD < 0.01) return `$${est.costUSD.toFixed(4)}`;
  if (est.costUSD < 1) return `$${est.costUSD.toFixed(3)}`;
  return `$${est.costUSD.toFixed(2)}`;
}
