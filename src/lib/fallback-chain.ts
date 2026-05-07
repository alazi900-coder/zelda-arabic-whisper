// Customizable engine fallback chain.
//
// When the primary translation engine fails (network error, 5xx, 429), the
// translator can transparently retry with the next engine in a user-defined
// chain. This module defines the engine list and contains pure helpers for
// validating and resolving the chain.

export type EngineId =
  | "gemini"
  | "lovable"
  | "claude"
  | "bedrock"
  | "mymemory"
  | "google"
  | "openrouter"
  | "groq";

export const ALL_ENGINES: ReadonlyArray<EngineId> = [
  "gemini",
  "lovable",
  "claude",
  "bedrock",
  "mymemory",
  "google",
  "openrouter",
  "groq",
];

/** Sensible default fallback order: best free → best cheap → free APIs. */
export const DEFAULT_FALLBACK_CHAIN: ReadonlyArray<EngineId> = [
  "gemini",
  "lovable",
  "claude",
  "mymemory",
  "google",
];

export interface EngineKeyAvailability {
  gemini?: boolean;
  /** Lovable Cloud requires no user key — always available when reachable. */
  lovable?: boolean;
  claude?: boolean;
  bedrock?: boolean;
  /** MyMemory and Google work without keys (anon limits apply). */
  mymemory?: boolean;
  google?: boolean;
  /** OpenRouter requires a user-provided API key from openrouter.ai. */
  openrouter?: boolean;
  /** Groq requires a user-provided API key from console.groq.com. */
  groq?: boolean;
}

/** Whether an engine has the credentials needed to be invokable in this session. */
export function isEngineUsable(engine: EngineId, avail: EngineKeyAvailability): boolean {
  switch (engine) {
    case "gemini":
      return avail.gemini ?? false;
    case "claude":
      return avail.claude ?? false;
    case "bedrock":
      return avail.bedrock ?? false;
    case "openrouter":
      return avail.openrouter ?? false;
    case "groq":
      return avail.groq ?? false;
    case "lovable":
    case "mymemory":
    case "google":
      return true;
    default:
      return false;
  }
}

/** Parse a stored chain string (comma-separated) into a validated array. */
export function parseChain(raw: string | undefined | null): EngineId[] {
  if (!raw) return [];
  const seen = new Set<EngineId>();
  const out: EngineId[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim() as EngineId;
    if (!ALL_ENGINES.includes(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Serialize a chain as a comma-separated localStorage-friendly string. */
export function serializeChain(chain: ReadonlyArray<EngineId>): string {
  return chain.join(",");
}

/**
 * Build the actual call order for a translation attempt.
 *
 * Returns: [primary, ...fallbacks-without-primary-and-without-unusable]
 *
 * Caller invokes them in order until one succeeds.
 */
export function buildCallOrder(
  primary: EngineId,
  chain: ReadonlyArray<EngineId>,
  avail: EngineKeyAvailability,
): EngineId[] {
  const out: EngineId[] = [];
  const seen = new Set<EngineId>();

  if (isEngineUsable(primary, avail)) {
    out.push(primary);
    seen.add(primary);
  }
  for (const e of chain) {
    if (seen.has(e)) continue;
    if (!isEngineUsable(e, avail)) continue;
    out.push(e);
    seen.add(e);
  }
  return out;
}
