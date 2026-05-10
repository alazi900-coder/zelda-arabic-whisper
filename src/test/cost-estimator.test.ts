import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  estimateBatchCost,
  formatCostEstimate,
  resolveModelId,
} from "@/lib/cost-estimator";

describe("estimateTokens", () => {
  it("returns 0 for empty input", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("", "output")).toBe(0);
  });

  it("uses ~4 chars/token for input mode", () => {
    expect(estimateTokens("a".repeat(8))).toBe(2);
    expect(estimateTokens("a".repeat(100))).toBe(25);
  });

  it("uses ~2.5 chars/token for output mode", () => {
    expect(estimateTokens("ا".repeat(10), "output")).toBe(4);
  });
});

describe("resolveModelId", () => {
  it("maps engines to default models", () => {
    expect(resolveModelId("google")).toBe("google");
    expect(resolveModelId("mymemory")).toBe("mymemory");
    expect(resolveModelId("lovable")).toBe("lovable");
    expect(resolveModelId("gemini")).toBe("gemini-2.5-flash");
    expect(resolveModelId("gemini", "auto")).toBe("gemini-2.5-flash");
    expect(resolveModelId("gemini", "gemini-2.5-pro")).toBe("gemini-2.5-pro");
    expect(resolveModelId("gemini", "gemini-2.5-flash-lite")).toBe("gemini-2.5-flash-lite");
  });
});

describe("estimateBatchCost", () => {
  it("returns zero cost for free engines", () => {
    const r = estimateBatchCost([{ original: "Hello world" }], "mymemory");
    expect(r.free).toBe(true);
    expect(r.costUSD).toBe(0);
    expect(r.entryCount).toBe(1);
  });

  it("returns positive cost for paid engines", () => {
    const r = estimateBatchCost([{ original: "Hello world" }], "gemini-2.5-pro");
    expect(r.free).toBe(false);
    expect(r.costUSD).toBeGreaterThan(0);
  });

  it("scales with entry count", () => {
    const oneEntry = [{ original: "a".repeat(100) }];
    const tenEntries = Array.from({ length: 10 }, () => ({ original: "a".repeat(100) }));
    const a = estimateBatchCost(oneEntry, "gemini-2.5-pro", 0);
    const b = estimateBatchCost(tenEntries, "gemini-2.5-pro", 0);
    expect(b.costUSD).toBeGreaterThan(a.costUSD * 9.5);
  });

  it("handles empty input", () => {
    const r = estimateBatchCost([], "gemini-2.5-flash");
    expect(r.entryCount).toBe(0);
    expect(r.inputTokens).toBe(400);
  });

  it("includes prompt overhead in input tokens", () => {
    const r = estimateBatchCost([{ original: "" }], "gemini-2.5-flash", 100);
    expect(r.inputTokens).toBe(100);
  });
});

describe("formatCostEstimate", () => {
  const base = { inputTokens: 100, outputTokens: 100, free: false, entryCount: 1 };
  it("formats free as 'مجاني'", () => {
    expect(formatCostEstimate({ ...base, costUSD: 0, free: true })).toBe("مجاني");
  });
  it("formats em-dash for empty", () => {
    expect(formatCostEstimate({ ...base, entryCount: 0, costUSD: 0 })).toBe("—");
  });
  it("formats sub-millicent as '< $0.001'", () => {
    expect(formatCostEstimate({ ...base, costUSD: 0.0005 })).toBe("< $0.001");
  });
  it("formats sub-cent with 4 decimals", () => {
    expect(formatCostEstimate({ ...base, costUSD: 0.005 })).toBe("$0.0050");
  });
  it("formats sub-dollar with 3 decimals", () => {
    expect(formatCostEstimate({ ...base, costUSD: 0.5 })).toBe("$0.500");
  });
  it("formats whole-dollar with 2 decimals", () => {
    expect(formatCostEstimate({ ...base, costUSD: 12.345 })).toBe("$12.35");
  });
});
