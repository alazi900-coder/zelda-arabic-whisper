import { describe, it, expect } from "vitest";
import { parseEmailList, pickNextEmail } from "@/lib/mymemory-rotation";

describe("parseEmailList", () => {
  it("returns empty for null/empty", () => {
    expect(parseEmailList(undefined)).toEqual([]);
    expect(parseEmailList(null)).toEqual([]);
    expect(parseEmailList("")).toEqual([]);
    expect(parseEmailList("   ")).toEqual([]);
  });

  it("parses single email", () => {
    expect(parseEmailList("user@example.com")).toEqual(["user@example.com"]);
  });

  it("parses comma-separated emails", () => {
    expect(parseEmailList("a@b.com,c@d.com,e@f.com")).toEqual(["a@b.com", "c@d.com", "e@f.com"]);
  });

  it("parses newline-separated emails", () => {
    expect(parseEmailList("a@b.com\nc@d.com")).toEqual(["a@b.com", "c@d.com"]);
  });

  it("parses mixed separators", () => {
    expect(parseEmailList("a@b.com\nc@d.com, e@f.com;g@h.com")).toEqual([
      "a@b.com", "c@d.com", "e@f.com", "g@h.com",
    ]);
  });

  it("trims whitespace and lowercases", () => {
    expect(parseEmailList("  USER@example.COM  ")).toEqual(["user@example.com"]);
  });

  it("dedupes after lowercase", () => {
    expect(parseEmailList("user@x.com,USER@x.com")).toEqual(["user@x.com"]);
  });

  it("drops invalid addresses", () => {
    expect(parseEmailList("not-an-email,valid@x.com,@nope")).toEqual(["valid@x.com"]);
  });
});

describe("pickNextEmail", () => {
  it("returns empty when no emails", () => {
    const r = pickNextEmail([]);
    expect(r).toEqual({ email: "", nextIndex: 0, total: 0 });
  });

  it("picks the first email at index 0", () => {
    const r = pickNextEmail(["a@x.com", "b@x.com"], 0);
    expect(r.email).toBe("a@x.com");
    expect(r.nextIndex).toBe(1);
    expect(r.total).toBe(2);
  });

  it("rotates through all emails", () => {
    const list = ["a@x.com", "b@x.com", "c@x.com"];
    let idx = 0;
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = pickNextEmail(list, idx);
      seen.push(r.email);
      idx = r.nextIndex;
    }
    expect(seen).toEqual(["a@x.com", "b@x.com", "c@x.com", "a@x.com", "b@x.com", "c@x.com"]);
  });

  it("normalizes out-of-range indices", () => {
    const list = ["a@x.com", "b@x.com"];
    expect(pickNextEmail(list, 7).email).toBe("b@x.com");
    expect(pickNextEmail(list, -1).email).toBe("b@x.com");
  });
});
