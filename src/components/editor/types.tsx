import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export interface ExtractedEntry {
  msbtFile: string;
  index: number;
  label: string;
  original: string;
  maxBytes: number;
}

export interface EditorState {
  entries: ExtractedEntry[];
  translations: Record<string, string>;
  protectedEntries?: Set<string>;
  glossary?: string;
  technicalBypass?: Set<string>;
}

export interface ReviewIssue {
  key: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  original?: string;
  translation?: string;
}

export interface ReviewSummary {
  total: number;
  errors: number;
  warnings: number;
  checked: number;
}

export interface ReviewResults {
  issues: ReviewIssue[];
  summary: ReviewSummary;
}

export interface ShortSuggestion {
  key: string;
  original: string;
  current: string;
  suggested: string;
  currentBytes: number;
  suggestedBytes: number;
  maxBytes: number;
}

export interface ImproveResult {
  key: string;
  original: string;
  current: string;
  improved: string;
  reason: string;
  improvedBytes: number;
  maxBytes: number;
}

export interface FileCategory {
  id: string;
  label: string;
  emoji: string;
}

export const AUTOSAVE_DELAY = 1500;
export const AI_BATCH_SIZE = 30;
export const PAGE_SIZE = 50;
export const INPUT_DEBOUNCE = 300;

// Tag type config for color-coded display
export const TAG_TYPES: Record<string, { label: string; color: string; tooltip: string }> = {
  '\uFFF9': { label: '⚙', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', tooltip: 'رمز تحكم (إيقاف مؤقت، انتظار، سرعة نص)' },
  '\uFFFA': { label: '🎨', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', tooltip: 'رمز تنسيق (لون، حجم خط، روبي)' },
  '\uFFFB': { label: '📌', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', tooltip: 'متغير (اسم اللاعب، عدد، اسم عنصر)' },
};
export const TAG_FALLBACK = { label: '…', color: 'bg-muted text-muted-foreground', tooltip: 'رمز تقني خاص بمحرك اللعبة' };

export const FILE_CATEGORIES: FileCategory[] = [
  // قوائم اللعبة والواجهة
  { id: "main-menu", label: "القائمة الرئيسية", emoji: "🏠" },
  { id: "settings", label: "الإعدادات", emoji: "⚙️" },
  { id: "hud", label: "واجهة اللعب", emoji: "🖥️" },
  { id: "pause-menu", label: "قائمة الإيقاف", emoji: "⏸️" },
  // الأسلحة والمعدات
  { id: "swords", label: "السيوف", emoji: "⚔️" },
  { id: "spears", label: "الرماح", emoji: "🔱" },
  { id: "bows", label: "الأقواس", emoji: "🏹" },
  { id: "shields", label: "الدروع/التروس", emoji: "🛡️" },
  { id: "armor", label: "الملابس", emoji: "👕" },
  // العناصر والمواد
  { id: "food", label: "الطعام والطبخ", emoji: "🍖" },
  { id: "insects", label: "الحشرات والمخلوقات", emoji: "🦗" },
  { id: "enemy-parts", label: "أجزاء الوحوش", emoji: "🦴" },
  { id: "ores", label: "المعادن والأحجار", emoji: "💎" },
  { id: "materials", label: "المواد والموارد", emoji: "🧪" },
  { id: "zonai", label: "أدوات زوناي", emoji: "🔧" },
  { id: "special-tools", label: "أسهم وأدوات خاصة", emoji: "🏹" },
  { id: "fuse", label: "مواد الدمج (Fuse)", emoji: "🔗" },
  // الكائنات
  { id: "monsters", label: "الوحوش والأعداء", emoji: "👹" },
  { id: "npc", label: "الشخصيات (NPC)", emoji: "🎭" },
  // المحتوى
  { id: "story", label: "حوارات القصة", emoji: "📖" },
  { id: "challenge", label: "المهام والتحديات", emoji: "📜" },
  { id: "map", label: "المواقع والخرائط", emoji: "🗺️" },
  { id: "tips", label: "النصائح والتعليمات", emoji: "💡" },
];

// Check if text contains technical tag markers
export function hasTechnicalTags(text: string): boolean {
  return /[\uFFF9\uFFFA\uFFFB\uFFFC\uE000-\uE0FF]/.test(text);
}

// Locally restore missing control characters from original into translation
// without using AI — only inserts MISSING markers, preserving existing correct ones
// Keeps consecutive tag groups together (e.g. E000+E001+E002)
export function restoreTagsLocally(original: string, translation: string): string {
  const TAG_REGEX = /[\uFFF9-\uFFFC\uE000-\uE0FF]/g;
  const TAG_TEST = /[\uFFF9-\uFFFC\uE000-\uE0FF]/;
  
  const origMarkers = original.match(TAG_REGEX) || [];
  if (origMarkers.length === 0) return translation;
  
  const transMarkers = translation.match(TAG_REGEX) || [];
  if (transMarkers.length >= origMarkers.length) return translation;
  
  // Find which specific markers are present in translation
  const transMarkerSet = new Set(transMarkers);
  
  // Check if ANY markers are missing
  const someMissing = origMarkers.some(m => !transMarkerSet.has(m));
  if (!someMissing) return translation;
  
  // Extract consecutive tag GROUPS from original with their relative positions
  const origGroups: { chars: string; relPos: number }[] = [];
  let i = 0;
  while (i < original.length) {
    if (TAG_TEST.test(original[i])) {
      const start = i;
      let group = '';
      while (i < original.length && TAG_TEST.test(original[i])) {
        group += original[i];
        i++;
      }
      const midpoint = (start + i) / 2;
      origGroups.push({ chars: group, relPos: midpoint / Math.max(original.length, 1) });
    } else {
      i++;
    }
  }

  // For each group, check if ALL its chars are present. If any char is missing, the whole group needs re-insertion.
  const groupsToInsert: { chars: string; relPos: number }[] = [];
  for (const group of origGroups) {
    const groupChars = [...group.chars];
    const anyMissing = groupChars.some(c => !transMarkerSet.has(c));
    if (anyMissing) {
      groupsToInsert.push(group);
      // Remove any partial markers of this group from translation
      for (const c of groupChars) transMarkerSet.delete(c);
    }
  }
  
  if (groupsToInsert.length === 0) return translation;

  // Strip markers that belong to groups being re-inserted
  const charsToStrip = new Set(groupsToInsert.flatMap(g => [...g.chars]));
  let cleanTranslation = '';
  for (let j = 0; j < translation.length; j++) {
    if (charsToStrip.has(translation[j])) continue;
    cleanTranslation += translation[j];
  }

  // Find word boundary positions
  const plainText = cleanTranslation.replace(TAG_REGEX, '');
  const wordBoundaries = [0];
  for (let j = 0; j < plainText.length; j++) {
    if (plainText[j] === ' ' || plainText[j] === '\n') {
      wordBoundaries.push(j + 1);
    }
  }
  wordBoundaries.push(plainText.length);

  // Map each group to nearest word boundary
  const insertions: { pos: number; chars: string }[] = [];
  for (const group of groupsToInsert) {
    const rawPos = Math.round(group.relPos * plainText.length);
    let bestPos = rawPos;
    let bestDist = Infinity;
    for (const wb of wordBoundaries) {
      const dist = Math.abs(wb - rawPos);
      if (dist < bestDist) { bestDist = dist; bestPos = wb; }
    }
    insertions.push({ pos: bestPos, chars: group.chars });
  }

  // Sort by position descending to insert from end
  insertions.sort((a, b) => b.pos - a.pos);

  // Build position map from plain text to cleanTranslation (which may have surviving markers)
  const plainToClean: number[] = [];
  let pi = 0;
  for (let ci = 0; ci <= cleanTranslation.length; ci++) {
    if (ci === cleanTranslation.length || !TAG_TEST.test(cleanTranslation[ci])) {
      plainToClean.push(ci);
      pi++;
    }
  }

  let result = cleanTranslation;
  for (const ins of insertions) {
    const cleanPos = ins.pos < plainToClean.length ? plainToClean[ins.pos] : result.length;
    const pos = Math.min(cleanPos, result.length);
    result = result.slice(0, pos) + ins.chars + result.slice(pos);
    // Rebuild mapping after insertion (shift subsequent positions)
    for (let k = 0; k < plainToClean.length; k++) {
      if (plainToClean[k] >= pos) plainToClean[k] += ins.chars.length;
    }
  }

  return result;
}

// Preview tag restoration without applying — returns before/after
export function previewTagRestore(original: string, translation: string): { before: string; after: string; hasDiff: boolean } {
  const after = restoreTagsLocally(original, translation);
  return { before: translation, after, hasDiff: after !== translation };
}

// Sanitize original text: replace binary tag markers with color-coded, tooltipped badges
export function displayOriginal(text: string): React.ReactNode {
  // eslint-disable-next-line no-control-regex -- intentional: matches MSBT control bytes embedded in game text
  const regex = /([\uFFF9\uFFFA\uFFFB\uFFFC\uE000-\uE0FF\u0000-\u0008\u000E-\u001F]+)/g;
  const parts = text.split(regex);
  if (parts.length === 1 && !regex.test(text)) return text;
  const elements: React.ReactNode[] = [];
  let keyIdx = 0;
  for (const part of parts) {
    if (!part) continue;
    const firstCode = part.charCodeAt(0);
    // PUA markers (E000-E0FF) — render each one as an individual numbered badge
    if (firstCode >= 0xE000 && firstCode <= 0xE0FF) {
      for (let ci = 0; ci < part.length; ci++) {
        const code = part.charCodeAt(ci);
        if (code >= 0xE000 && code <= 0xE0FF) {
          const tagNum = code - 0xE000 + 1;
          elements.push(
            <Tooltip key={keyIdx++}>
              <TooltipTrigger asChild>
                <span
                  dir="ltr"
                  style={{ unicodeBidi: "isolate" }}
                  className="inline-block px-1 rounded border text-xs cursor-help mx-0.5 bg-blue-500/20 text-blue-400 border-blue-500/30 align-baseline"
                >
                  🏷{tagNum}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                رمز تحكم #{tagNum} — أيقونة زر أو تنسيق (لا تحذفه)
              </TooltipContent>
            </Tooltip>
          );
        }
      }
      continue;
    }
    // Legacy FFF9-FFFC markers or other control chars
    // eslint-disable-next-line no-control-regex -- intentional: detects MSBT control bytes
    const tagType = TAG_TYPES[part[0]] || (part.match(/[\uFFF9\uFFFA\uFFFB\uFFFC\u0000-\u0008\u000E-\u001F]/) ? TAG_FALLBACK : null);
    if (tagType) {
      elements.push(
        <Tooltip key={keyIdx++}>
          <TooltipTrigger asChild>
            <span
              dir="ltr"
              style={{ unicodeBidi: "isolate" }}
              className={`inline-block px-1 rounded border text-xs cursor-help mx-0.5 align-baseline ${tagType.color}`}
            >
              {tagType.label}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {tagType.tooltip}
          </TooltipContent>
        </Tooltip>
      );
      continue;
    }
    elements.push(<React.Fragment key={keyIdx++}>{part}</React.Fragment>);
  }
  return elements;
}

export function categorizeFile(filePath: string, label?: string): string {
  // === 1. فحص label أولاً (للتمييز داخل PouchContent وغيرها) ===
  if (label) {
    // السيوف
    if (/^Weapon_(Sword|Lsword|SmallSword)_/i.test(label)) return "swords";
    // الرماح
    if (/^Weapon_Spear_/i.test(label)) return "spears";
    // الأقواس
    if (/^Weapon_Bow_/i.test(label)) return "bows";
    // الدروع/التروس
    if (/^Weapon_Shield_/i.test(label)) return "shields";
    // الملابس
    if (/^(Obj_SubstituteCloth_|Armor_)/i.test(label)) return "armor";
    // الطعام والطبخ
    if (/^Item_(Cook|Fruit|Mushroom|Fish|Meat|PlantGet|Vegetable|Boiled)_/i.test(label)) return "food";
    // الحشرات والمخلوقات
    if (/^Animal_Insect_/i.test(label)) return "insects";
    // أجزاء الوحوش
    if (/^Item_Enemy_/i.test(label)) return "enemy-parts";
    // المعادن والأحجار
    if (/^Item_Ore_/i.test(label)) return "ores";
    // المواد والموارد
    if (/^(Item_Material_|Item_LumberjackTree_)/i.test(label)) return "materials";
    // أدوات زوناي
    if (/^SpObj_/i.test(label)) return "zonai";
    // أسهم وأدوات خاصة
    if (/^(NormalArrow_|Obj_UltraHand|PutRupee_|Obj_TreasureMap_)/i.test(label)) return "special-tools";
    // الوحوش (في PictureBook)
    if (/^Enemy_/i.test(label)) return "monsters";
  }

  // === 2. فحص اسم الملف (msbtFile) ===
  // قوائم اللعبة
  if (/LayoutMsg\/(Title|Boot|Save|Load|GameOver|Opening|Ending)/i.test(filePath)) return "main-menu";
  if (/LayoutMsg\/(Option|Config|Setting|System|Language|Control|Camera|Sound)/i.test(filePath)) return "settings";
  if (/LayoutMsg\/(Pause|Menu|Pouch|Inventory|Equipment|Status)/i.test(filePath)) return "pause-menu";
  if (/LayoutMsg\//i.test(filePath)) return "hud";

  // الوحوش والأعداء (ملفات PictureBook / Boss)
  if (/PictureBook|Boss/i.test(filePath)) return "monsters";
  // الشخصيات (NPC)
  if (/Npc\.msbt/i.test(filePath)) return "npc";
  // مواد الدمج (Fuse/Attachment)
  if (/Attachment\.msbt/i.test(filePath)) return "fuse";

  // المحتوى
  if (/EventFlowMsg\//i.test(filePath)) return "story";
  if (/ChallengeMsg\//i.test(filePath)) return "challenge";
  if (/LocationMsg\//i.test(filePath)) return "map";
  if (/StaticMsg\//i.test(filePath)) return "tips";

  return "other";
}

// Re-export from canonical source to avoid duplication
export { isArabicChar, hasArabicChars, reverseBidi as unReverseBidi } from "@/lib/arabic-processing";

/**
 * يحدّد إن كان النصّ مكوّناً فقط من رموز تقنية (PUA / FFF9-FFFC) ومسافات/علامات،
 * بدون أيّ حروف أو أرقام قابلة للترجمة. مثل هذه النصوص يجب ألا تُرسَل للذكاء
 * الاصطناعي لأنّ الترجمة ستُتلف الرموز وتتسبّب بظهور `??` داخل اللعبة.
 */
export function isOnlyTechnicalTags(text: string): boolean {
  if (!text) return false;
  const t = text.replace(/[\s\u00A0]/g, "");
  if (!t) return false;
  // كلّ المحارف رموز تقنية أو علامات ترقيم بسيطة، ولا يوجد أيّ حرف/رقم.
  if (/[\p{L}\p{N}]/u.test(t)) return false;
  // يجب أن يحتوي على رمز تقنيّ واحد على الأقلّ حتى نحميه (وإلا فهو نصّ فارغ من المعنى).
  return /[\uFFF9\uFFFA\uFFFB\uFFFC\uE000-\uE0FF]/.test(t);
}

export function isTechnicalText(text: string): boolean {
  if (isOnlyTechnicalTags(text)) return true;
  if (/^[0-9A-Fa-f\-._:/]+$/.test(text.trim())) return true;
  if (/\[[^\]]*\]/.test(text) && text.length < 50) return true;
  if (/<[^>]+>/.test(text)) return true;
  if (/[\\/][\w-]+[\\/]/i.test(text)) return true;
  if (text.length < 10 && /[{}()[\]<>|&%$#@!]/.test(text)) return true;
  if (/^[a-z]+([A-Z][a-z]*)+$|^[a-z]+(_[a-z]+)+$/.test(text.trim())) return true;
  return false;
}

export function entryKey(entry: ExtractedEntry): string {
  return `${entry.msbtFile}:${entry.index}`;
}
