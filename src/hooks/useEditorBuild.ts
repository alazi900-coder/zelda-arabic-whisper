import { useState } from "react";
import { idbGet } from "@/lib/idb-storage";
import { processArabicText, hasArabicChars as hasArabicCharsProcessing, hasArabicPresentationForms, reverseBidi, removeArabicPresentationForms } from "@/lib/arabic-processing";
import { EditorState } from "@/components/editor/types";
import { restoreTagsAndLineBreaks, normalizeLineBreakRepresentations, scanTranslationsForRestore } from "@/lib/tag-restore";
import { BuildPreview } from "@/components/editor/BuildConfirmDialog";
import type { BuildDiagnostics } from "@/components/editor/BuildDiagnosticsPanel";
import { localBuild, LocalBuildError } from "@/lib/local-build";

export interface BuildStats {
  modifiedCount: number;
  expandedCount: number;
  fileSize: number;
  compressedSize?: number;
  avgBytePercent: number;
  maxBytePercent: number;
  longest: { key: string; bytes: number } | null;
  shortest: { key: string; bytes: number } | null;
  categories: Record<string, { total: number; modified: number }>;
}

interface UseEditorBuildProps {
  state: EditorState | null;
  setState: React.Dispatch<React.SetStateAction<EditorState | null>>;
  setLastSaved: (msg: string) => void;
  arabicNumerals: boolean;
  mirrorPunctuation: boolean;
}

// فكّ روابط لام-ألف من حرف واحد (FEF5..FEFC) إلى حرفين منفصلين قبل
// تطبيق removeArabicPresentationForms (الذي يفترض تعيين 1→1).
// مطابقة معكوسة لـ LAM_ALEF_LIGATURES في arabic-processing.ts.
const LAM = 0x0644;
const LAM_ALEF_LIGATURE_REVERSE: Record<number, number> = {
  0xFEF5: 0x0622, 0xFEF6: 0x0622,
  0xFEF7: 0x0623, 0xFEF8: 0x0623,
  0xFEF9: 0x0625, 0xFEFA: 0x0625,
  0xFEFB: 0x0627, 0xFEFC: 0x0627,
};
function expandLamAlefLigatures(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const alef = LAM_ALEF_LIGATURE_REVERSE[code];
    if (alef !== undefined) {
      out += String.fromCharCode(LAM) + String.fromCharCode(alef);
    } else {
      out += ch;
    }
  }
  return out;
}

function getHeaderHex(buf: ArrayBuffer, n = 8): string {
  return Array.from(new Uint8Array(buf).slice(0, n)).map(b => b.toString(16).padStart(2, "0")).join(" ");
}

function getHeaderAscii(buf: ArrayBuffer, n = 8): string {
  return Array.from(new Uint8Array(buf).slice(0, n)).map(b => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : ".").join("");
}

function createLocalBuildDiagnostics(langBuf: ArrayBuffer, langFileName: string): BuildDiagnostics {
  const b = new Uint8Array(langBuf);
  return {
    langFileName,
    langSize: b.byteLength,
    langHeaderHex: getHeaderHex(langBuf),
    langHeaderAscii: getHeaderAscii(langBuf),
    isSarc: b.length >= 4 && b[0] === 0x53 && b[1] === 0x41 && b[2] === 0x52 && b[3] === 0x43,
    isZstd: b.length >= 4 && b[0] === 0x28 && b[1] === 0xB5 && b[2] === 0x2F && b[3] === 0xFD,
    dictFiles: [],
    attempts: [],
  };
}

export function useEditorBuild({ state, setState, setLastSaved, arabicNumerals, mirrorPunctuation }: UseEditorBuildProps) {
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState("");
  const [applyingArabic, setApplyingArabic] = useState(false);
  const [buildStats, setBuildStats] = useState<BuildStats | null>(null);
  const [buildPreview, setBuildPreview] = useState<BuildPreview | null>(null);
  const [showBuildConfirm, setShowBuildConfirm] = useState(false);
  const [buildError, setBuildError] = useState<{ message: string; diagnostics?: BuildDiagnostics } | null>(null);

  const handleApplyArabicProcessing = () => {
    if (!state) return;
    setApplyingArabic(true);
    const newTranslations = { ...state.translations };
    let processedCount = 0, skippedCount = 0;
    for (const [key, value] of Object.entries(newTranslations)) {
      if (!value?.trim()) continue;
      if (hasArabicPresentationForms(value)) { skippedCount++; continue; }
      if (!hasArabicCharsProcessing(value)) continue;
      newTranslations[key] = processArabicText(value, { arabicNumerals, mirrorPunct: mirrorPunctuation });
      processedCount++;
    }
    setState(prev => prev ? { ...prev, translations: newTranslations } : null);
    setApplyingArabic(false);
    setLastSaved(`✅ تم تطبيق المعالجة العربية على ${processedCount} نص` + (skippedCount > 0 ? ` (تم تخطي ${skippedCount} نص معالج مسبقاً)` : ''));
    setTimeout(() => setLastSaved(""), 5000);
  };

  // عكس "تطبيق المعالجة العربية":
  // 1) عكس BiDi (دالة involutive — تطبيقها مرّتين يُرجع الأصل).
  // 2) فكّ روابط لام-ألف إلى حرفين منفصلين.
  // 3) إرجاع باقي أشكال العرض إلى الحروف العربية الأساسية.
  // يلمس فقط النصوص التي تحتوي أشكال العرض (أي مرّت بـ processArabicText فعلاً).
  const handleUndoArabicProcessing = () => {
    if (!state) return;
    setApplyingArabic(true);
    const newTranslations = { ...state.translations };
    let restoredCount = 0, skippedCount = 0;
    for (const [key, value] of Object.entries(newTranslations)) {
      if (!value?.trim()) continue;
      if (!hasArabicPresentationForms(value)) { skippedCount++; continue; }
      let restored = reverseBidi(value);
      restored = expandLamAlefLigatures(restored);
      restored = removeArabicPresentationForms(restored);
      newTranslations[key] = restored;
      restoredCount++;
    }
    setState(prev => prev ? { ...prev, translations: newTranslations } : null);
    setApplyingArabic(false);
    setLastSaved(`✅ تم التراجع عن المعالجة العربية لـ ${restoredCount} نص` + (skippedCount > 0 ? ` (تم تخطي ${skippedCount} نص غير معالج)` : ''));
    setTimeout(() => setLastSaved(""), 5000);
  };

  const handlePreBuild = () => {
    if (!state) return;
    
    const nonEmptyTranslations: Record<string, string> = {};
    for (const [k, v] of Object.entries(state.translations)) {
      if (v.trim()) nonEmptyTranslations[k] = v;
    }

    const protectedCount = Array.from(state.protectedEntries || []).filter(k => nonEmptyTranslations[k]).length;
    const normalCount = Object.keys(nonEmptyTranslations).length - protectedCount;

    // Category breakdown
    const categories: Record<string, number> = {};
    for (const key of Object.keys(nonEmptyTranslations)) {
      const parts = key.split(':')[0].split('/');
      const cat = parts.length > 1 ? parts[0] : 'Other';
      categories[cat] = (categories[cat] || 0) + 1;
    }

    const sampleKeys = Object.keys(nonEmptyTranslations).slice(0, 10);

    // حارس البناء: نفس فاحص أداة «الرموز وفواصل الأسطر» حتى لا تفوته الرموز المزاحة أو فواصل الأسطر.
    const restoreReport = scanTranslationsForRestore(
      state.entries.map(e => ({ msbtFile: e.msbtFile, index: e.index, label: e.label, original: e.original })),
      nonEmptyTranslations,
      10,
    );
    const tagIssueCount = restoreReport.issueTotals.affectedTranslations;
    const tagIssueSamples = [...restoreReport.autoExamples, ...restoreReport.reviewExamples].slice(0, 10).map(issue => {
      const reasons: string[] = [];
      if (issue.reasons.missingTags) reasons.push(`مفقودة ${issue.reasons.missingTags}`);
      if (issue.reasons.extraTags) reasons.push(`زائدة ${issue.reasons.extraTags}`);
      if (issue.reasons.changedTagPositions) reasons.push(`فاسدة/ترتيب ${issue.reasons.changedTagPositions}`);
      if (issue.reasons.misplacedTags) reasons.push(`مكان خاطئ ${issue.reasons.misplacedTags}`);
      if (issue.reasons.missingLineBreaksAuto || issue.reasons.missingLineBreaksPartial) reasons.push(`فواصل أسطر ${(issue.reasons.missingLineBreaksAuto || 0) + (issue.reasons.missingLineBreaksPartial || 0)}`);
      return { key: issue.key, reason: reasons.join("، ") || "مشكلة رموز/فواصل" };
    });

    console.log('[BUILD-PREVIEW] Total translations:', Object.keys(nonEmptyTranslations).length);
    console.log('[BUILD-PREVIEW] Protected entries:', protectedCount);
    console.log('[BUILD-PREVIEW] Categories:', categories);
    console.log('[BUILD-PREVIEW] Sample keys:', sampleKeys);
    console.log('[BUILD-PREVIEW] Tag issues:', tagIssueCount);

    setBuildPreview({
      totalTranslations: Object.keys(nonEmptyTranslations).length,
      protectedCount,
      normalCount,
      categories,
      sampleKeys,
      tagIssueCount,
      tagIssueSamples,
    });
    setShowBuildConfirm(true);
  };

  const handleBuild = async () => {
    if (!state) return;
    setShowBuildConfirm(false);
    setBuildError(null);
    const langBuf = await idbGet<ArrayBuffer>("editorLangFile");
    const dictBuf = await idbGet<ArrayBuffer>("editorDictFile");
    const langFileName = (await idbGet<string>("editorLangFileName")) || "output.zs";
    if (!langBuf) { setBuildProgress("❌ ملف اللغة غير موجود. يرجى العودة لصفحة المعالجة وإعادة رفع الملفات."); setTimeout(() => setBuildProgress(""), 5000); return; }
    setBuilding(true); setBuildProgress("تجهيز الترجمات...");
    try {
      const nonEmptyTranslations: Record<string, string> = {};
      for (const [k, v] of Object.entries(state.translations)) { if (v.trim()) nonEmptyTranslations[k] = v; }

      // الحارس الأخير قبل البناء: يعيد الرموز التقنيّة وفواصل الأسطر لكلّ
      // ترجمة، حتى لو لم تكن فيها وسوم — لأنّ \n قد يفقد من النصّ النظيف.
      let tagFixCount = 0;
      let lineBreakFixCount = 0;
      let tagOkCount = 0;
      const TAG_REGEX_G_BUILD = /[\uFFF9-\uFFFC\uE000-\uE0FF]/g;
      for (const entry of state.entries) {
        const key = `${entry.msbtFile}:${entry.index}`;
        const trans = nonEmptyTranslations[key];
        if (!trans) continue;
        const fixed = restoreTagsAndLineBreaks(entry.original, trans);
        if (fixed === trans) { tagOkCount++; continue; }
        nonEmptyTranslations[key] = fixed;
        const origTagCount = (entry.original.match(TAG_REGEX_G_BUILD) || []).length;
        const transTagCount = (trans.match(TAG_REGEX_G_BUILD) || []).length;
        if (transTagCount < origTagCount) tagFixCount++;
        const origBreaks = (entry.original.match(/\n/g) || []).length;
        const normalized = normalizeLineBreakRepresentations(trans);
        const transBreaks = (normalized.match(/\n/g) || []).length;
        if (origBreaks > transBreaks) lineBreakFixCount++;
        if (entry.msbtFile.includes('DoCommand') || entry.msbtFile.includes('Pouch')) {
          const fixedTagCount = (fixed.match(TAG_REGEX_G_BUILD) || []).length;
          console.log(`[TAG-FIX] ${key}: orig=${origTagCount} tags, trans=${transTagCount} tags, fixed=${fixedTagCount} tags`);
        }
      }
      console.log(`[BUILD-TAGS] Fixed tags: ${tagFixCount}, Fixed line breaks: ${lineBreakFixCount}, Already OK: ${tagOkCount}`);
      console.log(`[BUILD] Total translations: ${Object.keys(nonEmptyTranslations).length}`);
      console.log('[BUILD] Protected entries:', Array.from(state.protectedEntries || []).length);
      console.log('[BUILD] Sample keys:', Object.keys(nonEmptyTranslations).slice(0, 10));

      const result = await localBuild({
        langFile: langBuf,
        langFileName,
        dictFile: dictBuf ?? null,
        translations: nonEmptyTranslations,
        protectedEntries: state.protectedEntries,
        arabicNumerals,
        mirrorPunct: mirrorPunctuation,
        onProgress: (msg) => setBuildProgress(msg),
      });

      const { blob, fileName, modifiedCount, expandedCount, fileSize, compressedSize, buildStats: localStats } = result;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(blobUrl);

      const expandedMsg = expandedCount > 0 ? ` (${expandedCount} تم توسيعها 📐)` : '';
      setBuildProgress(`✅ تم بنجاح! تم تعديل ${modifiedCount} نص${expandedMsg}`);
      setBuildStats({
        modifiedCount,
        expandedCount,
        fileSize,
        compressedSize: compressedSize ?? undefined,
        avgBytePercent: localStats.avgBytePercent,
        maxBytePercent: localStats.maxBytePercent,
        longest: localStats.longest,
        shortest: localStats.shortest,
        categories: localStats.categories,
      });
      setTimeout(() => { setBuilding(false); setBuildProgress(""); }, 3000);
    } catch (err) {
      if (err instanceof LocalBuildError) {
        setBuildError({
          message: err.message,
          diagnostics: { ...err.diagnostics },
        });
        setBuildProgress(`❌ ${err.message}`);
      } else {
        const langBufForDiag = await idbGet<ArrayBuffer>("editorLangFile");
        if (langBufForDiag) {
          setBuildError({
            message: `فشل البناء داخل المتصفّح: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`,
            diagnostics: createLocalBuildDiagnostics(langBufForDiag, langFileName),
          });
        }
        setBuildProgress(`❌ ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
      }
      setTimeout(() => { setBuilding(false); setBuildProgress(""); }, 5000);
    }
  };

  return {
    building,
    buildProgress,
    applyingArabic,
    buildStats,
    setBuildStats,
    buildPreview,
    showBuildConfirm,
    setShowBuildConfirm,
    buildError,
    setBuildError,
    handleApplyArabicProcessing,
    handleUndoArabicProcessing,
    handlePreBuild,
    handleBuild,
  };
}
