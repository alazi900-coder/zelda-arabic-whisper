/**
 * Curated OpenRouter model presets shown as quick-pick buttons in the engine
 * settings. The full list of 200+ models lives at https://openrouter.ai/models;
 * any model ID can still be typed into the free-text fallback input.
 *
 * Selection criteria for inclusion:
 *  - Free models that historically have remained available with the `:free`
 *    suffix and acceptable rate limits.
 *  - Paid models that are well-known to the typical Arabic-translation user
 *    (Claude / GPT / Gemini families) so the picker doesn't require model-ID
 *    research.
 *
 * Pricing is intentionally NOT shown in labels — it changes too often. The tier
 * field (`free` / `paid`) is the only stable signal we expose.
 */

export type OpenRouterTier = "free" | "paid";

export interface OpenRouterPreset {
  /** Model ID to send in the request body (e.g. `anthropic/claude-3.5-sonnet`). */
  id: string;
  /** Short user-facing label in Arabic. */
  label: string;
  /** Optional secondary line (provider, English name) for the tooltip. */
  hint?: string;
  /** Pricing tier — `free` models end with `:free` on OpenRouter. */
  tier: OpenRouterTier;
}

/** The default model used when the user enables OpenRouter for the first time. */
export const OPENROUTER_DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";

export const OPENROUTER_PRESETS: OpenRouterPreset[] = [
  // --- Free tier ---
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    label: "لاما 3.3 70B (مجاني)",
    hint: "Meta Llama 3.3 70B Instruct — free",
    tier: "free",
  },
  {
    id: "google/gemini-2.0-flash-exp:free",
    label: "جيمناي 2.0 فلاش (مجاني)",
    hint: "Google Gemini 2.0 Flash Experimental — free",
    tier: "free",
  },
  {
    id: "deepseek/deepseek-r1:free",
    label: "ديب سيك R1 (مجاني)",
    hint: "DeepSeek R1 reasoning — free",
    tier: "free",
  },
  {
    id: "qwen/qwen-2.5-72b-instruct:free",
    label: "كوين 2.5 72B (مجاني)",
    hint: "Alibaba Qwen 2.5 72B Instruct — free",
    tier: "free",
  },

  // --- Paid tier (popular powerhouses) ---
  {
    id: "anthropic/claude-3.5-sonnet",
    label: "كلود 3.5 سونيت",
    hint: "Anthropic Claude 3.5 Sonnet — high-quality default",
    tier: "paid",
  },
  {
    id: "anthropic/claude-sonnet-4",
    label: "كلود سونيت 4",
    hint: "Anthropic Claude Sonnet 4 — newer flagship",
    tier: "paid",
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    hint: "OpenAI GPT-4o — flagship multimodal",
    tier: "paid",
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o mini",
    hint: "OpenAI GPT-4o mini — cheaper",
    tier: "paid",
  },
  {
    id: "google/gemini-2.5-pro",
    label: "جيمناي 2.5 برو",
    hint: "Google Gemini 2.5 Pro — top quality",
    tier: "paid",
  },
  {
    id: "google/gemini-2.5-flash",
    label: "جيمناي 2.5 فلاش",
    hint: "Google Gemini 2.5 Flash — balanced",
    tier: "paid",
  },
];

/**
 * True when a model ID matches the OpenRouter convention for free-tier models
 * (suffix `:free`). Useful for badges and cost estimations.
 */
export function isFreeModelId(id: string): boolean {
  return /:free$/.test(id.trim());
}

/**
 * Look up the preset metadata for a given OpenRouter model ID, or `null` if it
 * isn't one of the curated presets. The caller can fall back to rendering the
 * raw ID for custom models.
 */
export function findPreset(id: string): OpenRouterPreset | null {
  const trimmed = id.trim();
  for (const p of OPENROUTER_PRESETS) {
    if (p.id === trimmed) return p;
  }
  return null;
}
