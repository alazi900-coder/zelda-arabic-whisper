import { describe, it, expect } from "vitest";
import {
  wordsJaccard,
  orderOverlap,
  isOrderComparable,
} from "@/lib/back-translate";

const GOOGLE_PRESENCE_THRESHOLD = 0.7;
const GOOGLE_ORDER_THRESHOLD = 0.4;

function fires(original: string, backTranslated: string): boolean {
  if (!isOrderComparable(original, backTranslated)) return false;
  const presence = wordsJaccard(original, backTranslated);
  const order = orderOverlap(original, backTranslated);
  return presence >= GOOGLE_PRESENCE_THRESHOLD && order < GOOGLE_ORDER_THRESHOLD;
}

describe("isOrderComparable", () => {
  it("rejects single-word inputs (the 'Someday...' false-positive case)", () => {
    expect(isOrderComparable("Someday...", "someday...")).toBe(false);
    expect(isOrderComparable("...here...", "...here...")).toBe(false);
  });

  it("rejects two-word inputs (only 1 bigram, metric is binary)", () => {
    expect(isOrderComparable("Hello world", "world hello")).toBe(false);
  });

  it("accepts inputs with ≥3 tokens on both sides", () => {
    expect(isOrderComparable("the quick brown fox", "fox brown quick the")).toBe(true);
  });

  it("rejects when one side has <3 tokens even if the other is long", () => {
    expect(isOrderComparable("Hello", "the quick brown fox jumps")).toBe(false);
    expect(isOrderComparable("the quick brown fox jumps", "Hi")).toBe(false);
  });
});

describe("Google check rule 1 (wrong-order) gating", () => {
  it("does NOT fire on the reported 'Someday...' / 'يوما ما...' case", () => {
    expect(fires("Someday...", "someday...")).toBe(false);
  });

  it("does NOT fire on the reported '...here...' / '...هنا...' case", () => {
    expect(fires("...here...", "here...")).toBe(false);
  });

  it("does NOT fire on short multi-word translations", () => {
    expect(fires("Hello world", "world hello")).toBe(false);
  });

  it("DOES fire on a real reorder bug in a long-enough sentence", () => {
    expect(
      fires(
        "the quick brown fox jumps over the lazy dog",
        "dog lazy the over jumps fox brown quick the",
      ),
    ).toBe(true);
  });

  it("does NOT fire when both sentences are well-ordered", () => {
    expect(
      fires(
        "the quick brown fox jumps over",
        "the quick brown fox jumps over",
      ),
    ).toBe(false);
  });
});
