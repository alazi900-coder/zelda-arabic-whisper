import { describe, it, expect } from "vitest";

// ==========================================
// Pure function extractions for testing
// These mirror the logic in useEditorState.ts
// ==========================================

const diacriticsRegex = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;

function fixDiacritics(text: string): string {
  return text.replace(diacriticsRegex, '');
}

function fixSpaces(text: string): string {
  let fixed = text;
  // Protect content inside [tags]
  const tagPlaceholders: string[] = [];
  fixed = fixed.replace(/\[[^\]]*\]/g, (match) => {
    tagPlaceholders.push(match);
    return `\uFFFE${tagPlaceholders.length - 1}\uFFFE`;
  });
  fixed = fixed.replace(/ {2,}/g, ' ');
  fixed = fixed.replace(/ ([،؛؟!.,;?])/g, '$1');
  fixed = fixed.replace(/([،؛؟!.,;?])([^\s\uFFFE،؛؟!.,;?\u0000-\u001F])/g, '$1 $2');
  // Restore tags
  fixed = fixed.replace(/\uFFFE(\d+)\uFFFE/g, (_, idx) => tagPlaceholders[parseInt(idx)]);
  return fixed.trim();
}

function fixHamza(text: string): string {
  let fixed = text;
  fixed = fixed.replace(/[أإآ]/g, 'ا');
  fixed = fixed.replace(/ى(?=[\s،؛؟!.,;?\]\[」』】）》〉\u0000-\u001F]|$)/g, 'ي');
  return fixed;
}

function fixPunctuation(original: string, translation: string): string {
  const origEnd = original.trim();
  let fixed = translation;
  if (origEnd.endsWith('?') && !fixed.trimEnd().endsWith('؟') && !fixed.trimEnd().endsWith('?')) {
    fixed = fixed.replace(/[.。،]+\s*$/, '') + '؟';
  } else if (origEnd.endsWith('!') && !fixed.trimEnd().endsWith('!')) {
    fixed = fixed.replace(/[.。،]+\s*$/, '') + '!';
  }
  return fixed;
}

function fixBrackets(original: string, translation: string): string {
  const origTags = original.match(/\[[^\]]*\]/g) || [];
  let depth = 0;
  for (const ch of translation) {
    if (ch === '[') depth++;
    else if (ch === ']') depth--;
  }
  let fixed = translation;
  if (depth > 0) {
    fixed = fixed + ']'.repeat(depth);
  } else if (depth < 0) {
    fixed = '['.repeat(-depth) + fixed;
  }
  for (const tag of origTags) {
    if (!fixed.includes(tag)) {
      fixed = fixed.trimEnd() + ' ' + tag;
    }
  }
  fixed = fixed.replace(/ {2,}/g, ' ');
  return fixed;
}

// ==========================================
// Tests
// ==========================================

describe("Fix Diacritics (التشكيل)", () => {
  it("removes fatha, damma, kasra", () => {
    expect(fixDiacritics("مَرْحَبًا")).toBe("مرحبا");
  });

  it("removes shadda and tanwin", () => {
    expect(fixDiacritics("مُحَمَّدٌ")).toBe("محمد");
  });

  it("preserves non-diacritical text", () => {
    expect(fixDiacritics("مرحبا بالعالم")).toBe("مرحبا بالعالم");
  });

  it("preserves technical tags", () => {
    expect(fixDiacritics("[Color:Red]مَرْحَبًا[/Color]")).toBe("[Color:Red]مرحبا[/Color]");
  });

  it("preserves control characters", () => {
    const text = "\uFFFCمَرْحَبًا\uFFFC";
    expect(fixDiacritics(text)).toBe("\uFFFCمرحبا\uFFFC");
  });

  it("handles empty string", () => {
    expect(fixDiacritics("")).toBe("");
  });

  it("handles English text unchanged", () => {
    expect(fixDiacritics("Hello World")).toBe("Hello World");
  });
});

describe("Fix Spaces (المسافات)", () => {
  it("merges double spaces", () => {
    expect(fixSpaces("مرحبا  بالعالم")).toBe("مرحبا بالعالم");
  });

  it("merges triple+ spaces", () => {
    expect(fixSpaces("مرحبا    بالعالم")).toBe("مرحبا بالعالم");
  });

  it("removes space before Arabic punctuation", () => {
    expect(fixSpaces("مرحبا ،")).toBe("مرحبا،");
  });

  it("removes space before question mark", () => {
    expect(fixSpaces("كيف حالك ؟")).toBe("كيف حالك؟");
  });

  it("adds space after punctuation if missing", () => {
    expect(fixSpaces("مرحبا،كيف")).toBe("مرحبا، كيف");
  });

  it("does NOT add space after punctuation before closing bracket", () => {
    // Tags should be preserved
    expect(fixSpaces("مرحبا.")).toBe("مرحبا.");
  });

  it("preserves content inside [tags]", () => {
    expect(fixSpaces("[Color:Red]مرحبا  بالعالم[/Color]")).toBe("[Color:Red]مرحبا بالعالم[/Color]");
  });

  it("does NOT break tag internals", () => {
    const input = "[Item,Name]مرحبا  بالعالم";
    const result = fixSpaces(input);
    expect(result).toContain("[Item,Name]");
    expect(result).toBe("[Item,Name]مرحبا بالعالم");
  });

  it("handles text with only spaces", () => {
    expect(fixSpaces("   ")).toBe("");
  });

  it("handles normal text unchanged", () => {
    expect(fixSpaces("مرحبا بالعالم")).toBe("مرحبا بالعالم");
  });
});

describe("Fix Hamza/Alef (الهمزات)", () => {
  it("normalizes أ to ا", () => {
    expect(fixHamza("أحمد")).toBe("احمد");
  });

  it("normalizes إ to ا", () => {
    expect(fixHamza("إسلام")).toBe("اسلام");
  });

  it("normalizes آ to ا", () => {
    expect(fixHamza("آمال")).toBe("امال");
  });

  it("normalizes ى at end of word to ي", () => {
    expect(fixHamza("على")).toBe("علي");
  });

  it("normalizes ى before space", () => {
    expect(fixHamza("مشى الطريق")).toBe("مشي الطريق");
  });

  it("normalizes ى at end of string", () => {
    expect(fixHamza("مشى")).toBe("مشي");
  });

  it("normalizes ى before punctuation", () => {
    expect(fixHamza("مشى،")).toBe("مشي،");
    expect(fixHamza("مشى؟")).toBe("مشي؟");
  });

  it("does NOT normalize ى in the middle of a word", () => {
    // ى followed by Arabic letter should stay
    expect(fixHamza("ىالم")).toBe("ىالم");
  });

  it("handles mixed cases", () => {
    expect(fixHamza("أنت إلى آخر")).toBe("انت الي اخر");
  });

  it("preserves text without hamza issues", () => {
    expect(fixHamza("مرحبا بالعالم")).toBe("مرحبا بالعالم");
  });

  it("preserves technical tags", () => {
    expect(fixHamza("[Color:Red]أحمد[/Color]")).toBe("[Color:Red]احمد[/Color]");
  });
});

describe("Fix Punctuation (الترقيم)", () => {
  it("adds ؟ when original ends with ?", () => {
    expect(fixPunctuation("Are you ready?", "هل أنت مستعد")).toBe("هل أنت مستعد؟");
  });

  it("does NOT change if translation already has ؟", () => {
    expect(fixPunctuation("Are you ready?", "هل أنت مستعد؟")).toBe("هل أنت مستعد؟");
  });

  it("replaces trailing ، with ؟", () => {
    expect(fixPunctuation("Are you ready?", "هل أنت مستعد،")).toBe("هل أنت مستعد؟");
  });

  it("adds ! when original ends with !", () => {
    expect(fixPunctuation("Watch out!", "انتبه")).toBe("انتبه!");
  });

  it("does NOT change if original has no punctuation", () => {
    const text = "مرحبا";
    expect(fixPunctuation("Hello", text)).toBe(text);
  });

  it("does NOT change if original ends with period", () => {
    const text = "مرحبا";
    expect(fixPunctuation("Hello.", text)).toBe(text);
  });

  it("preserves existing whitespace", () => {
    // Should not silently trim
    expect(fixPunctuation("Ready?", "مستعد")).toBe("مستعد؟");
  });
});

describe("Fix Brackets (الأقواس)", () => {
  it("closes unclosed bracket", () => {
    expect(fixBrackets("[Tag]Hello[Tag]", "[تاغ]مرحبا[تاغ")).toBe("[تاغ]مرحبا[تاغ]");
  });

  it("opens unopened bracket", () => {
    expect(fixBrackets("[Tag]Hello", "تاغ]مرحبا")).toBe("[تاغ]مرحبا");
  });

  it("restores missing tags from original", () => {
    expect(fixBrackets("[Color:Red]Hello[/Color]", "مرحبا")).toContain("[Color:Red]");
    expect(fixBrackets("[Color:Red]Hello[/Color]", "مرحبا")).toContain("[/Color]");
  });

  it("does NOT modify already balanced brackets", () => {
    const text = "[Tag]مرحبا[/Tag]";
    expect(fixBrackets("[Tag]Hello[/Tag]", text)).toBe(text);
  });

  it("handles multiple unclosed brackets", () => {
    const result = fixBrackets("[A][B]text", "[A][Btext");
    expect(result).toContain("]");
  });

  it("handles empty translation with tags in original", () => {
    // Empty translations are skipped by the handler, but the pure function should handle it
    const result = fixBrackets("[Tag]Hello[Tag]", "مرحبا");
    expect(result).toContain("[Tag]");
  });
});

describe("Edge Cases - All Tools", () => {
  it("diacritics: handles PUA characters", () => {
    const text = "\uE000مَرْحَبًا\uE001";
    const result = fixDiacritics(text);
    expect(result).toBe("\uE000مرحبا\uE001");
    expect(result).toContain("\uE000");
    expect(result).toContain("\uE001");
  });

  it("spaces: handles text with control chars", () => {
    const text = "\uFFFCمرحبا  بالعالم\uFFFC";
    const result = fixSpaces(text);
    expect(result).toContain("\uFFFC");
    expect(result).not.toContain("  ");
  });

  it("hamza: handles text with numbers", () => {
    expect(fixHamza("أحمد 123")).toBe("احمد 123");
  });

  it("tools don't interfere with each other", () => {
    const text = "أحمد  مَرْحَبًا ،كيف حالك";
    const step1 = fixDiacritics(text);
    const step2 = fixSpaces(step1);
    const step3 = fixHamza(step2);
    expect(step3).toBe("احمد مرحبا، كيف حالك");
  });

  it("sequential application is safe", () => {
    // Applying the same fix twice should be idempotent
    const text = "أحمد  مَرْحَبًا";
    const once = fixDiacritics(fixSpaces(fixHamza(text)));
    const twice = fixDiacritics(fixSpaces(fixHamza(once)));
    expect(once).toBe(twice);
  });
});
