import type { ExtractedEntry } from "@/components/editor/types";

export type ReorderMethod = "phrase" | "duplicate" | "sequence" | "nearest";

export interface ReorderSuggestion {
  key: string;
  sourceKey?: string;
  original: string;
  current: string;
  suggested: string;
  confidence: number;
  method: ReorderMethod;
  problem: string;
  reason: string;
  evidence: string[];
}

export interface ReorderScanOptions {
  scope?: "file" | "project";
  aggressiveness?: "safe" | "balanced" | "strong";
}

export interface ReorderScanReport {
  suggestions: ReorderSuggestion[];
  scanned: number;
  translated: number;
  byMethod: Record<ReorderMethod, number>;
  aborted?: boolean;
}

export type ReorderScanPhase =
  | "preparing"
  | "phrase"
  | "duplicate"
  | "sequence"
  | "nearest"
  | "done"
  | "aborted";

export interface ReorderScanProgress {
  phase: ReorderScanPhase;
  processed: number;
  total: number;
  found: number;
}

export interface ReorderScanCallbacks {
  signal?: AbortSignal;
  onProgress?: (info: ReorderScanProgress) => void;
  onPartial?: (suggestions: ReorderSuggestion[]) => void;
}

interface EntryRecord {
  key: string;
  entry: ExtractedEntry;
  translation: string;
  fileIndex: number;
}

type CandidateRecord = EntryRecord;

interface ScoredCandidate {
  candidate: CandidateRecord;
  score: number;
  evidence: string[];
}

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const TAG_RE = /\[[^\]]+\]|[\uFFF9-\uFFFC\uE000-\uE0FF]/g;
const DIACRITICS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;

const SOURCE_PHRASES: Record<string, string> = {
  no: "لا",
  nope: "لا",
  yes: "نعم",
  ok: "حسنًا",
  okay: "حسنًا",
  cancel: "إلغاء",
  close: "إغلاق",
  open: "فتح",
  back: "رجوع",
  next: "التالي",
  continue: "متابعة",
  start: "ابدأ",
  pause: "إيقاف مؤقت",
  save: "حفظ",
  load: "تحميل",
  retry: "إعادة المحاولة",
  quit: "خروج",
  exit: "خروج",
  confirm: "تأكيد",
  select: "اختيار",
  settings: "الإعدادات",
  options: "الخيارات",
  menu: "القائمة",
  map: "الخريطة",
  inventory: "المخزون",
  items: "العناصر",
  item: "عنصر",
  weapon: "سلاح",
  weapons: "أسلحة",
  shield: "درع",
  shields: "دروع",
  bow: "قوس",
  arrows: "سهام",
  arrow: "سهم",
  sword: "سيف",
  armor: "درع",
  quest: "مهمة",
  quests: "مهام",
  loading: "جارٍ التحميل",
  complete: "مكتمل",
  completed: "مكتمل",
  failed: "فشل",
  new: "جديد",
  delete: "حذف",
  remove: "إزالة",
  equip: "تجهيز",
  use: "استخدام",
  buy: "شراء",
  sell: "بيع",
  help: "مساعدة",
};

const TERM_HINTS: Record<string, string[]> = {
  no: ["لا"], yes: ["نعم"], cancel: ["إلغاء"], back: ["رجوع", "عودة"], next: ["التالي"],
  save: ["حفظ"], load: ["تحميل"], map: ["خريطة", "الخريطة"], quest: ["مهمة", "المهمة"],
  item: ["عنصر", "العنصر"], weapon: ["سلاح", "السلاح"], shield: ["درع"], sword: ["سيف"],
  bow: ["قوس"], arrow: ["سهم", "سهام"], armor: ["درع", "ملابس"], settings: ["إعدادات", "الإعدادات"],
  menu: ["قائمة", "القائمة"], open: ["فتح", "افتح"], close: ["إغلاق", "أغلق"],
  equip: ["تجهيز", "جهّز"], use: ["استخدام", "استخدم"], buy: ["شراء", "اشتر"], sell: ["بيع", "بع"],
};

const METHOD_PROBLEM: Record<ReorderMethod, string> = {
  phrase: "ترجمة قصيرة موضوعة في خانة خاطئة",
  duplicate: "نفس النص الأصلي لا يستخدم نفس الترجمة",
  sequence: "كتلة ترجمات مستوردة بترتيب مختلف",
  nearest: "ترجمة أقرب لنص أصلي آخر",
};

const METHOD_REASON: Record<ReorderMethod, string> = {
  phrase: "النص الأصلي عبارة واجهة قصيرة معروفة ويمكن مطابقتها محليًا بثقة عالية دون اتصال.",
  duplicate: "تكرر نفس النص الأصلي في أكثر من موضع، لذلك يجب أن يحمل نفس الترجمة المعتمدة بدل ترجمة مختلفة.",
  sequence: "تم اكتشاف نمط انزياح أو عكس ترتيب داخل الملف اعتمادًا على الطول، الأرقام، العلامات، علامات السؤال والتعجب، والأسطر.",
  nearest: "الترجمة الحالية ضعيفة لهذا السطر، بينما توجد ترجمة أخرى في المشروع تطابق إشارات هذا السطر بشكل أوضح.",
};

function keyOf(entry: ExtractedEntry): string {
  return `${entry.msbtFile}:${entry.index}`;
}

function stripTags(text: string): string {
  return text.replace(TAG_RE, " ");
}

function normalizeArabic(text: string): string {
  return stripTags(text)
    .replace(DIACRITICS_RE, "")
    .replace(/[ـ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[،؛:!؟?.,…"'()[\]{}<>«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSource(text: string): string {
  return stripTags(text)
    .toLowerCase()
    .replace(/[“”‘’]/g, "'")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9'\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceTokens(text: string): string[] {
  return normalizeSource(text).split(/\s+/).filter(Boolean);
}

function terminalOf(text: string): "question" | "exclaim" | "period" | "ellipsis" | "none" {
  const s = stripTags(text).trim();
  if (/[?؟]$/.test(s)) return "question";
  if (/!$/.test(s)) return "exclaim";
  if (/…$|\.\.\.$/.test(s)) return "ellipsis";
  if (/\.$/.test(s)) return "period";
  return "none";
}

function applyTerminal(base: string, original: string): string {
  const terminal = terminalOf(original);
  if (terminal === "question") return `${base}؟`;
  if (terminal === "exclaim") return `${base}!`;
  if (terminal === "ellipsis") return `${base}…`;
  if (terminal === "period") return `${base}.`;
  return base;
}

function expectedPhrase(original: string): string | null {
  const clean = normalizeSource(original);
  if (!clean) return null;
  const direct = SOURCE_PHRASES[clean];
  if (direct) return applyTerminal(direct, original);
  const tokens = clean.split(" ");
  if (tokens.length === 1 && SOURCE_PHRASES[tokens[0]]) return applyTerminal(SOURCE_PHRASES[tokens[0]], original);
  return null;
}

function tagsSignature(text: string): string[] {
  return text.match(TAG_RE) ?? [];
}

function numberSignature(text: string): string[] {
  return stripTags(text).match(/\d+(?:[.,]\d+)?/g) ?? [];
}

function roughSentenceCount(text: string): number {
  const clean = stripTags(text).trim();
  if (!clean) return 0;
  return Math.max(1, clean.split(/[.!?؟…]+/).filter((p) => p.trim().length > 0).length);
}

function sameArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function baseScore(entry: ExtractedEntry, translation: string): { score: number; evidence: string[] } {
  if (!translation.trim()) return { score: -100, evidence: ["الترجمة فارغة"] };
  const original = entry.original;
  const evidence: string[] = [];
  let score = 0;

  const expected = expectedPhrase(original);
  if (expected) {
    const expectedNorm = normalizeArabic(expected);
    const transNorm = normalizeArabic(translation);
    if (transNorm === expectedNorm) {
      score += 92;
      evidence.push("عبارة قصيرة مطابقة للقاموس المحلي");
    } else if (transNorm.includes(expectedNorm) || expectedNorm.includes(transNorm)) {
      score += 72;
      evidence.push("قريبة من العبارة المحلية المتوقعة");
    } else {
      score -= 12;
    }
  }

  const oTags = tagsSignature(original);
  const tTags = tagsSignature(translation);
  if (oTags.length || tTags.length) {
    if (sameArray(oTags, tTags)) {
      score += 20;
      evidence.push("الوسوم التقنية بنفس العدد والترتيب");
    } else if (oTags.length === tTags.length) {
      score += 10;
      evidence.push("عدد الوسوم التقنية متطابق");
    } else {
      score -= 25;
    }
  }

  const oNums = numberSignature(original);
  const tNums = numberSignature(translation);
  if (oNums.length || tNums.length) {
    if (sameArray(oNums, tNums)) {
      score += 16;
      evidence.push("الأرقام متطابقة");
    } else if (oNums.length === tNums.length) {
      score += 5;
    } else {
      score -= 14;
    }
  }

  const oTerminal = terminalOf(original);
  const tTerminal = terminalOf(translation);
  if (oTerminal !== "none") {
    if (oTerminal === tTerminal || (oTerminal === "question" && /[؟?]$/.test(translation.trim()))) {
      score += 10;
      evidence.push("علامة نهاية الجملة مناسبة");
    } else {
      score -= 7;
    }
  }

  const oLines = original.split("\n").length;
  const tLines = translation.split("\n").length;
  if (oLines > 1 || tLines > 1) {
    if (oLines === tLines) {
      score += 12;
      evidence.push("عدد الأسطر متطابق");
    } else {
      score -= 12;
    }
  }

  const oSentences = roughSentenceCount(original);
  const tSentences = roughSentenceCount(translation);
  if (oSentences > 1 || tSentences > 1) {
    const diff = Math.abs(oSentences - tSentences);
    if (diff === 0) score += 8;
    else if (diff > 1) score -= 8;
  }

  const cleanOriginalLen = stripTags(original).replace(/\s+/g, " ").trim().length;
  const cleanTranslationLen = stripTags(translation).replace(/\s+/g, " ").trim().length;
  if (cleanOriginalLen > 0 && cleanTranslationLen > 0) {
    const ratio = cleanTranslationLen / cleanOriginalLen;
    if (ratio >= 0.35 && ratio <= 2.2) {
      score += 10;
      evidence.push("الطول مناسب لحجم النص الأصلي");
    } else if (ratio < 0.18 || ratio > 3.2) {
      score -= 18;
    } else {
      score -= 5;
    }
  }

  const tokens = sourceTokens(original);
  let termHits = 0;
  const normalizedTranslation = normalizeArabic(translation);
  for (const token of tokens) {
    const hints = TERM_HINTS[token];
    if (!hints) continue;
    if (hints.some((hint) => normalizedTranslation.includes(normalizeArabic(hint)))) termHits++;
  }
  if (termHits > 0) {
    score += Math.min(24, termHits * 8);
    evidence.push("مصطلحات محلية متوافقة مع النص الأصلي");
  }

  const cleanTranslation = stripTags(translation).trim();
  if (/[A-Za-z]{3,}/.test(cleanTranslation) && !ARABIC_RE.test(cleanTranslation)) score -= 22;
  if (normalizeSource(original).length >= 4 && normalizeSource(original) === normalizeSource(cleanTranslation)) score -= 35;

  return { score, evidence };
}

function scoreCandidate(entry: EntryRecord, candidate: CandidateRecord, scope: "file" | "project"): ScoredCandidate {
  const base = baseScore(entry.entry, candidate.translation);
  let score = base.score;
  const evidence = [...base.evidence];
  if (entry.entry.msbtFile === candidate.entry.msbtFile) {
    score += 8;
    const distance = Math.abs(entry.fileIndex - candidate.fileIndex);
    if (distance > 0 && distance <= 3) score += 8;
    else if (distance <= 12) score += 5;
    else if (distance <= 35) score += 2;
  } else if (scope === "project") {
    score -= 6;
  }
  return { candidate, score, evidence };
}

function thresholds(mode: ReorderScanOptions["aggressiveness"]): { phrase: number; nearest: number; gap: number; sequenceAvg: number; sequenceGap: number } {
  if (mode === "strong") return { phrase: 70, nearest: 44, gap: 10, sequenceAvg: 28, sequenceGap: 7 };
  if (mode === "safe") return { phrase: 78, nearest: 58, gap: 20, sequenceAvg: 38, sequenceGap: 13 };
  return { phrase: 74, nearest: 50, gap: 15, sequenceAvg: 33, sequenceGap: 10 };
}

function addSuggestion(map: Map<string, ReorderSuggestion>, suggestion: ReorderSuggestion) {
  const existing = map.get(suggestion.key);
  if (!existing || suggestion.confidence > existing.confidence) map.set(suggestion.key, suggestion);
}

// Yield back to the browser/event loop so the UI can repaint and stay
// responsive during long scans. Without these yields, large projects
// (~29k+ entries) caused a multi-minute main-thread freeze.
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function recordsFrom(entries: ExtractedEntry[], translations: Record<string, string>): EntryRecord[] {
  const byFileCounter = new Map<string, number>();
  return entries.map((entry) => {
    const count = byFileCounter.get(entry.msbtFile) ?? 0;
    byFileCounter.set(entry.msbtFile, count + 1);
    const key = keyOf(entry);
    return { key, entry, translation: translations[key] ?? "", fileIndex: count };
  });
}

function phraseSuggestions(records: EntryRecord[], out: Map<string, ReorderSuggestion>, minScore: number) {
  for (const record of records) {
    const expected = expectedPhrase(record.entry.original);
    if (!expected) continue;
    if (normalizeArabic(record.translation) === normalizeArabic(expected)) continue;
    const scored = baseScore(record.entry, expected);
    if (scored.score < minScore) continue;
    addSuggestion(out, {
      key: record.key,
      original: record.entry.original,
      current: record.translation,
      suggested: expected,
      confidence: Math.min(99, scored.score),
      method: "phrase",
      problem: METHOD_PROBLEM.phrase,
      reason: METHOD_REASON.phrase,
      evidence: ["تصحيح محلي لعبارة قصيرة", ...scored.evidence],
    });
  }
}

function duplicateSuggestions(records: EntryRecord[], out: Map<string, ReorderSuggestion>) {
  const groups = new Map<string, EntryRecord[]>();
  for (const record of records) {
    const sig = normalizeSource(record.entry.original);
    if (!sig || sig.length < 2) continue;
    const list = groups.get(sig) ?? [];
    list.push(record);
    groups.set(sig, list);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const expected = expectedPhrase(group[0].entry.original);
    let chosen = expected ?? "";
    if (!chosen) {
      const counts = new Map<string, { text: string; count: number }>();
      for (const record of group) {
        if (!record.translation.trim() || !ARABIC_RE.test(record.translation)) continue;
        const norm = normalizeArabic(record.translation);
        if (!norm) continue;
        const item = counts.get(norm) ?? { text: record.translation, count: 0 };
        item.count++;
        counts.set(norm, item);
      }
      const ranked = [...counts.values()].sort((a, b) => b.count - a.count);
      if (ranked[0] && ranked[0].count >= 2 && ranked[0].count / group.length >= 0.5) chosen = ranked[0].text;
    }
    if (!chosen) continue;
    for (const record of group) {
      if (normalizeArabic(record.translation) === normalizeArabic(chosen)) continue;
      addSuggestion(out, {
        key: record.key,
        original: record.entry.original,
        current: record.translation,
        suggested: chosen,
        confidence: expected ? 96 : 82,
        method: "duplicate",
        problem: METHOD_PROBLEM.duplicate,
        reason: METHOD_REASON.duplicate,
        evidence: ["نفس النص الأصلي موجود في مواضع أخرى", "تم توحيد الترجمة محليًا"],
      });
    }
  }
}

async function findBestSequence(
  records: EntryRecord[],
  mode: ReorderScanOptions["aggressiveness"],
  signal?: AbortSignal,
  onProgress?: (processedFiles: number, totalFiles: number, found: number) => void,
): Promise<ReorderSuggestion[]> {
  const t = thresholds(mode);
  const byFile = new Map<string, EntryRecord[]>();
  for (const record of records) {
    const list = byFile.get(record.entry.msbtFile) ?? [];
    list.push(record);
    byFile.set(record.entry.msbtFile, list);
  }
  const suggestions: ReorderSuggestion[] = [];
  const totalFiles = byFile.size;
  let processedFiles = 0;

  for (const fileRecords of byFile.values()) {
    if (signal?.aborted) break;
    const translated = fileRecords.filter((r) => r.translation.trim());
    if (translated.length < 4) continue;
    const n = fileRecords.length;
    const currentScores = fileRecords.map((r) => baseScore(r.entry, r.translation).score);
    const currentAvg = currentScores.reduce((s, v) => s + v, 0) / Math.max(1, currentScores.length);

    type Transform = { kind: "offset" | "reverse"; offset: number; avg: number; pairs: Array<{ target: EntryRecord; source: EntryRecord; score: number; evidence: string[] }> };
    const transforms: Transform[] = [];
    const maxOffset = Math.min(80, Math.max(3, n - 1));
    for (const kind of ["offset", "reverse"] as const) {
      for (let offset = -maxOffset; offset <= maxOffset; offset++) {
        if (kind === "offset" && offset === 0) continue;
        const pairs: Transform["pairs"] = [];
        for (let i = 0; i < n; i++) {
          const j = kind === "offset" ? i + offset : n - 1 - i + offset;
          if (j < 0 || j >= n) continue;
          const source = fileRecords[j];
          if (!source.translation.trim() || source.key === fileRecords[i].key) continue;
          const scored = baseScore(fileRecords[i].entry, source.translation);
          pairs.push({ target: fileRecords[i], source, score: scored.score, evidence: scored.evidence });
        }
        const minPairs = Math.max(4, Math.ceil(n * 0.2));
        if (pairs.length < minPairs) continue;
        const avg = pairs.reduce((s, p) => s + p.score, 0) / pairs.length;
        transforms.push({ kind, offset, avg, pairs });
      }
    }

    const best = transforms.sort((a, b) => b.avg - a.avg)[0];
    if (!best || best.avg < t.sequenceAvg || best.avg - currentAvg < t.sequenceGap) continue;

    const label = best.kind === "reverse" ? "عكس ترتيب داخل الملف" : `انزياح ترتيب بمقدار ${best.offset}`;
    for (const pair of best.pairs) {
      if (pair.target.translation === pair.source.translation) continue;
      const currentScore = baseScore(pair.target.entry, pair.target.translation).score;
      if (pair.score < t.sequenceAvg || pair.score - currentScore < Math.max(5, t.sequenceGap - 3)) continue;
      suggestions.push({
        key: pair.target.key,
        sourceKey: pair.source.key,
        original: pair.target.entry.original,
        current: pair.target.translation,
        suggested: pair.source.translation,
        confidence: Math.max(1, Math.min(95, Math.round(pair.score + 35))),
        method: "sequence",
        problem: METHOD_PROBLEM.sequence,
        reason: `${METHOD_REASON.sequence} النمط المكتشف: ${label}.`,
        evidence: [label, ...pair.evidence.slice(0, 4)],
      });
    }
    processedFiles++;
    onProgress?.(processedFiles, totalFiles, suggestions.length);
    if (processedFiles % 8 === 0) await yieldToBrowser();
  }
  return suggestions;
}

async function nearestSuggestions(
  records: EntryRecord[],
  options: ReorderScanOptions,
  signal?: AbortSignal,
  onProgress?: (processed: number, total: number, found: number) => void,
): Promise<ReorderSuggestion[]> {
  const scope = options.scope ?? "file";
  const t = thresholds(options.aggressiveness);
  const candidates = records.filter((r) => r.translation.trim()) as CandidateRecord[];
  // Pre-index candidates by msbt file so the inner pool lookup is O(1) per
  // target instead of an O(n) `candidates.filter(...)` call. With large
  // projects (~29k entries) the previous filter inside the target loop was
  // the dominant cost and caused the UI to freeze for many minutes.
  const candidatesByFile = new Map<string, CandidateRecord[]>();
  for (const c of candidates) {
    const list = candidatesByFile.get(c.entry.msbtFile);
    if (list) list.push(c);
    else candidatesByFile.set(c.entry.msbtFile, [c]);
  }
  const claimedSources = new Set<string>();
  const scored: Array<{ target: EntryRecord; best: ScoredCandidate; currentScore: number }> = [];

  const total = records.length;
  let processed = 0;
  for (const target of records) {
    if (signal?.aborted) break;
    processed++;
    if (!target.translation.trim()) {
      if (processed % 250 === 0) {
        onProgress?.(processed, total, scored.length);
        await yieldToBrowser();
      }
      continue;
    }
    const pool = scope === "project"
      ? candidates
      : (candidatesByFile.get(target.entry.msbtFile) ?? []);
    let best: ScoredCandidate | null = null;
    for (const candidate of pool) {
      if (candidate.key === target.key) continue;
      const s = scoreCandidate(target, candidate, scope);
      if (!best || s.score > best.score) best = s;
    }
    if (best) {
      const currentScore = scoreCandidate(target, target, scope).score;
      if (best.score >= t.nearest && best.score - currentScore >= t.gap) scored.push({ target, best, currentScore });
    }
    if (processed % 250 === 0) {
      onProgress?.(processed, total, scored.length);
      await yieldToBrowser();
    }
  }
  onProgress?.(processed, total, scored.length);

  scored.sort((a, b) => (b.best.score - b.currentScore) - (a.best.score - a.currentScore));
  const out: ReorderSuggestion[] = [];
  for (const item of scored) {
    if (claimedSources.has(item.best.candidate.key)) continue;
    claimedSources.add(item.best.candidate.key);
    out.push({
      key: item.target.key,
      sourceKey: item.best.candidate.key,
      original: item.target.entry.original,
      current: item.target.translation,
      suggested: item.best.candidate.translation,
      confidence: Math.max(1, Math.min(95, Math.round(item.best.score))),
      method: "nearest",
      problem: METHOD_PROBLEM.nearest,
      reason: METHOD_REASON.nearest,
      evidence: item.best.evidence.slice(0, 5),
    });
  }
  return out;
}

export async function scanReorderedTranslations(
  entries: ExtractedEntry[],
  translations: Record<string, string>,
  options: ReorderScanOptions = {},
  callbacks: ReorderScanCallbacks = {},
): Promise<ReorderScanReport> {
  const { signal, onProgress, onPartial } = callbacks;
  const records = recordsFrom(entries, translations);
  const out = new Map<string, ReorderSuggestion>();
  const t = thresholds(options.aggressiveness);
  const total = records.length;
  const translatedTotal = records.filter((r) => r.translation.trim()).length;

  const buildPartial = (): ReorderSuggestion[] =>
    [...out.values()]
      .filter((s) => s.suggested.trim() && s.current !== s.suggested)
      .sort((a, b) => b.confidence - a.confidence);
  const emitPartial = () => onPartial?.(buildPartial());

  onProgress?.({ phase: "preparing", processed: 0, total, found: 0 });
  await yieldToBrowser();

  if (!signal?.aborted) {
    onProgress?.({ phase: "phrase", processed: 0, total, found: out.size });
    phraseSuggestions(records, out, t.phrase);
    onProgress?.({ phase: "phrase", processed: total, total, found: out.size });
    emitPartial();
    await yieldToBrowser();
  }

  if (!signal?.aborted) {
    onProgress?.({ phase: "duplicate", processed: 0, total, found: out.size });
    duplicateSuggestions(records, out);
    onProgress?.({ phase: "duplicate", processed: total, total, found: out.size });
    emitPartial();
    await yieldToBrowser();
  }

  if (!signal?.aborted) {
    const seqList = await findBestSequence(records, options.aggressiveness, signal, (pf, tf, found) => {
      onProgress?.({ phase: "sequence", processed: pf, total: tf, found: out.size + found });
    });
    for (const suggestion of seqList) addSuggestion(out, suggestion);
    emitPartial();
    await yieldToBrowser();
  }

  if (!signal?.aborted) {
    const nearestList = await nearestSuggestions(records, options, signal, (proc, tot, found) => {
      onProgress?.({ phase: "nearest", processed: proc, total: tot, found: out.size + found });
      // Stream partial each batch so users see results appear during the
      // long nearest phase instead of waiting until the end.
      emitPartial();
    });
    for (const suggestion of nearestList) addSuggestion(out, suggestion);
  }

  const suggestions = buildPartial();
  const byMethod: Record<ReorderMethod, number> = { phrase: 0, duplicate: 0, sequence: 0, nearest: 0 };
  for (const suggestion of suggestions) byMethod[suggestion.method]++;

  const aborted = !!signal?.aborted;
  onProgress?.({ phase: aborted ? "aborted" : "done", processed: total, total, found: suggestions.length });
  emitPartial();

  return {
    suggestions,
    scanned: entries.length,
    translated: translatedTotal,
    byMethod,
    aborted,
  };
}
