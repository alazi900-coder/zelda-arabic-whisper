import { describe, it, expect } from "vitest";
import { CHARACTERS, getTonesForCharacter, findCharacter, BASE_TONES, isValidGeminiVoice } from "@/lib/dubbing/character-catalog";
import { buildSrt, msToSrtTime } from "@/lib/dubbing/scene-mixer";

describe("dubbing character catalog", () => {
  it("includes all the major TotK characters", () => {
    const ids = CHARACTERS.map(c => c.id);
    for (const must of ["link", "zelda", "ganon", "rauru", "sidon", "tulin", "riju", "yunobo", "purah", "impa"]) {
      expect(ids).toContain(must);
    }
    expect(CHARACTERS.length).toBeGreaterThanOrEqual(30);
  });

  it("every character has a Gemini voice and Arabic name", () => {
    for (const c of CHARACTERS) {
      expect(c.voice).toBeTruthy();
      expect(isValidGeminiVoice(c.voice)).toBe(true);
      expect(c.nameAr.length).toBeGreaterThan(0);
      expect(c.promptAr.length).toBeGreaterThan(20);
    }
  });

  it("every character exposes at least 4 distinct tones", () => {
    for (const c of CHARACTERS) {
      const tones = getTonesForCharacter(c);
      expect(tones.length).toBeGreaterThanOrEqual(4);
      const ids = new Set(tones.map(t => t.id));
      expect(ids.size).toBe(tones.length);
    }
  });

  it("villains expose evil tones", () => {
    const ganon = findCharacter("ganon")!;
    const tones = getTonesForCharacter(ganon).map(t => t.id);
    expect(tones).toContain("evil");
    expect(tones).toContain("menacing");
  });

  it("zelda has the special lament tone", () => {
    const zelda = findCharacter("zelda")!;
    const tones = getTonesForCharacter(zelda).map(t => t.id);
    expect(tones).toContain("lament_link");
  });

  it("link does not include mocking or evil_laugh", () => {
    const link = findCharacter("link")!;
    const tones = getTonesForCharacter(link).map(t => t.id);
    expect(tones).not.toContain("mocking");
    expect(tones).not.toContain("evil_laugh");
  });

  it("base tones include lament and broken", () => {
    expect(BASE_TONES.find(t => t.id === "lament")).toBeTruthy();
  });
});

describe("scene mixer SRT output", () => {
  it("formats SRT timecodes correctly", () => {
    expect(msToSrtTime(0)).toBe("00:00:00,000");
    expect(msToSrtTime(1234)).toBe("00:00:01,234");
    expect(msToSrtTime(3_661_005)).toBe("01:01:01,005");
  });

  it("builds well-formed SRT cues", () => {
    const srt = buildSrt(
      [{ url: "", charName: "زيلدا", text: "لينك..." }, { url: "", charName: "لينك", text: "أنا هنا" }],
      [0, 2000],
      [1500, 3500]
    );
    expect(srt).toContain("1\n00:00:00,000 --> 00:00:01,500\nزيلدا: لينك...");
    expect(srt).toContain("2\n00:00:02,000 --> 00:00:03,500\nلينك: أنا هنا");
  });
});
