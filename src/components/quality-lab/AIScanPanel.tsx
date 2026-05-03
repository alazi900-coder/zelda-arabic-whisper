import { useState } from "react";
import { Sparkles, Square, Brain, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  AI_MODELS,
  runAIScan,
  type AIScanEntry,
  type AIScanMode,
  type AIFilterMode,
} from "@/lib/ai-scanner";
import type { LocalIssue } from "@/lib/local-enhance-scanner";

interface AIScanPanelProps {
  entries: AIScanEntry[];
  /** keys that already have at least one local issue */
  keysWithLocalIssues: Set<string>;
  onResults: (newIssues: LocalIssue[]) => void;
}

const AIScanPanel = ({ entries, keysWithLocalIssues, onResults }: AIScanPanelProps) => {
  const [mode, setMode] = useState<AIScanMode>("grammar");
  const [model, setModel] = useState("gemini-3-flash-preview");
  const [filterMode, setFilterMode] = useState<AIFilterMode>("missing-only");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; issues: number } | null>(null);
  const [cancelFn, setCancelFn] = useState<(() => void) | null>(null);

  const targetCount =
    filterMode === "missing-only"
      ? entries.filter((e) => !keysWithLocalIssues.has(e.key)).length
      : entries.length;

  const start = async () => {
    if (targetCount === 0) {
      toast.warning("لا توجد إدخالات لإرسالها بعد التصفية");
      return;
    }

    setRunning(true);
    setProgress({ current: 0, total: targetCount, issues: 0 });

    const handle = runAIScan(
      entries,
      {
        mode,
        model,
        filterMode,
        keysWithLocalIssues,
      },
      (p) => setProgress({ current: p.current, total: p.total, issues: p.totalIssuesSoFar }),
    );
    setCancelFn(() => handle.cancel);

    try {
      const result = await handle.promise;
      onResults(result.issues);
      if (result.cancelled) {
        toast.info(`أُلغيَ الفحص. أضيفت ${result.issues.length} نتيجة من ${result.totalSent} إدخال أُرسل.`);
      } else if (result.errors > 0) {
        toast.warning(
          `فُحص ${result.totalSent} إدخال. أضيفت ${result.issues.length} نتيجة. ${result.errors} طلب فشل.`,
        );
      } else {
        toast.success(
          result.issues.length === 0
            ? `لا توجد ملاحظات إضافية من النموذج (${result.totalSent} إدخال)`
            : `أُضيفت ${result.issues.length} نتيجة من النموذج (${result.totalSent} إدخال)`,
        );
      }
    } catch (err) {
      toast.error("فشل الفحص بالنموذج. تأكّد من اتصالك ومن الرصيد.");
      console.error(err);
    } finally {
      setRunning(false);
      setProgress(null);
      setCancelFn(null);
    }
  };

  const stop = () => {
    cancelFn?.();
  };

  if (entries.length === 0) return null;

  return (
    <section className="px-4 max-w-6xl mx-auto w-full mb-4">
      <div className="rounded-2xl bg-card border border-primary/30 p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="text-sm sm:text-base font-display font-bold">فحص بمساعدة النموذج</h3>
          <Badge variant="outline" className="text-[10px] mr-auto">
            اختياري
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed [overflow-wrap:anywhere]">
          النماذج تكتشف أخطاء دلالية وأسلوبية لا تستطيع القواعد المحلية كشفها. يحتاج اتصالاً ورصيداً
          من بوّابة Lovable.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">النمط</label>
            <Select value={mode} onValueChange={(v) => setMode(v as AIScanMode)} disabled={running}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grammar" className="text-xs">
                  قواعد ودقّة (يحدّد الأخطاء)
                </SelectItem>
                <SelectItem value="enhance" className="text-xs">
                  تحسين أسلوبي (اقتراحات صياغة)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">النموذج</label>
            <Select value={model} onValueChange={setModel} disabled={running}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="text-[10px]">Google Gemini</SelectLabel>
                  {AI_MODELS.filter((m) => m.group === "google").map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="text-[10px]">OpenAI</SelectLabel>
                  {AI_MODELS.filter((m) => m.group === "openai").map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-muted-foreground mb-1.5 block">النطاق</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilterMode("missing-only")}
              disabled={running}
              className={`px-3 py-1.5 rounded-full border text-xs font-display transition-all ${
                filterMode === "missing-only"
                  ? "bg-primary/15 border-primary/40 text-primary ring-1 ring-primary/30"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              ما لم يُكتَشف محلياً ({entries.length - keysWithLocalIssues.size})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              disabled={running}
              className={`px-3 py-1.5 rounded-full border text-xs font-display transition-all ${
                filterMode === "all"
                  ? "bg-primary/15 border-primary/40 text-primary ring-1 ring-primary/30"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              كلّ الإدخالات ({entries.length})
            </button>
          </div>
          {filterMode === "missing-only" && (
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
              يُرسل فقط الإدخالات التي لم تُحرز محلياً، فتُوفّر استدعاءات النموذج.
            </p>
          )}
        </div>

        {progress && (
          <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 border border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="font-display font-bold">جارٍ الفحص…</span>
              <span className="text-muted-foreground">
                {progress.current}/{progress.total} • {progress.issues} نتيجة
              </span>
            </div>
            <Progress value={(progress.current / Math.max(1, progress.total)) * 100} className="h-1.5" />
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          {!running ? (
            <Button
              type="button"
              size="sm"
              onClick={start}
              disabled={targetCount === 0}
              className="gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>شغّل الفحص ({targetCount})</span>
            </Button>
          ) : (
            <Button type="button" size="sm" variant="destructive" onClick={stop} className="gap-1.5">
              <Square className="w-3.5 h-3.5" />
              <span>إيقاف</span>
            </Button>
          )}
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Zap className="w-3 h-3" />
            النتائج تُضاف فوق نتائج الفحص المحلي
          </span>
        </div>
      </div>
    </section>
  );
};

export default AIScanPanel;
