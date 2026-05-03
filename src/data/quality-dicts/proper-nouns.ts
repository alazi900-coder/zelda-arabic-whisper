// Curated list of proper nouns (characters, places, items) that should NEVER
// be machine-translated. Entries are matched case-insensitively as whole tokens
// against the original English text. If the original mentions one of these,
// the translation should preserve it (or use an established Arabic transliteration).

export const PROPER_NOUNS: ReadonlyArray<{
  en: string;
  /** Acceptable Arabic transliterations (any of these in the translation is OK). */
  ar: string[];
  category: "character" | "place" | "item" | "race" | "concept";
}> = [
  // Characters
  { en: "Link", ar: ["لينك"], category: "character" },
  { en: "Zelda", ar: ["زيلدا"], category: "character" },
  { en: "Ganon", ar: ["غانون", "جانون"], category: "character" },
  { en: "Ganondorf", ar: ["غانوندورف", "جانوندورف"], category: "character" },
  { en: "Impa", ar: ["إمبا", "أمبا"], category: "character" },
  { en: "Sidon", ar: ["سيدون"], category: "character" },
  { en: "Riju", ar: ["ريجو", "ريجو"], category: "character" },
  { en: "Tulin", ar: ["تولين"], category: "character" },
  { en: "Yunobo", ar: ["يونوبو"], category: "character" },
  { en: "Mipha", ar: ["ميفا"], category: "character" },
  { en: "Daruk", ar: ["داروك"], category: "character" },
  { en: "Revali", ar: ["ريفالي"], category: "character" },
  { en: "Urbosa", ar: ["أوربوسا"], category: "character" },
  { en: "Rauru", ar: ["راورو"], category: "character" },
  { en: "Sonia", ar: ["سونيا"], category: "character" },
  { en: "Mineru", ar: ["مينيرو"], category: "character" },
  { en: "Purah", ar: ["بوراه", "بوره"], category: "character" },
  { en: "Robbie", ar: ["روبي"], category: "character" },
  { en: "Hudson", ar: ["هدسون"], category: "character" },

  // Places
  { en: "Hyrule", ar: ["هايرول"], category: "place" },
  { en: "Hyrulean", ar: ["هايرولي"], category: "place" },
  { en: "Hyrule Castle", ar: ["قلعة هايرول"], category: "place" },
  { en: "Hyrule Field", ar: ["سهل هايرول"], category: "place" },
  { en: "Lookout Landing", ar: ["مرسى المراقبة"], category: "place" },
  { en: "Lurelin", ar: ["لورلين"], category: "place" },
  { en: "Kakariko", ar: ["كاكاريكو"], category: "place" },
  { en: "Hateno", ar: ["هاتينو"], category: "place" },
  { en: "Tarrey Town", ar: ["بلدة تاري"], category: "place" },
  { en: "Goron City", ar: ["مدينة جورون"], category: "place" },
  { en: "Zora's Domain", ar: ["مملكة زورا"], category: "place" },
  { en: "Gerudo Town", ar: ["بلدة جيرودو"], category: "place" },
  { en: "Rito Village", ar: ["قرية ريتو"], category: "place" },
  { en: "Lanayru", ar: ["لانايرو"], category: "place" },
  { en: "Eldin", ar: ["إلدين"], category: "place" },
  { en: "Faron", ar: ["فارون"], category: "place" },
  { en: "Akkala", ar: ["أكالا"], category: "place" },
  { en: "Necluda", ar: ["نيكلودا"], category: "place" },
  { en: "Hebra", ar: ["هيبرا"], category: "place" },
  { en: "Tabantha", ar: ["تابانثا"], category: "place" },
  { en: "Death Mountain", ar: ["جبل الموت"], category: "place" },
  { en: "The Great Sky Island", ar: ["جزيرة السماء العظيمة"], category: "place" },
  { en: "The Depths", ar: ["الأعماق"], category: "place" },

  // Items / concepts
  { en: "Master Sword", ar: ["السيف الأسطوري"], category: "item" },
  { en: "Triforce", ar: ["ترايفورس"], category: "item" },
  { en: "Sheikah Slate", ar: ["لوح شيكا"], category: "item" },
  { en: "Purah Pad", ar: ["لوح بوراه"], category: "item" },
  { en: "Hylian Shield", ar: ["درع هايليا"], category: "item" },
  { en: "Light Dragon", ar: ["تنين النور"], category: "item" },
  { en: "Demon King", ar: ["ملك الشياطين"], category: "item" },
  { en: "Zonai", ar: ["زوناي"], category: "concept" },
  { en: "Sheikah", ar: ["شيكا"], category: "race" },
  { en: "Yiga", ar: ["ييغا", "ييجا"], category: "race" },
  { en: "Hylian", ar: ["هايليا"], category: "race" },
  { en: "Goron", ar: ["جورون", "غورون"], category: "race" },
  { en: "Zora", ar: ["زورا"], category: "race" },
  { en: "Gerudo", ar: ["جيرودو", "غيرودو"], category: "race" },
  { en: "Rito", ar: ["ريتو"], category: "race" },
  { en: "Korok", ar: ["كوروك"], category: "race" },
];

const PROPER_NOUN_TOKEN_RE = (() => {
  const keys = [...PROPER_NOUNS.map(p => p.en)].sort((a, b) => b.length - a.length);
  const escaped = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(`\\b(?:${escaped})\\b`, "giu");
})();

const PROPER_NOUN_LOOKUP = (() => {
  const m = new Map<string, (typeof PROPER_NOUNS)[number]>();
  for (const p of PROPER_NOUNS) m.set(p.en.toLowerCase(), p);
  return m;
})();

/**
 * Returns the list of proper nouns that appear in `original` along with the
 * accepted Arabic transliterations. Useful for verifying the translation does
 * not invent a different rendering.
 */
export function findProperNounsInOriginal(original: string): Array<{
  en: string;
  acceptable: string[];
  category: string;
}> {
  const matches = original.match(PROPER_NOUN_TOKEN_RE) || [];
  const out = new Map<string, { en: string; acceptable: string[]; category: string }>();
  for (const m of matches) {
    const p = PROPER_NOUN_LOOKUP.get(m.toLowerCase());
    if (p && !out.has(p.en)) {
      out.set(p.en, { en: p.en, acceptable: p.ar, category: p.category });
    }
  }
  return [...out.values()];
}
