import { useCallback, useState } from "react";
import { removeArabicPresentationForms } from "@/lib/arabic-processing";
import { parseEnglishOnlyTxt } from "@/lib/english-only-txt";
import type { EditorState } from "@/components/editor/types";
import { ExtractedEntry, hasArabicChars, unReverseBidi } from "@/components/editor/types";
import type { ImportConflict } from "@/components/editor/ImportConflictDialog";

/**
 * Result of splitting an incoming `{key: translation}` map against the
 * editor's current translations. Conflicts are shown in the import-conflict
 * dialog; auto-apply entries are added silently when the user confirms (or
 * immediately when there are no conflicts).
 */
export interface ImportConflictSplit {
  conflicts: ImportConflict[];
  autoApply: Record<string, string>;
}

/**
 * Split an incoming translations map into "conflicts" (any key that already
 * has a non-empty existing translation, regardless of whether the new value
 * differs) and auto-applies (no existing translation at all, or only
 * whitespace).
 *
 * Note: We surface ALL overlaps — including byte-identical ones — so the user
 * can review every translation that's about to be replaced. Identical entries
 * are tagged with `identical: true` so the dialog can render them subtly.
 *
 * Pure function so it can be unit-tested without React state.
 */
export function splitImportByConflict(
  incoming: Record<string, string>,
  currentTranslations: Record<string, string>,
  entries: ExtractedEntry[],
): ImportConflictSplit {
  const entryMap = new Map(entries.map(e => [`${e.msbtFile}:${e.index}`, e]));
  const conflicts: ImportConflict[] = [];
  const autoApply: Record<string, string> = {};
  for (const [key, value] of Object.entries(incoming)) {
    const existing = currentTranslations[key];
    if (existing && existing.trim()) {
      const entry = entryMap.get(key);
      conflicts.push({
        key,
        file: entry?.msbtFile ?? key,
        label: entry?.label ?? "",
        original: entry?.original ?? "",
        oldTranslation: existing,
        newTranslation: value,
        identical: existing === value,
      });
    } else {
      autoApply[key] = value;
    }
  }
  return { conflicts, autoApply };
}

interface PendingImport {
  conflicts: ImportConflict[];
  autoApply: Record<string, string>;
  sourceLabel: string;
  /** When true, schedule the post-import bidi auto-correction (JSON flow). */
  runBidiPostFix: boolean;
  /** Truncation/skipped-line metadata for JSON imports, used in the toast. */
  meta?: { wasTruncated: boolean; skippedCount: number };
  /** Total imported count before filtering — used for `appliedCount/totalImported` toasts. */
  totalImported: number;
  /** Empty-block count from English-TXT imports, used in the toast. */
  emptyCount?: number;
  /** Source flow, controls toast wording. */
  flow: "json" | "english-txt" | "csv";
}

/** Parse a single JSON object chunk, repairing common issues */
function repairSingleChunk(raw: string): Record<string, string> | null {
  let text = raw.trim();
  if (!text) return null;
  // إضافة الأقواس الناقصة
  if (!text.startsWith('{')) text = '{' + text;
  if (!text.endsWith('}')) {
    // ابحث عن آخر سطر مكتمل
    const goodLines = text.split('\n');
    // أزل الأسطر غير المكتملة من النهاية
    while (goodLines.length > 1) {
      const last = goodLines[goodLines.length - 1].trim();
      if (last === '' || last === '{' || last.match(/^"[^"]*"\s*:\s*".*",?\s*$/)) break;
      goodLines.pop();
    }
    text = goodLines.join('\n');
    if (!text.endsWith('}')) text += '\n}';
  }
  // إصلاح الفواصل الزائدة
  text = text.replace(/,\s*}/g, '}');
  // إصلاح الفواصل المفقودة بين المدخلات: "value"\n"key" → "value",\n"key"
  text = text.replace(/"\s*\n(\s*")/g, '",\n$1');
  try {
    return JSON.parse(text) as Record<string, string>;
  } catch {
    return null;
  }
}

/** إصلاح تلقائي لملفات JSON التالفة أو المقطوعة — يدعم كائنات متعددة متتالية */
function repairJson(raw: string): { parsed: Record<string, string>; wasTruncated: boolean; skippedCount: number } {
  let text = raw.trim();
  // إزالة أغلفة markdown
  text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  // محاولة أولى مباشرة
  try {
    const result = JSON.parse(text);
    return { parsed: result, wasTruncated: false, skippedCount: 0 };
  } catch {}

  // تقسيم عند }{ وتحليل كل جزء على حدة
  const chunks = text.split(/\}\s*\{/);
  if (chunks.length > 1) {
    const merged: Record<string, string> = {};
    let failedChunks = 0;
    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i].trim();
      if (i > 0) chunk = '{' + chunk;
      if (i < chunks.length - 1) chunk = chunk + '}';
      const parsed = repairSingleChunk(chunk);
      if (parsed) {
        Object.assign(merged, parsed);
      } else {
        failedChunks++;
      }
    }
    if (Object.keys(merged).length > 0) {
      return { parsed: merged, wasTruncated: failedChunks > 0, skippedCount: failedChunks };
    }
  }

  // محاولة إصلاح ككائن واحد
  const single = repairSingleChunk(text);
  if (single) {
    return { parsed: single, wasTruncated: false, skippedCount: 0 };
  }

  // آخر محاولة: استخراج المدخلات يدوياً بالـ regex
  const entryRegex = /"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  const manual: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = entryRegex.exec(text)) !== null) {
    manual[m[1]] = m[2];
  }
  if (Object.keys(manual).length > 0) {
    return { parsed: manual, wasTruncated: true, skippedCount: 0 };
  }

  throw new Error('تعذر إصلاح ملف JSON');
}

interface UseEditorFileIOProps {
  state: EditorState | null;
  setState: React.Dispatch<React.SetStateAction<EditorState | null>>;
  setLastSaved: React.Dispatch<React.SetStateAction<string>>;
  filteredEntries: ExtractedEntry[];
  filterLabel: string;
}

function normalizeArabicPresentationForms(text: string): string {
  if (!text) return text;
  return removeArabicPresentationForms(text);
}

function escapeCSV(text: string): string {
  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

export function useEditorFileIO({ state, setState, setLastSaved, filteredEntries, filterLabel }: UseEditorFileIOProps) {

  const isFilterActive = filterLabel !== "";

  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  /**
   * Apply an `{key: translation}` map to state and emit the per-flow toast.
   * Centralised so the three import flows (JSON / English-TXT / CSV) and the
   * conflict-dialog confirm path all funnel through one path.
   */
  const applyImportedTranslations = useCallback((
    toApply: Record<string, string>,
    pending: PendingImport,
  ) => {
    const appliedCount = Object.keys(toApply).length;
    if (appliedCount === 0) {
      setLastSaved("ℹ️ لم يُطبَّق أي ترجمة (تم رفض كل التعارضات)");
      setTimeout(() => setLastSaved(""), 3000);
      return;
    }

    setState(prev => prev ? { ...prev, translations: { ...prev.translations, ...toApply } } : null);

    let msg: string;
    if (pending.flow === "json") {
      msg = isFilterActive
        ? `✅ تم استيراد ${appliedCount} من ${pending.totalImported} ترجمة (${filterLabel})`
        : `✅ تم استيراد ${appliedCount} ترجمة وتنظيفها`;
      if (pending.sourceLabel) msg += ` — ${pending.sourceLabel}`;
      if (pending.meta?.wasTruncated) {
        msg += ` ⚠️ الملف كان مقطوعاً — تم تخطي ${pending.meta.skippedCount} سطر غير مكتمل`;
      }
    } else if (pending.flow === "english-txt") {
      msg = isFilterActive
        ? `✅ تم استيراد ${appliedCount} من ${pending.totalImported} ترجمة من TXT (${filterLabel})`
        : `✅ تم استيراد ${appliedCount} ترجمة من TXT — ${pending.sourceLabel}`;
      if (pending.emptyCount && pending.emptyCount > 0) msg += ` • تجاوز ${pending.emptyCount} مدخل بدون ترجمة`;
    } else {
      msg = isFilterActive
        ? `✅ تم استيراد ${appliedCount} ترجمة من CSV (${filterLabel})`
        : `✅ تم استيراد ${appliedCount} ترجمة من CSV`;
    }
    setLastSaved(msg);

    if (pending.runBidiPostFix) {
      setTimeout(() => {
        setState(prevState => {
          if (!prevState) return null;
          const newTranslations = { ...prevState.translations };
          const newProtected = new Set(prevState.protectedEntries || []);
          let count = 0;
          for (const entry of prevState.entries) {
            const key = `${entry.msbtFile}:${entry.index}`;
            if (hasArabicChars(entry.original)) {
              if (newProtected.has(key)) continue;
              const existing = newTranslations[key]?.trim();
              const isAutoDetected = !existing || existing === entry.original || existing === entry.original.trim();
              if (isAutoDetected) {
                const corrected = unReverseBidi(entry.original);
                if (corrected !== entry.original) {
                  newTranslations[key] = corrected;
                  newProtected.add(key);
                  count++;
                }
              }
            }
          }
          if (count > 0) setLastSaved(prev => prev + ` + تصحيح ${count} نص معكوس`);
          return { ...prevState, translations: newTranslations, protectedEntries: newProtected };
        });
      }, 0);
    } else {
      setTimeout(() => setLastSaved(""), 4000);
    }
  }, [setState, setLastSaved, isFilterActive, filterLabel]);

  /**
   * Either apply the staged import immediately (no conflicts) or open the
   * comparison dialog by stashing it in `pendingImport`.
   */
  const stageImportOrApply = useCallback((staged: Omit<PendingImport, "conflicts" | "autoApply"> & { cleanedImported: Record<string, string> }) => {
    const { cleanedImported, ...rest } = staged;
    const split = splitImportByConflict(
      cleanedImported,
      state?.translations ?? {},
      state?.entries ?? [],
    );
    const pending: PendingImport = { ...rest, conflicts: split.conflicts, autoApply: split.autoApply };
    if (split.conflicts.length === 0) {
      applyImportedTranslations(split.autoApply, pending);
    } else {
      setPendingImport(pending);
    }
  }, [state, applyImportedTranslations]);

  /** Confirm the staged import with the user-approved subset of conflicts. */
  const confirmPendingImport = useCallback((approvedKeys: Set<string>) => {
    if (!pendingImport) return;
    const toApply: Record<string, string> = { ...pendingImport.autoApply };
    for (const c of pendingImport.conflicts) {
      if (approvedKeys.has(c.key)) toApply[c.key] = c.newTranslation;
    }
    applyImportedTranslations(toApply, pendingImport);
    setPendingImport(null);
  }, [pendingImport, applyImportedTranslations]);

  /** Drop the staged import without touching state. */
  const cancelPendingImport = useCallback(() => {
    if (!pendingImport) return;
    setPendingImport(null);
    setLastSaved("ℹ️ أُلغي الاستيراد");
    setTimeout(() => setLastSaved(""), 3000);
  }, [pendingImport, setLastSaved]);

  const handleExportTranslations = () => {
    if (!state) return;
    const cleanTranslations: Record<string, string> = {};

    if (isFilterActive) {
      const allowedKeys = new Set(filteredEntries.map(e => `${e.msbtFile}:${e.index}`));
      for (const [key, value] of Object.entries(state.translations)) {
        if (allowedKeys.has(key)) {
          cleanTranslations[key] = normalizeArabicPresentationForms(value);
        }
      }
    } else {
      for (const [key, value] of Object.entries(state.translations)) {
        cleanTranslations[key] = normalizeArabicPresentationForms(value);
      }
    }

    const data = JSON.stringify(cleanTranslations, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = isFilterActive ? `_${filterLabel}` : '';
    a.download = `translations${suffix}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const countMsg = Object.keys(cleanTranslations).length;
    setLastSaved(isFilterActive
      ? `✅ تم تصدير ${countMsg} ترجمة (${filterLabel})`
      : `✅ تم تصدير ${countMsg} ترجمة`
    );
    setTimeout(() => setLastSaved(""), 3000);
  };

  /** Build the list of untranslated entries grouped by file */
  const getUntranslatedGrouped = () => {
    if (!state) return { groupedByFile: {} as Record<string, { index: number; original: string; label: string }[]>, totalCount: 0 };
    const entriesToExport = isFilterActive ? filteredEntries : state.entries;
    const groupedByFile: Record<string, { index: number; original: string; label: string }[]> = {};
    for (const entry of entriesToExport) {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = state.translations[key]?.trim();
      if (!translation || translation === entry.original || translation === entry.original.trim()) {
        if (!groupedByFile[entry.msbtFile]) groupedByFile[entry.msbtFile] = [];
        groupedByFile[entry.msbtFile].push({ index: entry.index, original: entry.original, label: entry.label || '' });
      }
    }
    const totalCount = Object.values(groupedByFile).reduce((sum, arr) => sum + arr.length, 0);
    return { groupedByFile, totalCount };
  };

  /** Build text content for a flat list of entries */
  const buildEnglishTxt = (
    flatEntries: { file: string; index: number; original: string; label: string }[],
    partLabel: string,
    totalParts: number,
    partNum: number,
  ): string => {
    const lines: string[] = [];
    lines.push('='.repeat(60));
    lines.push(`  English Texts for Translation — ${new Date().toISOString().slice(0, 10)}`);
    lines.push(`  Total: ${flatEntries.length} texts`);
    if (totalParts > 1) lines.push(`  Part: ${partNum} / ${totalParts}`);
    if (isFilterActive) lines.push(`  Filter: ${filterLabel}`);
    lines.push('='.repeat(60));
    lines.push('');

    let currentFile = '';
    let rowNum = 1;
    for (const entry of flatEntries) {
      if (entry.file !== currentFile) {
        currentFile = entry.file;
        lines.push('─'.repeat(60));
        lines.push(`📁 ${entry.file}`);
        lines.push('─'.repeat(60));
        lines.push('');
      }
      lines.push(`[${rowNum}] (${entry.file}:${entry.index})`);
      if (entry.label) lines.push(`Label: ${entry.label}`);
      lines.push('');
      lines.push(entry.original);
      lines.push('');
      lines.push('▶ Translation:');
      lines.push('');
      lines.push('═'.repeat(60));
      lines.push('');
      rowNum++;
    }
    return lines.join('\n');
  };

  /** Download a single text blob */
  const downloadTxt = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportEnglishOnly = (chunkSize?: number) => {
    if (!state) return;
    const { groupedByFile, totalCount } = getUntranslatedGrouped();
    if (totalCount === 0) {
      setLastSaved("ℹ️ لا توجد نصوص غير مترجمة للتصدير");
      setTimeout(() => setLastSaved(""), 3000);
      return;
    }

    // Flatten all entries in file order
    const sortedFiles = Object.keys(groupedByFile).sort();
    const flatEntries: { file: string; index: number; original: string; label: string }[] = [];
    for (const file of sortedFiles) {
      for (const entry of groupedByFile[file].sort((a, b) => a.index - b.index)) {
        flatEntries.push({ file, ...entry });
      }
    }

    const suffix = isFilterActive ? `_${filterLabel}` : '';
    const date = new Date().toISOString().slice(0, 10);

    if (!chunkSize || chunkSize >= totalCount) {
      // تصدير كامل
      const content = buildEnglishTxt(flatEntries, '', 1, 1);
      downloadTxt(content, `english-only${suffix}_${date}.txt`);
      setLastSaved(`✅ تم تصدير ${totalCount} نص إنجليزي (${sortedFiles.length} ملف)`);
    } else {
      // تقسيم إلى أجزاء
      const totalParts = Math.ceil(totalCount / chunkSize);
      for (let i = 0; i < totalParts; i++) {
        const chunk = flatEntries.slice(i * chunkSize, (i + 1) * chunkSize);
        const content = buildEnglishTxt(chunk, '', totalParts, i + 1);
        downloadTxt(content, `english-only${suffix}_part${i + 1}_of_${totalParts}_${date}.txt`);
      }
      setLastSaved(`✅ تم تصدير ${totalCount} نص في ${totalParts} ملفات (${chunkSize} لكل ملف)`);
    }
    setTimeout(() => setLastSaved(""), 4000);
  };

  /** Get untranslated count for UI display */
  const getUntranslatedCount = () => getUntranslatedGrouped().totalCount;

  /** Core logic: process raw JSON text into translations */
  const processJsonImport = useCallback(async (rawText: string, sourceName?: string) => {
    const repaired = repairJson(rawText);
    const imported = repaired.parsed;
    const cleanedImported: Record<string, string> = {};

    if (isFilterActive && filteredEntries.length < (state?.entries.length || 0)) {
      const allowedKeys = new Set(filteredEntries.map(e => `${e.msbtFile}:${e.index}`));
      for (const [key, value] of Object.entries(imported)) {
        if (allowedKeys.has(key)) {
          cleanedImported[key] = normalizeArabicPresentationForms(value);
        }
      }
    } else {
      for (const [key, value] of Object.entries(imported)) {
        cleanedImported[key] = normalizeArabicPresentationForms(value);
      }
    }

    // Backward compat: convert legacy FFF9-FFFC markers in imported translations to PUA markers
    if (state?.entries) {
      const entryMap = new Map(state.entries.map(e => [`${e.msbtFile}:${e.index}`, e]));
      for (const [key, value] of Object.entries(cleanedImported)) {
        if (/[\uFFF9-\uFFFC]/.test(value)) {
          const entry = entryMap.get(key);
          if (entry) {
            const puaMarkers = entry.original.match(/[\uE000-\uE0FF]/g) || [];
            if (puaMarkers.length > 0) {
              let idx = 0;
              cleanedImported[key] = value.replace(/[\uFFF9-\uFFFC]/g, () => {
                if (idx < puaMarkers.length) return puaMarkers[idx++];
                return '';
              });
            }
          }
        }
      }
    }

    stageImportOrApply({
      cleanedImported,
      sourceLabel: sourceName ?? "",
      runBidiPostFix: true,
      meta: { wasTruncated: repaired.wasTruncated, skippedCount: repaired.skippedCount },
      totalImported: Object.keys(imported).length,
      flow: "json",
    });
  }, [state, isFilterActive, filteredEntries, stageImportOrApply]);

  /** Handle drop/paste of JSON file or text */
  const handleDropImport = useCallback(async (dataTransfer: DataTransfer) => {
    // Try files first
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      const file = dataTransfer.files[0];
      try {
        const rawText = (await file.text()).trim();
        await processJsonImport(rawText, file.name);
      } catch (err) {
        console.error('Drop import error:', err);
        alert(`ملف JSON غير صالح\n\nالخطأ: ${err instanceof Error ? err.message : err}`);
      }
      return;
    }
    // Try text
    const text = dataTransfer.getData('text/plain')?.trim();
    if (text) {
      try {
        await processJsonImport(text, 'لصق من الحافظة');
      } catch (err) {
        console.error('Paste import error:', err);
        alert(`نص JSON غير صالح\n\nالخطأ: ${err instanceof Error ? err.message : err}`);
      }
    }
  }, [processJsonImport]);

  const handleImportTranslations = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,text/plain,.txt,*/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const rawText = (await file.text()).trim();
        await processJsonImport(rawText, file.name);
      } catch (err) {
        console.error('JSON import error:', err);
        alert(`ملف JSON غير صالح\n\nالخطأ: ${err instanceof Error ? err.message : err}`);
      }
    };
    input.click();
  };

  /**
   * Import the structured English-only TXT format produced by
   * `handleExportEnglishOnly`. Parses `[N] (file.msbt:idx)` headers and
   * the user's translation that follows the `▶ Translation:` marker.
   */
  const handleImportEnglishTxt = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,text/plain,*/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const rawText = await file.text();
        const { translations: parsed, emptyCount } = parseEnglishOnlyTxt(rawText);
        const totalParsed = Object.keys(parsed).length;
        if (totalParsed === 0) {
          alert(
            'لم يُعثر على أي ترجمات في الملف.\n\n' +
              'تأكّد أنه ملف "تصدير الإنجليزية" الذي ولَّده المحرر، وأنك أضفت ترجمتك بعد سطر "▶ Translation:".'
          );
          return;
        }

        const cleanedImported: Record<string, string> = {};
        if (isFilterActive && filteredEntries.length < (state?.entries.length || 0)) {
          const allowedKeys = new Set(filteredEntries.map(en => `${en.msbtFile}:${en.index}`));
          for (const [key, value] of Object.entries(parsed)) {
            if (allowedKeys.has(key)) {
              cleanedImported[key] = normalizeArabicPresentationForms(value);
            }
          }
        } else {
          for (const [key, value] of Object.entries(parsed)) {
            cleanedImported[key] = normalizeArabicPresentationForms(value);
          }
        }

        const appliedCount = Object.keys(cleanedImported).length;
        if (appliedCount === 0) {
          alert('الترجمات في الملف لا تطابق أي مدخل ضمن الفلتر الحالي.');
          return;
        }

        stageImportOrApply({
          cleanedImported,
          sourceLabel: file.name,
          runBidiPostFix: false,
          totalImported: totalParsed,
          emptyCount,
          flow: "english-txt",
        });
      } catch (err) {
        console.error('English TXT import error:', err);
        alert(`تعذّر قراءة الملف\n\nالخطأ: ${err instanceof Error ? err.message : err}`);
      }
    };
    input.click();
  };

  const handleExportCSV = () => {
    if (!state) return;
    const entriesToExport = (isFilterActive && filteredEntries.length < state.entries.length) ? filteredEntries : state.entries;
    const header = 'file,index,label,original,translation,max_bytes';
    const rows = entriesToExport.map(entry => {
      const key = `${entry.msbtFile}:${entry.index}`;
      const translation = normalizeArabicPresentationForms(state.translations[key] || '');
      return [
        escapeCSV(entry.msbtFile),
        entry.index.toString(),
        escapeCSV(entry.label),
        escapeCSV(entry.original),
        escapeCSV(translation),
        entry.maxBytes.toString(),
      ].join(',');
    });
    const csv = '\uFEFF' + header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = isFilterActive ? `_${filterLabel}` : '';
    a.download = `translations${suffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    const msg = isFilterActive
      ? `✅ تم تصدير ${entriesToExport.length} نص كملف CSV (${filterLabel})`
      : `✅ تم تصدير ${entriesToExport.length} نص كملف CSV`;
    setLastSaved(msg);
    setTimeout(() => setLastSaved(""), 3000);
  };

  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { alert('ملف CSV فارغ أو غير صالح'); return; }

        const header = lines[0].toLowerCase();
        const hasHeader = header.includes('file') || header.includes('translation') || header.includes('original');
        const dataLines = hasHeader ? lines.slice(1) : lines;

        const allowedKeys = isFilterActive && filteredEntries.length < (state?.entries.length || 0)
          ? new Set(filteredEntries.map(e => `${e.msbtFile}:${e.index}`))
          : null;

        let imported = 0;
        const updates: Record<string, string> = {};

        for (const line of dataLines) {
          const cols = parseCSVLine(line);
          if (cols.length < 5) continue;
          const filePath = cols[0].trim();
          const index = cols[1].trim();
          const translation = cols[4].trim();
          if (!filePath || !index || !translation) continue;
          const key = `${filePath}:${index}`;
          if (allowedKeys && !allowedKeys.has(key)) continue;
          updates[key] = normalizeArabicPresentationForms(translation);
          imported++;
        }

        if (imported === 0) { alert('لم يتم العثور على ترجمات في الملف'); return; }
        stageImportOrApply({
          cleanedImported: updates,
          sourceLabel: file.name,
          runBidiPostFix: false,
          totalImported: imported,
          flow: "csv",
        });
      } catch { alert('خطأ في قراءة ملف CSV'); }
    };
    input.click();
  };

  return {
    handleExportTranslations,
    handleExportEnglishOnly,
    handleImportTranslations,
    handleImportEnglishTxt,
    handleDropImport,
    processJsonImport,
    handleExportCSV,
    handleImportCSV,
    normalizeArabicPresentationForms,
    isFilterActive,
    filterLabel,
    getUntranslatedCount,
    // Import-conflict dialog wiring
    pendingImport,
    confirmPendingImport,
    cancelPendingImport,
  };
}
