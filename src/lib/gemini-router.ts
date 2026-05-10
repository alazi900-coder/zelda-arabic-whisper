// Smart routing for Gemini model selection based on text length.
// When user picks 'auto', the front-end resolves the actual model per-batch
// from the longest entry's character count. Short UI strings stay on the
// cheap Flash Lite tier, long lore goes to Pro.

export type GeminiModel = 'gemini-2.5-flash-lite' | 'gemini-2.5-flash' | 'gemini-2.5-pro';
export type GeminiModelChoice = GeminiModel | 'auto';

const SHORT_MAX_CHARS = 80;
const MEDIUM_MAX_CHARS = 300;

export function resolveGeminiModel(
  choice: GeminiModelChoice | undefined,
  entries: ReadonlyArray<{ original: string }>,
): GeminiModel | undefined {
  if (!choice) return undefined;
  if (choice !== 'auto') return choice;
  if (entries.length === 0) return 'gemini-2.5-flash';
  let maxLen = 0;
  for (const e of entries) {
    if (e.original.length > maxLen) maxLen = e.original.length;
  }
  if (maxLen < SHORT_MAX_CHARS) return 'gemini-2.5-flash-lite';
  if (maxLen < MEDIUM_MAX_CHARS) return 'gemini-2.5-flash';
  return 'gemini-2.5-pro';
}
