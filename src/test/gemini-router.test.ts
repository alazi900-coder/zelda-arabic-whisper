import { describe, it, expect } from "vitest";
import { resolveGeminiModel } from "@/lib/gemini-router";

describe("resolveGeminiModel", () => {
  it("returns the explicit model unchanged when not 'auto'", () => {
    expect(resolveGeminiModel("gemini-2.5-flash-lite", [])).toBe("gemini-2.5-flash-lite");
    expect(resolveGeminiModel("gemini-2.5-flash", [{ original: "abc" }])).toBe("gemini-2.5-flash");
    expect(resolveGeminiModel("gemini-2.5-pro", [{ original: "x".repeat(500) }])).toBe("gemini-2.5-pro");
  });

  it("returns undefined when choice is undefined", () => {
    expect(resolveGeminiModel(undefined, [{ original: "abc" }])).toBeUndefined();
  });

  it("falls back to 2.5-flash when 'auto' with no entries", () => {
    expect(resolveGeminiModel("auto", [])).toBe("gemini-2.5-flash");
  });

  it("picks 2.5-flash-lite when 'auto' and longest entry < 80 chars", () => {
    expect(resolveGeminiModel("auto", [{ original: "Hello" }, { original: "Bye" }])).toBe("gemini-2.5-flash-lite");
    expect(resolveGeminiModel("auto", [{ original: "x".repeat(79) }])).toBe("gemini-2.5-flash-lite");
  });

  it("picks 2.5-flash when 'auto' and longest entry between 80 and 299 chars", () => {
    expect(resolveGeminiModel("auto", [{ original: "x".repeat(80) }])).toBe("gemini-2.5-flash");
    expect(resolveGeminiModel("auto", [{ original: "x".repeat(299) }])).toBe("gemini-2.5-flash");
  });

  it("picks 2.5-pro when 'auto' and longest entry >= 300 chars", () => {
    expect(resolveGeminiModel("auto", [{ original: "x".repeat(300) }])).toBe("gemini-2.5-pro");
    expect(resolveGeminiModel("auto", [{ original: "short" }, { original: "x".repeat(1000) }])).toBe("gemini-2.5-pro");
  });
});
