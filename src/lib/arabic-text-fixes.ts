/**
 * Arabic text cleanup fixes (ported from Xenoblade, trimmed for Zelda).
 * Provides:
 *   - fixLonelyLam:        standalone 'ل' → 'لا' (negation)
 *   - fixTaaMarbutaHaa:    word ending in 'ه' that should end in 'ة'
 *
 * Both functions shield Zelda tags (`[Color:Red]`, `\uE000-\uF8FF`, `[A]/[B]`...)
 * before scanning so brackets/control chars are never modified.
 */

// === Tag protection (Zelda format) ===
const TAG_PATTERN = /[\uE000-\uF8FF]+|\[\s*\w+\s*:[^\]]*?\s*\]|\[\s*\w+\s*=\s*\w[^\]]*\]|\{\s*\w+\s*:\s*\w[^}]*\}|\{[\w]+\}|\[[A-Z]{1,3}\]|[\uFFF9-\uFFFC]+/g;

function shieldTags(text: string): { shielded: string; tags: string[] } {
  const tags: string[] = [];
  const shielded = text.replace(TAG_PATTERN, (m) => {
    tags.push(m);
    return `\uE800${tags.length - 1}\uE801`;
  });
  return { shielded, tags };
}

function unshieldTags(text: string, tags: string[]): string {
  return text.replace(/\uE800(\d+)\uE801/g, (match, i) => {
    const idx = parseInt(i, 10);
    return idx >= 0 && idx < tags.length ? tags[idx] : match;
  });
}

// ============================================================
// Lonely Lam (ل → لا)
// ============================================================

/**
 * Standalone 'ل' separated by whitespace is almost always a broken 'لا'
 * (negation) from AI output — the preposition 'ل' is always attached to
 * its noun (لِزيلدا), not free-standing.
 */
export function fixLonelyLam(text: string): { fixed: string; changes: number } {
  const { shielded, tags } = shieldTags(text);
  let changes = 0;
  let result = shielded;
  let prev = "";
  // Loop because /g may skip overlapping matches when 'ل ل ل' appears
  while (prev !== result) {
    prev = result;
    result = result.replace(/(^|\s)ل(\s|$)/g, (_match, before, after) => {
      changes++;
      return `${before}لا${after}`;
    });
  }
  return { fixed: unshieldTags(result, tags), changes };
}

// ============================================================
// Taa Marbuta vs Haa (ة vs ه)
// ============================================================

/**
 * Common Arabic words whose canonical spelling ends in ة (taa marbuta)
 * but AI sometimes writes them with ه (haa). Includes Zelda-specific
 * vocabulary (لعبة، مغامرة، مملكة، ...).
 */
const TAA_MARBUTA_WORDS = new Set<string>([
  // كلمات عامة شائعة
  "لعبة", "مرة", "قوة", "مهمة", "منطقة", "قطعة", "شخصية", "قصة", "معركة", "مغامرة",
  "رحلة", "جزيرة", "قرية", "مدينة", "قلعة", "غرفة", "ساحة", "طريقة", "حالة", "نتيجة",
  "مكافأة", "خريطة", "وصفة", "قائمة", "رسالة", "مشكلة", "فكرة", "ذاكرة", "صورة", "نسخة",
  "حركة", "ضربة", "هجمة", "دورة", "جولة", "محطة", "نقطة", "خطوة", "كلمة", "جملة",
  "قدرة", "مهارة", "سرعة", "قفزة", "لحظة", "فترة", "مرحلة", "بداية", "نهاية", "عودة",
  "أداة", "تجربة", "ميزة", "عملية", "حماية", "طاقة", "شجرة", "صخرة", "بحيرة",
  "مساحة", "مسافة", "سلسلة", "حلقة", "وحدة", "مجموعة", "درجة", "مرتبة", "رتبة",
  "عائلة", "ذكرى", "ثروة", "جائزة", "شارة", "علامة", "إشارة", "خزانة", "حقيبة", "زجاجة",
  "بوابة", "نافذة", "شاشة", "واجهة", "لوحة",
  "ترجمة", "لغة", "كتابة", "قراءة", "محادثة", "عبارة",
  // مصطلحات Zelda / Hyrule
  "مملكة", "إمبراطورية", "أميرة", "ملكة", "حكمة", "شجاعة", "قوة",
  "أسطورة", "حضارة", "إرادة", "حماية",
  "حادثة", "كارثة", "مؤامرة", "خيانة",
  "ذخيرة", "سفينة", "مركبة",
  "كنانة", "كنزة", "درعة", "ترسة",
  "بطولة", "ملحمة", "نبوءة", "تعويذة", "لعنة",
  // أسماء أعلام بنهايات شائعة (لو ترجمت)
  "هايلية", "شيكية", "غيرودية", "كوروكية",
  // مهارات وقدرات
  "ضربة", "جولة", "نوبة", "هجمة", "صدمة", "نوبة",
  // عناصر لعبة
  "حقيبة", "بطارية", "وصفة", "خريطة", "قطعة",
]);

export function fixTaaMarbutaHaa(text: string): { fixed: string; changes: number } {
  const { shielded, tags } = shieldTags(text);
  let changes = 0;
  // Split into words (preserving separators)
  const parts = shielded.split(/(\s+|[^\u0600-\u06FF\uE800\uE801\d]+)/);
  const fixed = parts.map((word) => {
    if (word.endsWith("ه") && word.length >= 2) {
      const withTaa = word.slice(0, -1) + "ة";
      if (TAA_MARBUTA_WORDS.has(withTaa)) {
        changes++;
        return withTaa;
      }
    }
    return word;
  });
  return { fixed: unshieldTags(fixed.join(""), tags), changes };
}
