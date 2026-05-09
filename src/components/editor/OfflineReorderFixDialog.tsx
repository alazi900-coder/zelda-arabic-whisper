import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, ArrowRightLeft, Check, CheckCircle2, Loader2, Octagon, RefreshCw,
  ShieldCheck, StopCircle, X,
} from "lucide-react";
import type { ExtractedEntry } from "@/components/editor/types";
import {
  scanReorderedTranslations,
  type ReorderMethod,
  type ReorderScanProgress,
  type ReorderScanReport,
  type ReorderSuggestion,
} from "@/lib/offline-reorder-matcher";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  entries: ExtractedEntry[];
  translations: Record<string, string>;
  onApply: (updates: Record<string, string>) => void;
}

type SeverityFilter = "all" | "high" | "medium" | "low";

const methodLabel: Record<ReorderMethod, string> = {
  phrase: "تصحيح عبارة قصيرة",
  duplicate: "توحيد نص مكرر",
  sequence: "إصلاح انزياح/عكس ترتيب",
  nearest: "مطابقة أقرب ترجمة",
};

const methodTone: Record<ReorderMethod, string> = {
  phrase: "border-primary/40 bg-primary/10 text-primary",
  duplicate: "border-secondary bg-secondary text-secondary-foreground",
  sequence: "border-destructive/40 bg-destructive/10 text-destructive",
  nearest: "border-border bg-muted text-foreground",
};

const phaseLabel: Record<ReorderScanProgress["phase"], string> = {
  preparing: "جارٍ التحضير",
  phrase: "فحص العبارات القصيرة",
  duplicate: "كشف النصوص المكررة",
  sequence: "كشف انزياح الترتيب داخل الملفات",
  nearest: "البحث عن أقرب مطابقة",
  done: "اكتمل الفحص",
  aborted: "تم إيقاف الفحص",
};

function severityOf(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 80) return "high";
  if (confidence >= 60) return "medium";
  return "low";
}

function severityLabel(level: "high" | "medium" | "low"): string {
  if (level === "high") return "خطيرة";
  if (level === "medium") return "متوسطة";
  return "بسيطة";
}

function severityTone(level: "high" | "medium" | "low"): string {
  if (level === "high") return "border-destructive/50 bg-destructive/15 text-destructive";
  if (level === "medium") return "border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "border-muted-foreground/30 bg-muted text-muted-foreground";
}

function SeverityIcon({ level, className }: { level: "high" | "medium" | "low"; className?: string }) {
  if (level === "high") return <Octagon className={className} />;
  if (level === "medium") return <AlertTriangle className={className} />;
  return <ShieldCheck className={className} />;
}

const OfflineReorderFixDialog: React.FC<Props> = ({
  open, onClose, entries, translations, onApply,
}) => {
  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState<ReorderScanReport | null>(null);
  const [partialSuggestions, setPartialSuggestions] = useState<ReorderSuggestion[]>([]);
  const [progress, setProgress] = useState<ReorderScanProgress | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<"file" | "project">("file");
  const [aggressiveness, setAggressiveness] = useState<"safe" | "balanced" | "strong">("balanced");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const abortControllerRef = useRef<AbortController | null>(null);

  const hasStarted = scanning || report !== null || partialSuggestions.length > 0;
  const baseSuggestions = useMemo(
    () => (report ? report.suggestions : partialSuggestions),
    [report, partialSuggestions],
  );

  const visibleSuggestions = useMemo(() => {
    return baseSuggestions.filter((s) => {
      if (dismissed.has(s.key)) return false;
      if (severityFilter === "all") return true;
      return severityOf(s.confidence) === severityFilter;
    });
  }, [baseSuggestions, dismissed, severityFilter]);

  const severityCounts = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    for (const s of baseSuggestions) {
      if (dismissed.has(s.key)) continue;
      counts[severityOf(s.confidence)]++;
    }
    return counts;
  }, [baseSuggestions, dismissed]);

  const selectedSuggestions = useMemo(
    () => visibleSuggestions.filter((s) => selected.has(s.key)),
    [visibleSuggestions, selected],
  );

  const avgConfidence = useMemo(() => {
    if (!visibleSuggestions.length) return 0;
    return Math.round(visibleSuggestions.reduce((sum, s) => sum + s.confidence, 0) / visibleSuggestions.length);
  }, [visibleSuggestions]);

  const reset = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setReport(null);
    setPartialSuggestions([]);
    setProgress(null);
    setSelected(new Set());
    setExpanded(new Set());
    setDismissed(new Set());
    setScanning(false);
    setSeverityFilter("all");
  };

  useEffect(() => {
    if (!open && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [open]);

  const runScan = async () => {
    if (!entries.length) return;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setScanning(true);
    setReport(null);
    setPartialSuggestions([]);
    setSelected(new Set());
    setExpanded(new Set());
    setDismissed(new Set());
    setProgress({ phase: "preparing", processed: 0, total: entries.length, found: 0 });

    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const next = await scanReorderedTranslations(
        entries,
        translations,
        { scope, aggressiveness },
        {
          signal: controller.signal,
          onProgress: (info) => setProgress(info),
          onPartial: (list) => setPartialSuggestions(list),
        },
      );
      setReport(next);
      setSelected(new Set(next.suggestions.filter((s) => s.confidence >= 60).map((s) => s.key)));
      setExpanded(new Set(next.suggestions.slice(0, 3).map((s) => s.key)));
      if (next.aborted) {
        toast({ title: `تم إيقاف الفحص — ${next.suggestions.length} نتيجة جزئية محفوظة` });
      } else if (next.suggestions.length === 0) {
        toast({ title: "لم يتم العثور على ترجمات غير مرتبة بثقة كافية" });
      }
    } finally {
      setScanning(false);
      abortControllerRef.current = null;
    }
  };

  const stopScan = () => {
    abortControllerRef.current?.abort();
  };

  const toggleSelected = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyOne = (s: ReorderSuggestion) => {
    if (!s.suggested.trim() || s.current === s.suggested) return;
    onApply({ [s.key]: s.suggested });
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(s.key);
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(s.key);
      return next;
    });
    toast({ title: "تم تطبيق إصلاح ترتيب واحد" });
  };

  const rejectOne = (s: ReorderSuggestion) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(s.key);
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(s.key);
      return next;
    });
  };

  const handleApply = () => {
    const updates: Record<string, string> = {};
    for (const suggestion of selectedSuggestions) {
      if (suggestion.suggested.trim() && suggestion.current !== suggestion.suggested) {
        updates[suggestion.key] = suggestion.suggested;
      }
    }
    const count = Object.keys(updates).length;
    if (!count) {
      toast({ title: "لا يوجد إصلاح محدد للتطبيق" });
      return;
    }
    onApply(updates);
    toast({ title: `تم إصلاح ترتيب ${count} ترجمة محلياً` });
    onClose();
    reset();
  };

  const progressPct = useMemo(() => {
    if (!progress) return 0;
    if (progress.total <= 0) return 0;
    return Math.min(100, Math.round((progress.processed / progress.total) * 100));
  }, [progress]);

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) { onClose(); reset(); } }}>
      <DialogContent
        className="w-[calc(100vw-1rem)] sm:max-w-4xl max-h-[92vh] flex flex-col p-3 sm:p-6 gap-3"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-base sm:text-lg flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary shrink-0" />
            <span className="truncate">أداة إصلاح الترجمات غير المرتبة</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            تفحص الترجمات محلياً وتبحث عن النص الموضوع في خانة خاطئة، أو الترتيب المعكوس، أو الانزياح بين الجمل، ثم تقترح إعادة المطابقة بدون إنترنت.
          </DialogDescription>
        </DialogHeader>

        {!hasStarted && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">نطاق البحث</div>
                <Select value={scope} onValueChange={(value: "file" | "project") => setScope(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file">داخل نفس الملف فقط — أدق وأسرع</SelectItem>
                    <SelectItem value="project">كل المشروع — أوسع وأبطأ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">قوة الإصلاح</div>
                <Select value={aggressiveness} onValueChange={(value: "safe" | "balanced" | "strong") => setAggressiveness(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="safe">آمن — ثقة أعلى وتغييرات أقل</SelectItem>
                    <SelectItem value="balanced">متوازن — مناسب للاستيراد الخارجي</SelectItem>
                    <SelectItem value="strong">قوي — يلتقط حالات أكثر للمراجعة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 sm:p-4 text-xs sm:text-sm space-y-2">
              <div className="font-display font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" /> ماذا سيفحص؟
              </div>
              <div className="text-muted-foreground leading-7">
                سيتم فحص <b className="text-foreground">{entries.length.toLocaleString()}</b> نص. يطابق الجملة الأصلية مع الترجمات اعتماداً على: العبارات القصيرة مثل No/Yes، تكرار نفس النص الأصلي، نمط الانزياح داخل الملف، عكس الترتيب، الأرقام، الوسوم التقنية، عدد الأسطر، علامات السؤال والتعجب، وطول الجملة.
              </div>
            </div>

            <div className="flex justify-center py-2">
              <Button onClick={runScan} disabled={!entries.length} size="lg" className="font-display w-full sm:w-auto">
                <ArrowRightLeft className="w-4 h-4 ml-2" /> ابدأ فحص الترتيب بدون إنترنت
              </Button>
            </div>
          </div>
        )}

        {hasStarted && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {scanning ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  )}
                  <span className="font-semibold truncate">
                    {progress ? phaseLabel[progress.phase] : "اكتمل"}
                  </span>
                </div>
                {scanning && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={stopScan}
                    className="shrink-0 h-8"
                  >
                    <StopCircle className="w-4 h-4 ml-1" /> إيقاف
                  </Button>
                )}
              </div>

              <Progress value={progressPct} className="h-2" />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] sm:text-xs">
                <div className="rounded-md border border-border bg-muted/20 p-2 sm:p-3">
                  <div className="text-muted-foreground">قيد الفحص</div>
                  <div className="font-display font-bold text-sm sm:text-base">
                    {progress ? `${progress.processed.toLocaleString()} / ${progress.total.toLocaleString()}` : `${entries.length.toLocaleString()}`}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2 sm:p-3">
                  <div className="text-muted-foreground">ترجمات موجودة</div>
                  <div className="font-display font-bold text-sm sm:text-base">
                    {report ? report.translated.toLocaleString() : "—"}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2 sm:p-3">
                  <div className="text-muted-foreground">اقتراحات</div>
                  <div className="font-display font-bold text-primary text-sm sm:text-base">
                    {baseSuggestions.length.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2 sm:p-3">
                  <div className="text-muted-foreground">متوسط الثقة</div>
                  <div className="font-display font-bold text-sm sm:text-base">{avgConfidence}%</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] sm:text-xs text-muted-foreground ml-1">تصفية الخطورة:</span>
                {(["all", "high", "medium", "low"] as SeverityFilter[]).map((level) => {
                  const isActive = severityFilter === level;
                  const count =
                    level === "all"
                      ? severityCounts.high + severityCounts.medium + severityCounts.low
                      : severityCounts[level];
                  const text = level === "all" ? "الكل" : severityLabel(level);
                  return (
                    <Button
                      key={level}
                      type="button"
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      onClick={() => setSeverityFilter(level)}
                      className="h-7 px-2 text-[11px] sm:text-xs"
                    >
                      {level !== "all" && <SeverityIcon level={level} className="w-3 h-3 ml-1" />}
                      <span>{text}</span>
                      <span className="mr-1 opacity-70">({count})</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-[160px] max-h-[55vh] border border-border rounded-md">
              {visibleSuggestions.length === 0 ? (
                <div className="p-6 sm:p-8 text-center text-xs sm:text-sm text-muted-foreground">
                  {scanning
                    ? "جارٍ البحث... ستظهر النتائج هنا فور اكتشافها."
                    : baseSuggestions.length === 0
                      ? "لا توجد ترجمات غير مرتبة يمكن إصلاحها بثقة. جرّب نطاق “كل المشروع” أو قوة “قوي”."
                      : "لا توجد نتائج ضمن مستوى الخطورة المختار. غيّر الفلتر لعرض المزيد."}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {visibleSuggestions.map((suggestion) => {
                    const isOpen = expanded.has(suggestion.key);
                    const isSelected = selected.has(suggestion.key);
                    const sev = severityOf(suggestion.confidence);
                    return (
                      <div key={suggestion.key} className="p-2 sm:p-3 space-y-2">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelected(suggestion.key)}
                            className="mt-1 shrink-0"
                            aria-label="تحديد للتطبيق المجمّع"
                          />
                          <button
                            type="button"
                            className="flex-1 min-w-0 text-right"
                            onClick={() => toggleExpanded(suggestion.key)}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className={`${severityTone(sev)} text-[10px] sm:text-xs`}>
                                <SeverityIcon level={sev} className="w-3 h-3 ml-1" />
                                {severityLabel(sev)}
                              </Badge>
                              <Badge variant="outline" className={`${methodTone[suggestion.method]} text-[10px] sm:text-xs`}>
                                {methodLabel[suggestion.method]}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] sm:text-xs">
                                {suggestion.confidence}%
                              </Badge>
                              <code className="text-[10px] text-muted-foreground font-mono truncate max-w-full">
                                {suggestion.key}
                              </code>
                            </div>
                            <div className="mt-1.5 text-xs sm:text-sm font-semibold line-clamp-2">{suggestion.problem}</div>
                            <div className="mt-1 text-[11px] sm:text-xs text-muted-foreground line-clamp-1">{suggestion.original}</div>
                          </button>
                        </div>

                        {isOpen && (
                          <div className="mr-6 sm:mr-8 space-y-2">
                            <div className="rounded-md border border-border bg-muted/20 p-2 text-[11px] sm:text-xs leading-6">
                              <div className="font-semibold text-foreground">السبب:</div>
                              <div className="text-muted-foreground">{suggestion.reason}</div>
                              {suggestion.evidence.length > 0 && (
                                <div className="mt-1 text-muted-foreground">
                                  الدليل: {suggestion.evidence.join("، ")}
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] sm:text-xs">
                              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2">
                                <div className="font-semibold text-destructive mb-1">الترجمة الحالية الخاطئة</div>
                                <div className="leading-6 whitespace-pre-wrap break-words">
                                  {suggestion.current || "—"}
                                </div>
                              </div>
                              <div className="rounded-md border border-primary/30 bg-primary/10 p-2">
                                <div className="font-semibold text-primary mb-1">الإصلاح المقترح</div>
                                <div className="leading-6 whitespace-pre-wrap break-words">
                                  {suggestion.suggested}
                                </div>
                                {suggestion.sourceKey && (
                                  <div className="mt-1 text-[10px] text-muted-foreground">
                                    من: {suggestion.sourceKey}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pr-6 sm:pr-8">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => applyOne(suggestion)}
                            className="h-7 px-2 text-[11px] sm:text-xs"
                          >
                            <Check className="w-3.5 h-3.5 ml-1" /> تطبيق هذا الإصلاح
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectOne(suggestion)}
                            className="h-7 px-2 text-[11px] sm:text-xs"
                          >
                            <X className="w-3.5 h-3.5 ml-1" /> رفض
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { onClose(); reset(); }}
                className="w-full sm:w-auto"
              >
                <X className="w-4 h-4 ml-1" /> إغلاق
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
                className="w-full sm:w-auto"
                disabled={scanning}
              >
                <RefreshCw className="w-4 h-4 ml-1" /> إعادة الضبط
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelected(new Set(visibleSuggestions.map((s) => s.key)))}
                disabled={!visibleSuggestions.length}
                className="w-full sm:w-auto"
              >
                تحديد المعروض
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelected(new Set())}
                disabled={!visibleSuggestions.length}
                className="w-full sm:w-auto"
              >
                إلغاء التحديد
              </Button>
              <Button
                onClick={handleApply}
                disabled={selectedSuggestions.length === 0}
                className="font-display w-full sm:w-auto sm:mr-auto"
              >
                <CheckCircle2 className="w-4 h-4 ml-1" /> تطبيق {selectedSuggestions.length} إصلاح
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OfflineReorderFixDialog;
