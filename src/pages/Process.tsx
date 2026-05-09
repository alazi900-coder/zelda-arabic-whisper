import { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { FileArchive, ArrowRight, Loader2, CheckCircle2, Pencil } from "lucide-react";
import ProcessLogsPanel from "@/components/process/ProcessLogsPanel";

const Process = () => {
  const [langFile, setLangFile] = useState<File | null>(null);
  const [dictFile, setDictFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [autoDetectedCount, setAutoDetectedCount] = useState(0);
  const [mergeMode, setMergeMode] = useState<"fresh" | "merge">("fresh");
  const [hasPreviousSession, setHasPreviousSession] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [extractError, setExtractError] = useState<string | null>(null);
  const navigate = useNavigate();

  const appendLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString("ar-SA");
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
  }, []);

  // Check if there's a previous editing session in IndexedDB
  useEffect(() => {
    (async () => {
      const { idbGet } = await import("@/lib/idb-storage");
      const existing = await idbGet<{ translations?: Record<string, string> }>("editorState");
      const hasTranslations = existing?.translations && Object.keys(existing.translations).length > 0;
      setHasPreviousSession(!!hasTranslations);
    })();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, setter: (f: File) => void) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setter(file);
  }, []);

  // Auto-detect and swap files if they're in the wrong slots
  const getCorrectFiles = useCallback((): { lang: File; dict: File; swapped: boolean } => {
    if (!langFile || !dictFile) return { lang: langFile!, dict: dictFile!, swapped: false };
    const langName = langFile.name.toLowerCase();
    const dictName = dictFile.name.toLowerCase();
    const langIsDictionary = langName.includes('zsdic') || langName === 'zsdic.pack.zs';
    const dictIsDictionary = dictName.includes('zsdic') || dictName === 'zsdic.pack.zs';
    if (langIsDictionary && !dictIsDictionary) {
      return { lang: dictFile, dict: langFile, swapped: true };
    }
    return { lang: langFile, dict: dictFile, swapped: false };
  }, [langFile, dictFile]);

  const handleExtract = async () => {
    if (!langFile || !dictFile) return;
    setExtracting(true);
    setExtractError(null);
    setLogs([]);

    const { lang, dict, swapped } = getCorrectFiles();

    appendLog("🗡️ بدء فتح كنز الترجمات...");
    if (swapped) {
      appendLog("🔄 تم التبديل تلقائيًا: ملف القاموس وملف اللغة كانا في الخانات الخاطئة");
    }
    appendLog(`📄 ملف اللغة: ${lang.name} (${(lang.size / 1024 / 1024).toFixed(2)} ميجابايت)`);
    appendLog(`📖 ملف القاموس: ${dict.name} (${(dict.size / 1024 / 1024).toFixed(2)} ميجابايت)`);

    try {
      const formData = new FormData();
      formData.append("langFile", lang);
      formData.append("dictFile", dict);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      appendLog("📡 إرسال الملفات إلى الخادم...");
      const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/arabize?mode=extract`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey },
        body: formData,
      });

      if (!response.ok) {
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const err = await response.json();
          throw new Error(err.error || `خطأ ${response.status}`);
        }
        throw new Error(`خطأ ${response.status}`);
      }
      appendLog("✅ تمّ فك الضغط واستخراج أرشيف SARC وقراءة ملفات MSBT");

      const data = await response.json();
      const fileSet = new Set<string>();
      for (const e of data.entries) fileSet.add(e.msbtFile);
      appendLog(`📜 استُخرج ${data.entries.length} نصاً من ${fileSet.size} ملف MSBT`);

      // Store files in IndexedDB to avoid sessionStorage quota
      const { idbSet, idbGet } = await import("@/lib/idb-storage");
      const langBuf = await langFile.arrayBuffer();
      const dictBuf = await dictFile.arrayBuffer();
      await idbSet("editorLangFile", langBuf);
      await idbSet("editorDictFile", dictBuf);
      await idbSet("editorLangFileName", langFile.name);
      await idbSet("editorDictFileName", dictFile.name);
      // Auto-detect already-Arabic entries and pre-populate as translated
      // Clean presentation forms and fix reversed text so editor shows readable Arabic
      const autoTranslations: Record<string, string> = {};
      // Only match actual Arabic letters (not just any char in the range)
      const arabicLetterRegex = /[\u0621-\u064A\u0671-\u06D3\uFB50-\uFDFF\uFE70-\uFEFF]/g;
      for (const entry of data.entries) {
        // Strip tag markers and control chars before checking for Arabic
        const stripped = entry.original
          // eslint-disable-next-line no-control-regex -- intentional: strips MSBT control bytes from extracted text
          .replace(/[\uE000-\uF8FF\uFFF9-\uFFFC\u0000-\u001F]/g, '')
          .trim();
        // Require at least 2 actual Arabic letters to avoid false positives from binary noise
        const arabicMatches = stripped.match(arabicLetterRegex);
        if (arabicMatches && arabicMatches.length >= 2) {
          const key = `${entry.msbtFile}:${entry.index}`;
          // Normalize presentation forms to standard Arabic characters
          let cleaned = stripped.normalize("NFKD");
          // Reverse the BiDi so text reads correctly in the editor
          cleaned = cleaned.split('\n').map((line: string) => {
            const segments: { text: string; isLTR: boolean }[] = [];
            let current = '';
            let currentIsLTR: boolean | null = null;
            for (const ch of line) {
              const code = ch.charCodeAt(0);
              const charIsArabic = (code >= 0x0600 && code <= 0x06FF) || (code >= 0xFB50 && code <= 0xFDFF) || (code >= 0xFE70 && code <= 0xFEFF);
              const charIsLTR = /[a-zA-Z0-9]/.test(ch);
              if (charIsArabic) {
                if (currentIsLTR === true && current) { segments.push({ text: current, isLTR: true }); current = ''; }
                currentIsLTR = false; current += ch;
              } else if (charIsLTR) {
                if (currentIsLTR === false && current) { segments.push({ text: current, isLTR: false }); current = ''; }
                currentIsLTR = true; current += ch;
              } else { current += ch; }
            }
            if (current) segments.push({ text: current, isLTR: currentIsLTR === true });
            return segments.reverse().map(seg => seg.isLTR ? seg.text : [...seg.text].reverse().join('')).join('');
          }).join('\n');
          autoTranslations[key] = cleaned;
        }
      }
      const detectedCount = Object.keys(autoTranslations).length;
      console.log(`Auto-detected ${detectedCount} pre-translated Arabic entries`);
      setAutoDetectedCount(detectedCount);
      if (detectedCount > 0) {
        appendLog(`🛡️ كشف ${detectedCount} نصّاً معرّباً مسبقاً + إصلاح اتجاه النص (BiDi)`);
      } else {
        appendLog("🔍 لم تُكتشف ترجمات عربية سابقة داخل الملف");
      }

      // Merge or start fresh based on user choice
      const finalTranslations: Record<string, string> = { ...autoTranslations };

      if (mergeMode === "merge") {
        const existing = await idbGet<{ translations?: Record<string, string> }>("editorState");
        const existingTranslations = existing?.translations || {};
        const validKeys = new Set(data.entries.map((e: any) => `${e.msbtFile}:${e.index}`));
        let preservedCount = 0;
        for (const [k, v] of Object.entries(existingTranslations)) {
          if (validKeys.has(k) && v && !finalTranslations[k]) {
            finalTranslations[k] = v as string;
            preservedCount++;
          }
        }
        console.log(`Preserved ${preservedCount} previous translations`);
        if (preservedCount > 0) {
          appendLog(`💾 دمج ${preservedCount} ترجمة سابقة من الجلسة المحفوظة`);
        }
      }

      appendLog("💾 حفظ النصوص في تخزين المتصفح (IndexedDB)...");
      await idbSet("editorState", {
        entries: data.entries,
        translations: finalTranslations,
        protectedEntries: [],
      });

      const totalTranslated = Object.values(finalTranslations).filter((v) => v && v.trim()).length;
      const pct = data.entries.length > 0 ? Math.round((totalTranslated / data.entries.length) * 100) : 0;
      appendLog(`🏰 جاهز للمغامرة! المُترجَم: ${totalTranslated}/${data.entries.length} (${pct}%) — الانتقال للمحرر...`);

      navigate("/editor");
    } catch (err) {
      const name = err instanceof Error ? err.name : "Error";
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`⚠️ فشل الاستخراج`);
      appendLog(`📋 السبب: ${name}`);
      appendLog(`💬 التفاصيل: ${msg}`);
      if (/timeout|network|fetch|failed to fetch/i.test(msg)) {
        appendLog("💡 الحل: تحقّق من اتصال الإنترنت ثم أعد المحاولة");
      } else if (/quota/i.test(msg) || /quota/i.test(name)) {
        appendLog("💡 الحل: امسح بيانات الموقع من إعدادات المتصفح أو احذف المشاريع القديمة");
      } else if (/413|too large/i.test(msg)) {
        appendLog("💡 الحل: الملف كبير جداً على الخادم — جرّب ملف أصغر");
      } else {
        appendLog("💡 الحل: حدّث الصفحة وأعد المحاولة، وإن استمر الخطأ صدّر السجل وأرسله للمطوّر");
      }
      setExtractError(`${name}: ${msg}`);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 font-body">
          <ArrowRight className="w-4 h-4" />
          العودة للرئيسية
        </Link>

        <h1 className="text-3xl font-display font-bold mb-8">رفع الملفات والمعالجة</h1>

        <ProcessLogsPanel
          logs={logs}
          hasError={!!extractError}
          busy={extracting}
          onRetry={handleExtract}
        />

        {/* File Upload */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <FileDropZone
            label="ملف اللغة (.zs)"
            file={langFile}
            onDrop={(e) => handleDrop(e, setLangFile)}
            onSelect={(f) => setLangFile(f)}
            accept=".zs"
            icon={<FileArchive className="w-8 h-8 text-primary" />}
            disabled={extracting}
          />
          <FileDropZone
            label="ملف القاموس (ZsDic.pack.zs)"
            file={dictFile}
            onDrop={(e) => handleDrop(e, setDictFile)}
            onSelect={(f) => setDictFile(f)}
            accept=".zs"
            icon={<FileArchive className="w-8 h-8 text-secondary" />}
            disabled={extracting}
          />
        </div>

        {/* Merge Mode Toggle */}
        {hasPreviousSession && (
          <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
            <button
              onClick={() => setMergeMode("fresh")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-display font-bold transition-all ${
                mergeMode === "fresh"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              <FileArchive className="w-4 h-4" />
              بدء مشروع جديد
            </button>
            <button
              onClick={() => setMergeMode("merge")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-display font-bold transition-all ${
                mergeMode === "merge"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              استمرار مع دمج الترجمات السابقة
            </button>
          </div>
        )}

        <div className="flex flex-col items-center justify-center gap-4 mb-8">
          <Button
            size="lg"
            onClick={handleExtract}
            disabled={!langFile || !dictFile || extracting}
            className="font-display font-bold text-lg px-10 py-6"
          >
            {extracting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> جاري الاستخراج...</>
            ) : (
              <><Pencil className="w-5 h-5" /> استخراج النصوص وفتح المحرر ✍️</>
            )}
          </Button>
          {autoDetectedCount > 0 && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                تم اكتشاف <span className="font-bold text-primary">{autoDetectedCount}</span> نص معرّب تلقائياً 🎯
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function FileDropZone({
  label, file, onDrop, onSelect, accept, icon, disabled,
}: {
  label: string; file: File | null; onDrop: (e: React.DragEvent) => void;
  onSelect: (f: File) => void; accept: string; icon: React.ReactNode; disabled: boolean;
}) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`relative flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-colors cursor-pointer
        ${file ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 bg-card"}
        ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      {icon}
      <p className="mt-3 font-display font-semibold">{label}</p>
      {file ? (
        <p className="text-sm text-primary mt-1">{file.name}</p>
      ) : (
        <p className="text-sm text-muted-foreground mt-1">اسحب وأفلت أو اختر ملف</p>
      )}
      <input
        type="file"
        accept={accept}
        className="absolute inset-0 opacity-0 cursor-pointer"
        onChange={(e) => e.target.files?.[0] && onSelect(e.target.files[0])}
        disabled={disabled}
      />
    </div>
  );
}

export default Process;
