import { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, FileArchive, ArrowRight, Loader2, CheckCircle2, AlertCircle, Clock, Download, Pencil } from "lucide-react";

type ProcessingStage = "idle" | "uploading" | "decompressing-dict" | "decompressing-lang" | "extracting" | "reshaping" | "repacking" | "compressing" | "done" | "error";

const stageLabels: Record<ProcessingStage, string> = {
  idle: "في انتظار رفع الملفات",
  uploading: "تحضير الملفات للمعالجة...",
  "decompressing-dict": "فك ضغط القاموس (Dictionary)...",
  "decompressing-lang": "فك ضغط ملف اللغة مع القاموس...",
  extracting: "استخراج أرشيف SARC...",
  reshaping: "معالجة وربط الحروف العربية...",
  repacking: "إعادة حزم الأرشيف...",
  compressing: "ضغط النتيجة النهائية بالقاموس...",
  done: "اكتمل بنجاح! ✨",
  error: "حدث خطأ",
};

const stageProgress: Record<ProcessingStage, number> = {
  idle: 0, uploading: 10, "decompressing-dict": 15, "decompressing-lang": 30, extracting: 40, reshaping: 65, repacking: 80, compressing: 95, done: 100, error: 0,
};

const stageEmojis: Record<ProcessingStage, string> = {
  idle: "⏳", uploading: "📤", "decompressing-dict": "📦", "decompressing-lang": "🔓", extracting: "📂", reshaping: "✍️", repacking: "🔨", compressing: "🗜️", done: "🎉", error: "⚠️",
};

const Process = () => {
  const [langFile, setLangFile] = useState<File | null>(null);
  const [dictFile, setDictFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [logs, setLogs] = useState<string[]>([]);
   const [resultData, setResultData] = useState<{ modifiedCount: number; fileSize: number; compressedFileSize: number | null; entries: any[]; blobUrl: string } | null>(null);
   const [extracting, setExtracting] = useState(false);
   const [autoDetectedCount, setAutoDetectedCount] = useState(0);
   const [mergeMode, setMergeMode] = useState<"fresh" | "merge">("fresh");
   const [hasPreviousSession, setHasPreviousSession] = useState(false);
   const navigate = useNavigate();

   // Check if there's a previous editing session in IndexedDB
   useEffect(() => {
     (async () => {
       const { idbGet } = await import("@/lib/idb-storage");
       const existing = await idbGet<{ translations?: Record<string, string> }>("editorState");
       const hasTranslations = existing?.translations && Object.keys(existing.translations).length > 0;
       setHasPreviousSession(!!hasTranslations);
     })();
   }, []);

  const addLog = (msg: string) => setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString("ar-SA")}] ${msg}`]);

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
    
    // If dict slot has a non-dictionary file and lang slot has the dictionary
    const langIsDictionary = langName.includes('zsdic') || langName === 'zsdic.pack.zs';
    const dictIsDictionary = dictName.includes('zsdic') || dictName === 'zsdic.pack.zs';
    
    if (langIsDictionary && !dictIsDictionary) {
      // Files are swapped - fix them
      return { lang: dictFile, dict: langFile, swapped: true };
    }
    
    return { lang: langFile, dict: dictFile, swapped: false };
  }, [langFile, dictFile]);

  const startProcessing = async () => {
    if (!langFile || !dictFile) return;
    
    const { lang, dict, swapped } = getCorrectFiles();

    setStage("uploading");
    setLogs([]);
    addLog("🚀 بدء عملية التعريب...");
    if (swapped) {
      addLog("🔄 تم اكتشاف أن الملفات مقلوبة - تم تبديلها تلقائياً");
    }
    addLog(`📄 ملف اللغة: ${lang.name} (${(lang.size / 1024 / 1024).toFixed(2)} MB)`);
    addLog(`📚 ملف القاموس: ${dict.name} (${(dict.size / 1024 / 1024).toFixed(2)} MB)`);

    try {
      const formData = new FormData();
      formData.append("langFile", lang);
      formData.append("dictFile", dict);

      setStage("decompressing-dict");
      addLog("\n📦 المرحلة 1: فك ضغط القاموس (Dictionary)");
      addLog("   → استخراج ملف القاموس الخام للاستخدام في فك الضغط...");

      setStage("decompressing-lang");
      addLog("\n🔓 المرحلة 2: فك ضغط ملف اللغة");
      addLog("   → استخدام خوارزمية Zstandard مع القاموس المستخرج...");

      addLog("\n📤 جاري إرسال الملفات إلى المعالجة...");
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/arabize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const errData = await response.json();
          throw new Error(errData.error || `خطأ ${response.status}`);
        }
        throw new Error(`Edge function returned ${response.status}: ${response.statusText}`);
      }

      // Read metadata from headers
      const modifiedCount = parseInt(response.headers.get('X-Modified-Count') || '0');
      const expandedCount = parseInt(response.headers.get('X-Expanded-Count') || '0');
      const skippedAlreadyArabized = parseInt(response.headers.get('X-Skipped-Already-Arabized') || '0');
      const fileSize = parseInt(response.headers.get('X-File-Size') || '0');
      const compressedSize = response.headers.get('X-Compressed-Size');
      const compressedFileSize = compressedSize ? parseInt(compressedSize) : null;
      let entries: any[] = [];
      try {
        const entriesHeader = response.headers.get('X-Entries-Preview');
        if (entriesHeader) entries = JSON.parse(decodeURIComponent(entriesHeader));
      } catch { /* ignore */ }

      // Get binary blob
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const data = { modifiedCount, fileSize, compressedFileSize, entries, blobUrl };

      setStage("extracting");
      addLog("\n📂 المرحلة 3: استخراج أرشيف SARC");
      addLog(`   → تم فك الضغط بنجاح: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      await new Promise((r) => setTimeout(r, 200));

      setStage("reshaping");
      addLog("\n✍️ المرحلة 4: معالجة النصوص العربية");
      addLog(`   → جاري معالجة ${modifiedCount} نص عربي...`);
      await new Promise((r) => setTimeout(r, 200));

      setStage("repacking");
      addLog("\n🔨 المرحلة 5: إعادة حزم الأرشيف");
      await new Promise((r) => setTimeout(r, 200));

      setStage("compressing");
      addLog("\n🗜️ المرحلة 6: ضغط النتيجة النهائية");
      if (compressedFileSize) {
        addLog(`   → نسبة الضغط: ${((1 - compressedFileSize / fileSize) * 100).toFixed(1)}%`);
      }
      await new Promise((r) => setTimeout(r, 200));

      setStage("done");
      addLog("\n✨ اكتملت العملية بنجاح!");
      addLog(`   ✓ تم تعديل ${modifiedCount} نص عربي`);
      if (expandedCount > 0) {
        addLog(`   📐 تم توسيع ${expandedCount} نص (أكبر من الحجم الأصلي)`);
      }
      if (skippedAlreadyArabized > 0) {
        addLog(`   ✓ تم تخطي ${skippedAlreadyArabized} نص معرب مسبقاً (لمنع العكس المزدوج)`);
      }
      addLog(`   ✓ حجم الملف الأصلي: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      if (compressedFileSize) {
        addLog(`   ✓ حجم الملف المضغوط: ${(compressedFileSize / 1024 / 1024).toFixed(2)} MB`);
      }
      addLog("   → يمكنك الآن تحميل الملف وتثبيته في اللعبة");

      setResultData(data);
      // Store metadata only (not binary) in sessionStorage
      sessionStorage.setItem("arabizeResult", JSON.stringify({
        modifiedCount, fileSize, compressedFileSize, entries, blobUrl
      }));
    } catch (err) {
      setStage("error");
      const errorMsg = err instanceof Error ? err.message : "غير معروف";
      
      addLog(`\n❌ فشلت عملية المعالجة`);
      addLog(`\n📌 رسالة الخطأ:`);
      addLog(`   ${errorMsg}`);
      
      // Provide detailed error guidance based on error message
      addLog(`\n🔧 خطوات استكشاف الخطأ:`);
      
      if (errorMsg.includes("فشل فك الضغط") || errorMsg.includes("code -32")) {
        addLog(`   1. ✓ تأكد أن ملف اللغة مضغوط بـ Zstandard مع قاموس (Dictionary)`);
        addLog(`   2. ✓ تأكد من أن ملف القاموس صحيح ولم يتم حذفه أو تعديله`);
        addLog(`   3. ✓ جرب إعادة تحميل الملفات من نسخة احتياطية موثوقة`);
        addLog(`   4. ✓ تأكد أن الملفات لم تتعرض للفساد أثناء النقل`);
      } else if (errorMsg.includes("غير معروف") || errorMsg.includes("صيغة")) {
        addLog(`   1. ✓ تأكد من أن ملف اللغة بصيغة .zs (Zstandard)`);
        addLog(`   2. ✓ تأكد من أن ملف القاموس باسم ZsDic.pack.zs`);
        addLog(`   3. ✓ تحقق من حجم الملفات (لا يجب أن تكون فارغة)`);
        addLog(`   4. ✓ جرب استخدام ملفات من نسخة أخرى من اللعبة`);
      } else if (errorMsg.includes("SARC")) {
        addLog(`   1. ✓ الملف قد يكون بتنسيق غير متوافق`);
        addLog(`   2. ✓ جرب فك الضغط يدويين باستخدام أدوات مخصصة`);
        addLog(`   3. ✓ تأكد من أن الملف ليس نسخة معدلة بالفعل`);
      } else {
        addLog(`   1. ✓ تحقق من اتصال الإنترنت`);
        addLog(`   2. ✓ جرب إعادة رفع الملفات`);
        addLog(`   3. ✓ استخدم ملفات مختلفة للاختبار`);
      }
      
      addLog(`\n📞 إذا استمرت المشكلة:`);
      addLog(`   • تأكد من استخدام نسخة حديثة من التطبيق`);
      addLog(`   • جرب استخدام متصفح مختلف`);
      addLog(`   • حاول من جهاز مختلف إذا أمكن`);
    }
  };

  const isProcessing = !["idle", "done", "error"].includes(stage);

  const handleExtract = async () => {
    if (!langFile || !dictFile) return;
    setExtracting(true);

    const { lang, dict } = getCorrectFiles();

    try {
      const formData = new FormData();
      formData.append("langFile", lang);
      formData.append("dictFile", dict);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

      const data = await response.json();

      // Store files in IndexedDB to avoid sessionStorage quota
      const { idbSet, idbGet, idbClear } = await import("@/lib/idb-storage");
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
      console.log(`Auto-detected ${Object.keys(autoTranslations).length} pre-translated Arabic entries`);
      setAutoDetectedCount(Object.keys(autoTranslations).length);

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
        if (preservedCount > 0) console.log(`Preserved ${preservedCount} previous translations`);
      }

      // Clear old data first, then write fresh state (re-save files after clear)
      await idbClear();
      await idbSet("editorLangFile", langBuf);
      await idbSet("editorDictFile", dictBuf);
      await idbSet("editorLangFileName", langFile.name);
      await idbSet("editorDictFileName", dictFile.name);
      await idbSet("editorState", {
        entries: data.entries,
        translations: finalTranslations,
      });

      navigate("/editor");
    } catch (err) {
      alert(err instanceof Error ? err.message : "خطأ غير معروف");
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

        {/* File Upload */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <FileDropZone
            label="ملف اللغة (.zs)"
            file={langFile}
            onDrop={(e) => handleDrop(e, setLangFile)}
            onSelect={(f) => setLangFile(f)}
            accept=".zs"
            icon={<FileArchive className="w-8 h-8 text-primary" />}
            disabled={isProcessing}
          />
          <FileDropZone
            label="ملف القاموس (ZsDic.pack.zs)"
            file={dictFile}
            onDrop={(e) => handleDrop(e, setDictFile)}
            onSelect={(f) => setDictFile(f)}
            accept=".zs"
            icon={<FileArchive className="w-8 h-8 text-secondary" />}
            disabled={isProcessing}
          />
        </div>

        {/* Merge Mode Toggle */}
        {hasPreviousSession && (
          <div className="flex items-center justify-center gap-3 mb-6">
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

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <Button
            size="lg"
            onClick={startProcessing}
            disabled={!langFile || !dictFile || isProcessing || extracting}
            className="font-display font-bold text-lg px-10 py-6"
          >
            {isProcessing ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> جاري المعالجة...</>
            ) : (
              "ابدأ التعريب التلقائي 🚀"
            )}
          </Button>
           <Button
             size="lg"
             variant="outline"
             onClick={handleExtract}
             disabled={!langFile || !dictFile || isProcessing || extracting}
             className="font-display font-bold text-lg px-10 py-6"
           >
             {extracting ? (
               <><Loader2 className="w-5 h-5 animate-spin" /> جاري الاستخراج...</>
             ) : (
               <><Pencil className="w-5 h-5" /> تحرير يدوي ✍️</>
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

        {/* Progress Card */}
        {stage !== "idle" && (
          <Card className={`mb-6 transition-colors ${stage === "error" ? "border-destructive/50 bg-destructive/5" : stage === "done" ? "border-green-500/50 bg-green-500/5" : ""}`}>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <span className="text-xl">{stageEmojis[stage]}</span>
                {stageLabels[stage]}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Progress value={stageProgress[stage]} className="h-3" />
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>{stageProgress[stage]}% اكتمل</span>
                  {!(stage === "done" || stage === "error") && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      جاري المعالجة...
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Log Panel */}
        {logs.length > 0 && (
          <Card className="mb-6 border-border/50">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                📋 سجل العمليات التفصيلي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-background rounded-lg p-4 max-h-72 overflow-y-auto font-mono text-xs sm:text-sm space-y-1.5 border border-border/40">
                {logs.map((log, i) => (
                  <div key={i} className="text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-right">
                {logs.length > 0 ? "↓ آخر تحديث في أسفل السجل" : ""}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Download & Results */}
        {stage === "done" && resultData && (
          <div className="flex flex-col items-center gap-4 mt-8">
            <Button
              size="lg"
              onClick={() => {
                const a = document.createElement("a");
                a.href = resultData.blobUrl;
                a.download = langFile?.name ? `arabized_${langFile.name}` : "arabized_output.zs";
                a.click();
              }}
              className="font-display font-bold text-lg px-10 py-6"
            >
              <Download className="w-5 h-5" />
              تحميل الملف المعرّب (.zs)
            </Button>
            <Link to="/results">
              <Button variant="outline" size="lg" className="font-display font-bold">
                عرض تفاصيل النتائج
              </Button>
            </Link>
          </div>
        )}
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
