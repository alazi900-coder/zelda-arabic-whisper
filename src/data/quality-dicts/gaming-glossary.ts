// Glossary of common gaming/UI terms in English with their preferred Arabic
// translations. Used by the QualityLab to detect untranslated tokens and to
// flag deviations from preferred terminology.

export const GAMING_GLOSSARY: ReadonlyArray<readonly [en: string, ar: string]> = [
  // UI verbs
  ["start", "ابدأ"],
  ["pause", "إيقاف مؤقت"],
  ["resume", "متابعة"],
  ["continue", "متابعة"],
  ["restart", "إعادة"],
  ["retry", "حاول مجدداً"],
  ["save", "حفظ"],
  ["load", "تحميل"],
  ["quit", "خروج"],
  ["exit", "خروج"],
  ["back", "رجوع"],
  ["next", "التالي"],
  ["previous", "السابق"],
  ["confirm", "تأكيد"],
  ["cancel", "إلغاء"],
  ["yes", "نعم"],
  ["no", "لا"],
  ["ok", "موافق"],
  ["select", "اختر"],
  ["choose", "اختر"],
  ["use", "استخدم"],
  ["equip", "تجهيز"],
  ["unequip", "إزالة التجهيز"],
  ["drop", "إسقاط"],
  ["pick up", "التقاط"],
  ["pickup", "التقاط"],
  ["buy", "شراء"],
  ["sell", "بيع"],
  ["trade", "مقايضة"],
  ["open", "فتح"],
  ["close", "إغلاق"],
  ["enter", "ادخل"],
  ["leave", "غادر"],
  ["talk", "تحدث"],
  ["search", "بحث"],
  ["explore", "استكشف"],

  // UI nouns
  ["menu", "القائمة"],
  ["main menu", "القائمة الرئيسية"],
  ["options", "الإعدادات"],
  ["settings", "الإعدادات"],
  ["help", "مساعدة"],
  ["credits", "الفريق"],
  ["title", "العنوان"],
  ["title screen", "شاشة العنوان"],
  ["loading", "جاري التحميل"],
  ["please wait", "يرجى الانتظار"],
  ["tutorial", "الدرس التعليمي"],
  ["controls", "أدوات التحكم"],
  ["language", "اللغة"],
  ["volume", "الصوت"],
  ["audio", "الصوت"],
  ["video", "الفيديو"],
  ["graphics", "الرسوم"],
  ["display", "العرض"],
  ["brightness", "السطوع"],
  ["fullscreen", "ملء الشاشة"],
  ["windowed", "نافذة"],

  // Gameplay
  ["item", "عنصر"],
  ["items", "العناصر"],
  ["inventory", "المخزون"],
  ["weapon", "سلاح"],
  ["weapons", "الأسلحة"],
  ["sword", "سيف"],
  ["shield", "درع"],
  ["bow", "قوس"],
  ["arrow", "سهم"],
  ["arrows", "السهام"],
  ["spear", "رمح"],
  ["axe", "فأس"],
  ["hammer", "مطرقة"],
  ["dagger", "خنجر"],
  ["staff", "عصا"],
  ["wand", "عصا سحرية"],
  ["armor", "درع جسد"],
  ["helmet", "خوذة"],
  ["boots", "حذاء"],
  ["gloves", "قفازات"],
  ["potion", "جرعة"],
  ["elixir", "إكسير"],
  ["food", "طعام"],
  ["material", "مادة"],
  ["materials", "المواد"],
  ["resource", "مورد"],
  ["resources", "الموارد"],
  ["currency", "عملة"],
  ["gold", "ذهب"],
  ["coin", "قطعة"],
  ["coins", "قطع نقدية"],
  ["gem", "جوهرة"],
  ["gems", "جواهر"],
  ["key", "مفتاح"],
  ["chest", "صندوق"],
  ["treasure", "كنز"],
  ["loot", "غنيمة"],

  // Locations
  ["map", "خريطة"],
  ["world", "عالم"],
  ["region", "منطقة"],
  ["area", "منطقة"],
  ["zone", "منطقة"],
  ["dungeon", "زنزانة"],
  ["castle", "قلعة"],
  ["tower", "برج"],
  ["temple", "معبد"],
  ["shrine", "مزار"],
  ["village", "قرية"],
  ["town", "بلدة"],
  ["city", "مدينة"],
  ["forest", "غابة"],
  ["mountain", "جبل"],
  ["mountains", "جبال"],
  ["river", "نهر"],
  ["lake", "بحيرة"],
  ["sea", "بحر"],
  ["ocean", "محيط"],
  ["desert", "صحراء"],
  ["plain", "سهل"],
  ["valley", "وادٍ"],
  ["cave", "كهف"],
  ["ruins", "أطلال"],

  // Status/Stats
  ["health", "الصحة"],
  ["hp", "الصحة"],
  ["life", "الحياة"],
  ["lives", "الأرواح"],
  ["mana", "المانا"],
  ["mp", "المانا"],
  ["magic", "السحر"],
  ["stamina", "القدرة"],
  ["energy", "الطاقة"],
  ["power", "القوة"],
  ["attack", "الهجوم"],
  ["defense", "الدفاع"],
  ["speed", "السرعة"],
  ["agility", "الرشاقة"],
  ["strength", "القوة"],
  ["intelligence", "الذكاء"],
  ["luck", "الحظ"],
  ["level", "المستوى"],
  ["experience", "الخبرة"],
  ["xp", "خبرة"],
  ["exp", "خبرة"],
  ["score", "النتيجة"],
  ["rank", "الرتبة"],

  // Quests / Story
  ["quest", "مهمة"],
  ["quests", "المهام"],
  ["mission", "مهمة"],
  ["missions", "المهام"],
  ["objective", "هدف"],
  ["objectives", "الأهداف"],
  ["goal", "هدف"],
  ["task", "مهمة"],
  ["tasks", "المهام"],
  ["story", "القصة"],
  ["chapter", "فصل"],
  ["scene", "مشهد"],
  ["cutscene", "مشهد سينمائي"],
  ["dialogue", "حوار"],
  ["choice", "خيار"],
  ["choices", "الخيارات"],

  // Combat
  ["enemy", "عدو"],
  ["enemies", "الأعداء"],
  ["boss", "زعيم"],
  ["minion", "تابع"],
  ["monster", "وحش"],
  ["monsters", "الوحوش"],
  ["damage", "ضرر"],
  ["heal", "علاج"],
  ["block", "صد"],
  ["parry", "صد"],
  ["dodge", "مراوغة"],
  ["counter", "هجوم مضاد"],
  ["combo", "سلسلة"],
  ["critical", "حرج"],
  ["critical hit", "ضربة حرجة"],
  ["miss", "فشل"],

  // Outcomes
  ["victory", "نصر"],
  ["defeat", "هزيمة"],
  ["game over", "انتهت اللعبة"],
  ["you win", "لقد فزت"],
  ["you lose", "لقد خسرت"],
  ["death", "موت"],
  ["respawn", "إحياء"],

  // Misc UI states
  ["new", "جديد"],
  ["old", "قديم"],
  ["empty", "فارغ"],
  ["full", "ممتلئ"],
  ["locked", "مغلق"],
  ["unlocked", "مفتوح"],
  ["available", "متاح"],
  ["unavailable", "غير متاح"],
  ["enabled", "مفعّل"],
  ["disabled", "معطّل"],
  ["on", "تشغيل"],
  ["off", "إيقاف"],
];

const GLOSSARY_LOOKUP = (() => {
  const m = new Map<string, string>();
  for (const [en, ar] of GAMING_GLOSSARY) {
    m.set(en.toLowerCase(), ar);
  }
  return m;
})();

const GLOSSARY_TOKEN_RE = (() => {
  // Build a single regex matching any glossary key as a whole-word token.
  // We sort by length descending to match multi-word terms first.
  const keys = [...GAMING_GLOSSARY.map(([en]) => en)].sort((a, b) => b.length - a.length);
  const escaped = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(`\\b(?:${escaped})\\b`, "giu");
})();

/**
 * Find English gaming terms inside the (presumably Arabic) translation that
 * have known Arabic equivalents in the glossary.
 */
export function findUntranslatedGamingTerms(text: string): Array<{ en: string; ar: string }> {
  const out: Array<{ en: string; ar: string }> = [];
  const seen = new Set<string>();
  const matches = text.match(GLOSSARY_TOKEN_RE) || [];
  for (const m of matches) {
    const key = m.toLowerCase();
    if (seen.has(key)) continue;
    const ar = GLOSSARY_LOOKUP.get(key);
    if (ar) {
      out.push({ en: m, ar });
      seen.add(key);
    }
  }
  return out;
}

export function lookupGlossary(en: string): string | null {
  return GLOSSARY_LOOKUP.get(en.toLowerCase()) ?? null;
}
