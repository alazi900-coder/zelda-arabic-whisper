import { useEffect, useMemo, useState } from "react";
import { Globe, Square, KeyRound, ExternalLink, Trash2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  loadGoogleApiKey,
  saveGoogleApiKey,
  clearGoogleApiKey,
  runGoogleRoundTrip,
  roundTripIssuesToLocal,
  type RoundTripEntry,
} from "@/lib/google-assist";
import type { LocalIssue } from "@/lib/local-enhance-scanner";

interface GoogleRoundTripPanelProps {
  entries: RoundTripEntry[];
  /** keys with at least one local issue — for hybrid filtering */
  keysWithLocalIssues: Set<string>;
  onResults: (newIssues: LocalIssue[]) => void;
}

const GoogleRoundTripPanel = ({
  entries,
  keysWithLocalIssues,
  onResults,
}: GoogleRoundTripPanelProps) => {
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [threshold, setThreshold] = useState(0.55);
  const [filterMode, setFilterMode] = useState<"missing-only" | "all">("missing-only");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; flagged: number } | null>(null);
  const [cancelFn, setCancelFn] = useState<(() => void) | null>(null);

  useEffect(() => {
    setApiKey(loadGoogleApiKey());
  }, []);

  const targetEntries = useMemo<RoundTripEntry[]>(() => {
    if (filterMode === "all") return entries;
    return entries.filter((e) => !keysWithLocalIssues.has(e.key));
  }, [entries, keysWithLocalIssues, filterMode]);

  const persistKey = () => {
    saveGoogleApiKey(apiKey);
    toast.success(apiKey.trim() ? "حُفظ المفتاح محلياً في هذا المتصفّح" : "حُذف المفتاح");
  };

  const removeKey = () => {
    clearGoogleApiKey();
    setApiKey("");
    toast.success("حُذف مفتاح Google من هذا المتصفّح");
  };

  const start = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      toast.error("أدخل مفتاح Google API أوّلاً (الترس أعلى).");
      setShowSettings(true);
      return;
    }
    if (targetEntries.length === 0) {
      toast.warning("لا إدخالات لإرسالها بعد التصفية.");
      return;
    }

    setRunning(true);
    setProgress({ current: 0, total: targetEntries.length, flagged: 0 });

    const handle = runGoogleRoundTrip(
      targetEntries,
      { apiKey: trimmed, threshold },
      (p) => setProgress({ current: p.current, total: p.total, flagged: p.flaggedSoFar }),
    );
    setCancelFn(() => handle.cancel);

    try {
      const result = await handle.promise;
      const localIssues = roundTripIssuesToLocal(result.issues);
      onResults(localIssues);
      if (result.cancelled) {
        toast.info(`أُلغيَ الفحص. وُسمت ${localIssues.length} ترجمة من ${result.processed} إدخال.`);
      } else if (result.errors > 0) {
        toast.warning(
          `فُحص ${result.processed} إدخال. وُسمت ${localIssues.length}. ${result.errors} طلب فشل (تحقّق من المفتاح أو الرصيد).`,
        );
      } else {
        toast.success(
          localIssues.length === 0
            ? `لا تباين دلالي ملحوظ (${result.processed} إدخال)`
            : `وُسمت ${localIssues.length} ترجمة من ${result.processed} إدخال`,
        );
      }
    } catch (err) {
      toast.error("فشل الاتصال بـ Google Translate. تأكّد من المفتاح والرصيد.");
      console.error(err);
    } finally {
      setRunning(false);
      setProgress(null);
      setCancelFn(null);
    }
  };

  const stop = () => cancelFn?.();

  if (entries.length === 0) return null;

  return (
    <section className="px-4 max-w-6xl mx-auto w-full mb-4">
      <div className="rounded-2xl bg-card border border-secondary/40 p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-secondary" />
          <h3 className="text-sm sm:text-base font-display font-bold">فحص دلالي عبر Google (Round-trip)</h3>
          <Badge variant="outline" className="text-[10px] mr-auto">
            اختياري
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowSettings((s) => !s)}
            aria-label="إعدادات"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed [overflow-wrap:anywhere]">
          نُعيد ترجمة العربية إلى الإنجليزية عبر Google ونقارنها بالأصل. لو الفرق كبير ⇐ المعنى انحرف. هذا
          الفحص لا يستطيع المحرّك المحلي ولا النماذج اللغوية إجراءه بنفس الموثوقية.
        </p>

        {showSettings && (
          <div className="rounded-xl bg-muted/40 border border-border p-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] flex items-center gap-1.5">
                <KeyRound className="w-3 h-3" />
                <span>مفتاح Google Cloud Translation API</span>
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="text-xs font-mono"
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={persistKey} className="shrink-0">
                    حفظ
                  </Button>
                  {apiKey && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={removeKey}
                      className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                المفتاح يُحفَظ في متصفّحك فقط (localStorage) ويُرسَل مع كلّ طلب. لا يُخزَّن على خادمنا.{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-0.5 hover:underline"
                >
                  أنشئ مفتاحاً
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] flex justify-between">
                <span>عتبة التشابه</span>
                <span className="text-muted-foreground">{(threshold * 100).toFixed(0)}%</span>
              </Label>
              <Slider
                value={[threshold]}
                min={0.3}
                max={0.85}
                step={0.05}
                onValueChange={(v) => setThreshold(v[0])}
                disabled={running}
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                الترجمة بتشابه أقلّ من هذه القيمة تُوسَم. خفّض العتبة لتقلّ التنبيهات.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="text-[11px] text-muted-foreground mb-1.5 block">النطاق</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilterMode("missing-only")}
              disabled={running}
              className={`px-3 py-1.5 rounded-full border text-xs font-display transition-all ${
                filterMode === "missing-only"
                  ? "bg-secondary/15 border-secondary/40 text-secondary ring-1 ring-secondary/30"
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
                  ? "bg-secondary/15 border-secondary/40 text-secondary ring-1 ring-secondary/30"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              كلّ الإدخالات ({entries.length})
            </button>
          </div>
        </div>

        {progress && (
          <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 border border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="font-display font-bold">جارٍ الفحص الدلالي…</span>
              <span className="text-muted-foreground">
                {progress.current}/{progress.total} • وُسمت {progress.flagged}
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
              disabled={targetEntries.length === 0}
              className="gap-1.5"
              variant="secondary"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>شغّل الفحص الدلالي ({targetEntries.length})</span>
            </Button>
          ) : (
            <Button type="button" size="sm" variant="destructive" onClick={stop} className="gap-1.5">
              <Square className="w-3.5 h-3.5" />
              <span>إيقاف</span>
            </Button>
          )}
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 [overflow-wrap:anywhere]">
            تكلفة Google: ~$20 لكلّ مليون حرف عربي.
          </span>
        </div>
      </div>
    </section>
  );
};

export default GoogleRoundTripPanel;
