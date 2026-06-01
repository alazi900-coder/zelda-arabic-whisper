import { describe, it, expect } from "vitest";
import { findHamzaErrors } from "@/data/quality-dicts/hamza-dict";
import { findTaMarbutahErrors } from "@/data/quality-dicts/ta-marbutah-dict";
import { findCommonTypos } from "@/data/quality-dicts/common-typos";

// These tests guarantee that previously-flagged valid Arabic forms are
// no longer reported as errors. Each "it" describes a real-world false
// positive that pre-pruned dictionaries used to surface.

describe("hamza-dict no longer flags valid forms", () => {
  const valid = [
    "أستخدم السيف", // first person verb, hamzat al-qaṭʿ
    "أنتظر الفرصة",
    "أكتشف العالم",
    "أختار المسار",
    "أنطلق نحو القلعة",
    "أنّى لي ذلك", // istifham — ى is correct
    "لدي خمس قطع", // possessive "I have"
    "علي بن أبي طالب", // proper noun
    "إنه يعرف الطريق", // إنّه — valid emphatic
    "أنه شجاع", // أنّه — also valid
    "إنك بطل",
    "إني سعيد",
    "شكرا",
    "دائما يأتي",
    "تماما كما قلت",
    "آسف بالفعل",
  ];
  for (const text of valid) {
    it(`does not flag: ${text}`, () => {
      const { matches } = findHamzaErrors(text);
      expect(matches).toEqual([]);
    });
  }
});

describe("hamza-dict still catches real errors", () => {
  const cases: Array<[string, string]> = [
    ["انا ذاهب", "أنا"],
    ["انت بطل", "أنت"],
    ["اذا حدث", "إذا"],
    ["اكثر من ذلك", "أكثر"],
    ["انشاءالله", "إن شاء الله"],
    ["هاذا الرجل", "هذا"],
    ["لاكن السيف قوي", "لكن"],
    ["إستخدم السيف", "استخدم"],
    ["إنتظر هنا", "انتظر"],
    ["إكتشف الكنز", "اكتشف"],
    ["إختار اللون", "اختار"],
    ["الذيي قال", "الذي"],
  ];
  for (const [text, expected] of cases) {
    it(`flags ${text} → ${expected}`, () => {
      const { matches } = findHamzaErrors(text);
      expect(matches.some((m) => m.right === expected)).toBe(true);
    });
  }
});

describe("ta-marbutah-dict no longer flags verb conjugations", () => {
  const valid = [
    "قطعت الحبل", // I cut the rope
    "محاولت الأخيرة", // her last attempt (idafah)
    "مكافأت كثيرة", // many rewards (plural)
    "مهمت بهذا الأمر", // I cared about
    "مدينت الحب", // poetic possessive
    "سيارت الجديدة", // possessive
    "قاعت في السباق", // verb
    "شخصيت في الرواية", // possessive
    "طاقت الجسم", // possessive
    "مرحلت الجديدة", // possessive
    "خاصت العلاقة", // possessive
    "خرائط مفصلة", // plural noun
    "متجر كبير",
    "جبه في وجهي", // valid: "encountered me" / forehead form
  ];
  for (const text of valid) {
    it(`does not flag: ${text}`, () => {
      const { matches } = findTaMarbutahErrors(text);
      expect(matches).toEqual([]);
    });
  }
});

describe("ta-marbutah-dict still catches real errors", () => {
  const cases: Array<[string, string]> = [
    ["لعبه ممتعة", "لعبة"],
    ["معركه كبيرة", "معركة"],
    ["مهمه صعبة", "مهمة"],
    ["نهايه الفصل", "نهاية"],
    ["كلمه مفتاحية", "كلمة"],
    ["خريطه دقيقة", "خريطة"],
    ["لحضة واحدة", "لحظة"],
  ];
  for (const [text, expected] of cases) {
    it(`flags ${text} → ${expected}`, () => {
      const { matches } = findTaMarbutahErrors(text);
      expect(matches.some((m) => m.right === expected)).toBe(true);
    });
  }
});

describe("common-typos no longer flags stylistic tanween or valid nouns", () => {
  const valid = [
    "شكر لك", // valid noun "thanks"
    "وداع آخر", // valid noun "farewell"
    "شكرا لك", // tanween-less style
    "عفوا", // tanween-less style
    "لاحقا سنرى",
    "دائما يأتي",
    "تماما كما قلت",
    "جدا سعيد",
    "معا للأبد",
    "تقريبا انتهيت",
    "نهائيا فقدته",
    "شيئا جديدا",
    "كثيرا ما أراك",
    "انضماما متأخراً",
    "مبكرا في الصباح",
    "متأخرا قليلاً",
    "مرة ثانية",
    "معذرة منك",
  ];
  for (const text of valid) {
    it(`does not flag: ${text}`, () => {
      const { matches } = findCommonTypos(text);
      expect(matches).toEqual([]);
    });
  }
});

describe("common-typos still catches real errors", () => {
  const cases: Array<[string, string]> = [
    ["لاكن السيف ضاع", "لكن"],
    ["انشاءالله نلتقي", "إن شاء الله"],
    ["اعتقد ذلك", "أعتقد"],
    ["اريد الذهاب", "أريد"],
    ["تاءخر الموعد", "تأخر"],
    ["مسءولية كبيرة", "مسؤولية"],
    ["الاسلحة الجديدة", "الأسلحة"],
    ["لاول مرة", "لأول مرة"],
    ["مرة اخرى", "مرة أخرى"],
    ["اهلا بك", "أهلاً"],
  ];
  for (const [text, expected] of cases) {
    it(`flags ${text} → ${expected}`, () => {
      const { matches } = findCommonTypos(text);
      expect(matches.some((m) => m.right === expected)).toBe(true);
    });
  }
});
