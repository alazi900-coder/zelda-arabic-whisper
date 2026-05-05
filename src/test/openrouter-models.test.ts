import { describe, it, expect } from "vitest";
import {
  OPENROUTER_PRESETS,
  OPENROUTER_DEFAULT_MODEL,
  isFreeModelId,
  findPreset,
} from "@/lib/openrouter-models";

describe("openrouter-models — preset list", () => {
  it("exposes at least one free and one paid preset", () => {
    const freeCount = OPENROUTER_PRESETS.filter(p => p.tier === "free").length;
    const paidCount = OPENROUTER_PRESETS.filter(p => p.tier === "paid").length;
    expect(freeCount).toBeGreaterThanOrEqual(1);
    expect(paidCount).toBeGreaterThanOrEqual(1);
  });

  it("every preset id matches OpenRouter's `provider/model[:free]` shape", () => {
    const re = /^[a-z0-9_-]+\/[a-z0-9._:-]+$/i;
    for (const p of OPENROUTER_PRESETS) {
      expect(p.id, p.id).toMatch(re);
    }
  });

  it("every free preset id ends with `:free`", () => {
    for (const p of OPENROUTER_PRESETS) {
      if (p.tier === "free") {
        expect(p.id).toMatch(/:free$/);
      } else {
        expect(p.id).not.toMatch(/:free$/);
      }
    }
  });

  it("the default model is present among the paid presets", () => {
    expect(OPENROUTER_PRESETS.some(p => p.id === OPENROUTER_DEFAULT_MODEL)).toBe(true);
  });

  it("every preset has a non-empty Arabic label", () => {
    for (const p of OPENROUTER_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
    }
  });
});

describe("openrouter-models — isFreeModelId", () => {
  it("recognises the `:free` suffix", () => {
    expect(isFreeModelId("meta-llama/llama-3.3-70b-instruct:free")).toBe(true);
    expect(isFreeModelId("anthropic/claude-3.5-sonnet")).toBe(false);
  });

  it("trims surrounding whitespace before checking", () => {
    expect(isFreeModelId("   deepseek/deepseek-r1:free   ")).toBe(true);
  });

  it("returns false for empty strings", () => {
    expect(isFreeModelId("")).toBe(false);
  });
});

describe("openrouter-models — findPreset", () => {
  it("returns the matching preset for a known ID", () => {
    const p = findPreset("anthropic/claude-3.5-sonnet");
    expect(p).not.toBeNull();
    expect(p?.tier).toBe("paid");
  });

  it("returns null for a custom user-typed ID", () => {
    expect(findPreset("acme/secret-model")).toBeNull();
  });

  it("ignores leading/trailing whitespace", () => {
    expect(findPreset("   anthropic/claude-3.5-sonnet  ")).not.toBeNull();
  });
});
