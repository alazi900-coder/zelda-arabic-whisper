import { describe, it, expect } from "vitest";
import {
  parseChain,
  serializeChain,
  isEngineUsable,
  buildCallOrder,
  ALL_ENGINES,
  DEFAULT_FALLBACK_CHAIN,
} from "@/lib/fallback-chain";

describe("parseChain", () => {
  it("returns empty for null/empty", () => {
    expect(parseChain(undefined)).toEqual([]);
    expect(parseChain("")).toEqual([]);
  });

  it("parses comma-separated engines", () => {
    expect(parseChain("gemini,claude,bedrock")).toEqual(["gemini", "claude", "bedrock"]);
  });

  it("trims whitespace", () => {
    expect(parseChain(" gemini , claude ")).toEqual(["gemini", "claude"]);
  });

  it("dedupes", () => {
    expect(parseChain("gemini,claude,gemini")).toEqual(["gemini", "claude"]);
  });

  it("drops unknown engine names", () => {
    expect(parseChain("gemini,not-a-real-engine,claude")).toEqual(["gemini", "claude"]);
  });

  it("accepts openrouter as a valid engine id", () => {
    expect(parseChain("openrouter,gemini")).toEqual(["openrouter", "gemini"]);
  });
});

describe("isEngineUsable (openrouter)", () => {
  it("requires openrouter key", () => {
    expect(isEngineUsable("openrouter", { openrouter: false })).toBe(false);
    expect(isEngineUsable("openrouter", {})).toBe(false);
    expect(isEngineUsable("openrouter", { openrouter: true })).toBe(true);
  });
});

describe("buildCallOrder with openrouter", () => {
  it("includes openrouter when key is present", () => {
    const order = buildCallOrder("gemini", ["openrouter", "claude", "google"], {
      gemini: true, openrouter: true, claude: false, google: true,
    });
    expect(order).toEqual(["gemini", "openrouter", "google"]);
  });

  it("skips openrouter when no key", () => {
    const order = buildCallOrder("gemini", ["openrouter", "google"], {
      gemini: true, openrouter: false, google: true,
    });
    expect(order).toEqual(["gemini", "google"]);
  });
});

describe("serializeChain", () => {
  it("joins with commas", () => {
    expect(serializeChain(["gemini", "claude", "mymemory"])).toBe("gemini,claude,mymemory");
  });

  it("handles empty", () => {
    expect(serializeChain([])).toBe("");
  });
});

describe("isEngineUsable", () => {
  it("returns true for engines that need no key", () => {
    const empty = {};
    expect(isEngineUsable("lovable", empty)).toBe(true);
    expect(isEngineUsable("mymemory", empty)).toBe(true);
    expect(isEngineUsable("google", empty)).toBe(true);
  });

  it("returns false for keyed engines without key", () => {
    expect(isEngineUsable("gemini", {})).toBe(false);
    expect(isEngineUsable("claude", {})).toBe(false);
    expect(isEngineUsable("bedrock", {})).toBe(false);
  });

  it("returns true for keyed engines with key", () => {
    expect(isEngineUsable("gemini", { gemini: true })).toBe(true);
    expect(isEngineUsable("claude", { claude: true })).toBe(true);
  });
});

describe("buildCallOrder", () => {
  it("starts with primary if usable", () => {
    const order = buildCallOrder("claude", ["gemini", "mymemory"], { claude: true, gemini: true });
    expect(order[0]).toBe("claude");
  });

  it("appends usable fallbacks in order, deduped", () => {
    const order = buildCallOrder("gemini", ["claude", "gemini", "mymemory"], { gemini: true, claude: true });
    expect(order).toEqual(["gemini", "claude", "mymemory"]);
  });

  it("skips unusable fallbacks", () => {
    const order = buildCallOrder("mymemory", ["claude", "gemini", "google"], {});
    expect(order).toEqual(["mymemory", "google"]);
  });

  it("skips primary if unusable but still includes fallbacks", () => {
    const order = buildCallOrder("claude", ["gemini", "mymemory"], { gemini: true });
    expect(order[0]).toBe("gemini");
    expect(order).toContain("mymemory");
    expect(order).not.toContain("claude");
  });

  it("returns empty when nothing usable", () => {
    const order = buildCallOrder("claude", ["gemini", "bedrock"], {});
    expect(order).toEqual([]);
  });
});

describe("constants", () => {
  it("ALL_ENGINES covers expected ids", () => {
    expect(new Set(ALL_ENGINES)).toEqual(new Set(["gemini", "lovable", "claude", "bedrock", "mymemory", "google", "openrouter"]));
  });

  it("DEFAULT_FALLBACK_CHAIN is a valid chain", () => {
    for (const e of DEFAULT_FALLBACK_CHAIN) {
      expect(ALL_ENGINES).toContain(e);
    }
  });
});
