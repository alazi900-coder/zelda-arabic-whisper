import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ClipboardPaste,
  FileUp,
  Database,
  FileJson,
  FileText,
  Loader2,
} from "lucide-react";

export interface ScanEntry {
  key: string;
  original: string;
  translation: string;
}

interface InputZoneProps {
  onLoaded: (entries: ScanEntry[]) => void;
}

const SAMPLE_PASTE = `# الصق هنا الإدخالات بصيغة:
# المفتاح\tالأصل\tالترجمة
# (مفصول بـ tab)

intro:1\tHello, hero!\tأهلا، أيها البطل!
intro:2\tFind the Master Sword\tاعثر على السيف الأسطوري
intro:3\tYou win\tانتصرت`;

const InputZone = ({ onLoaded }: InputZoneProps) => {
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseTSV = (text: string): ScanEntry[] => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    const out: ScanEntry[] = [];
    for (const line of lines) {
      const parts = line.split(/\t/);
      if (parts.length >= 3) {
        out.push({ key: parts[0], original: parts[1], translation: parts[2] });
      } else if (parts.length === 2) {
        out.push({ key: `entry:${out.length + 1}`, original: parts[0], translation: parts[1] });
      }
    }
    return out;
  };

  const parseCSV = (text: string): ScanEntry[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return [];
    // skip header if present
    const header = lines[0].toLowerCase();
    const startIdx = header.includes("original") || header.includes("source") || header.includes("english") ? 1 : 0;
    const out: ScanEntry[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      if (cells.length >= 3) {
        out.push({ key: cells[0], original: cells[1], translation: cells[2] });
      } else if (cells.length === 2) {
        out.push({ key: `entry:${out.length + 1}`, original: cells[0], translation: cells[1] });
      }
    }
    return out;
  };

  const parseJSON = (text: string): ScanEntry[] => {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      throw new Error("JSON يجب أن يكون مصفوفة من الكائنات");
    }
    return data
      .map((row, i) => ({
        key: String(row.key ?? row.id ?? `entry:${i + 1}`),
        original: String(row.original ?? row.source ?? row.en ?? ""),
        translation: String(row.translation ?? row.target ?? row.ar ?? ""),
      }))
      .filter((r) => r.original || r.translation);
  };

  const handlePaste = () => {
    setBusy(true);
    try {
      const entries = parseTSV(pasteText);
      if (entries.length === 0) {
        toast.error("لم نجد أيّ إدخال صالح. تأكّد من التنسيق.");
        return;
      }
      onLoaded(entries);
      toast.success(`تم تحميل ${entries.length} إدخال`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const lower = file.name.toLowerCase();
      let entries: ScanEntry[] = [];
      if (lower.endsWith(".json")) {
        entries = parseJSON(text);
      } else if (lower.endsWith(".csv")) {
        entries = parseCSV(text);
      } else {
        entries = parseTSV(text);
      }
      if (entries.length === 0) {
        toast.error("لم نجد إدخالات في الملفّ");
        return;
      }
      onLoaded(entries);
      toast.success(`تم تحميل ${entries.length} إدخال من «${file.name}»`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleEditorImport = () => {
    setBusy(true);
    try {
      // Try a few common storage keys used by the existing editor.
      const candidates = [
        "translations-cache",
        "msbtCurrent",
        "translation-entries",
      ];
      let found: ScanEntry[] = [];
      for (const k of candidates) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        try {
          const data = JSON.parse(raw);
          const entries = extractEntriesFromObject(data);
          if (entries.length > found.length) found = entries;
        } catch {
          // ignore
        }
      }
      if (found.length === 0) {
        toast.warning("لم نعثر على بيانات من المحرّر. افتح المحرّر أوّلاً وحمّل ملفّ .zs");
        return;
      }
      onLoaded(found);
      toast.success(`تم استيراد ${found.length} إدخال من المحرّر`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="px-4 py-12 max-w-5xl mx-auto w-full">
      <div className="mb-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-display font-bold mb-2">
          من أين سنفحص؟
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          اختر طريقة لتحميل الترجمات. كلّ شيء يبقى داخل متصفّحك.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Upload file */}
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="group relative p-6 rounded-2xl bg-card border border-primary/20 hover:border-primary/60 hover:bg-primary/5 transition-all text-right disabled:opacity-50 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/10 group-hover:to-secondary/5 transition-colors" />
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-3">
              <FileUp className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-bold mb-1">رفع ملفّ</h3>
            <p className="text-xs text-muted-foreground">
              JSON، CSV، أو TSV (المفتاح/الأصل/الترجمة)
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv,.tsv,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </button>

        {/* Paste */}
        <button
          type="button"
          disabled={busy}
          onClick={() => setPasteText(SAMPLE_PASTE)}
          className="group relative p-6 rounded-2xl bg-card border border-primary/20 hover:border-primary/60 hover:bg-primary/5 transition-all text-right disabled:opacity-50 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/10 group-hover:to-secondary/5 transition-colors" />
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-3">
              <ClipboardPaste className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-bold mb-1">لصق نصوص</h3>
            <p className="text-xs text-muted-foreground">
              مفتاح + أصل + ترجمة، كلّ سطر يفصل بـ Tab
            </p>
          </div>
        </button>

        {/* Import from editor */}
        <button
          type="button"
          disabled={busy}
          onClick={handleEditorImport}
          className="group relative p-6 rounded-2xl bg-card border border-primary/20 hover:border-primary/60 hover:bg-primary/5 transition-all text-right disabled:opacity-50 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/10 group-hover:to-secondary/5 transition-colors" />
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-3">
              <Database className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-bold mb-1">من المحرّر</h3>
            <p className="text-xs text-muted-foreground">
              استيراد الجلسة الحالية من محرّر MSBT
            </p>
          </div>
        </button>
      </div>

      {/* Paste textarea */}
      <div className="rounded-2xl bg-card border border-border p-4 sm:p-6">
        <Textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={SAMPLE_PASTE}
          className="font-mono text-xs sm:text-sm min-h-[180px] resize-y bg-background/50"
          dir="ltr"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <FileJson className="w-3.5 h-3.5" /> JSON
            </span>
            <span className="text-muted-foreground/50">/</span>
            <span className="inline-flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> CSV
            </span>
            <span className="text-muted-foreground/50">/</span>
            <span>TSV</span>
          </div>
          <Button
            onClick={handlePaste}
            disabled={busy || pasteText.trim().length === 0}
            className="font-display"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            افحص الآن
          </Button>
        </div>
      </div>
    </section>
  );
};

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function extractEntriesFromObject(data: unknown): ScanEntry[] {
  const out: ScanEntry[] = [];
  if (!data) return out;
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (typeof row !== "object" || row === null) continue;
      const r = row as Record<string, unknown>;
      const original = String(r.original ?? r.source ?? r.en ?? r.text ?? "");
      const translation = String(r.translation ?? r.target ?? r.ar ?? "");
      if (original || translation) {
        out.push({
          key: String(r.key ?? r.id ?? `entry:${i + 1}`),
          original,
          translation,
        });
      }
    }
  } else if (typeof data === "object") {
    // Maybe entries: [...]
    const r = data as Record<string, unknown>;
    if (Array.isArray(r.entries)) return extractEntriesFromObject(r.entries);
    if (Array.isArray(r.translations)) return extractEntriesFromObject(r.translations);
  }
  return out;
}

export default InputZone;
