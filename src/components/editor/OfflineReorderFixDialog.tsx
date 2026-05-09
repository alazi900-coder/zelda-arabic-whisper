import React, { useMemo, useState } from "react";
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
  ArrowRightLeft, CheckCircle2, Loader2, RefreshCw, ShieldCheck, X,
} from "lucide-react";
import type { ExtractedEntry } from "@/components/editor/types";
import {
  scanReorderedTranslations,
  type ReorderMethod,
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

function confidenceLabel(value: number): string {
  if (value >= 88) return "ثقة عالية جداً";
  if (value >= 74) return "ثقة عالية";
  if (value >= 58) return "ثقة متوسطة";
  return "تحتاج مراجعة";
}

const OfflineReorderFixDialog: React.FC<Props> = ({
  open, onClose, entries, translations, onApply,
}) => {
  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState<ReorderScanReport | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<"file" | "project">("file");
  const [aggressiveness, setAggressiveness] = useState<"safe" | "balanced" | "strong">("balanced");

  const suggestions = useMemo(() => report?.suggestions ?? [], [report?.suggestions]);
  const selectedSuggestions = useMemo(
    () => suggestions.filter((s) => selected.has(s.key)),
    [suggestions, selected],
  );
  const avgConfidence = useMemo(() => {
    if (!suggestions.length) return 0;
    return Math.round(suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length);
  }, [suggestions]);

  const reset = () => {
    setReport(null);
    setSelected(new Set());
    setExpanded(new Set());
    setScanning(false);
  };

  const runScan = async () => {
    if (!entries.length) return;
    setScanning(true);
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const next = await scanReorderedTranslations(entries, translations, { scope, aggressiveness });
      setReport(next);
      setSelected(new Set(next.suggestions.filter((s) => s.confidence >= 58).map((s) => s.key)));
      setExpanded(new Set(next.suggestions.slice(0, 3).map((s) => s.key)));
      if (next.suggestions.length === 0) {
        toast({ title: "لم يتم العثور على ترجمات غير مرتبة بثقة كافية" });
      }
    } finally {
      setScanning(false);
    }
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

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) { onClose(); reset(); } }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" /> أداة إصلاح الترجمات غير المرتبة
          </DialogTitle>
          <DialogDescription className="text-sm">
            تفحص الترجمات محلياً وتبحث عن النص الموضوع في خانة خاطئة، أو الترتيب المعكوس، أو الانزياح بين الجمل، ثم تقترح إعادة المطابقة بدون إنترنت.
          </DialogDescription>
        </DialogHeader>

        {!report && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">نطاق البحث</div>
                <Select value={scope} onValueChange={(value: "file" | "project") => setScope(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file">داخل نفس الملف فقط — أدق</SelectItem>
                    <SelectItem value="project">كل المشروع — أوسع</SelectItem>
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

            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm space-y-2">
              <div className="font-display font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" /> ماذا سيفحص؟
              </div>
              <div className="text-muted-foreground leading-7">
                يطابق الجملة الأصلية مع الترجمات الموجودة اعتماداً على: العبارات القصيرة مثل No/Yes، تكرار نفس النص الأصلي، نمط الانزياح داخل الملف، عكس الترتيب، الأرقام، الوسوم التقنية، عدد الأسطر، علامات السؤال والتعجب، وطول الجملة.
              </div>
            </div>

            <div className="flex justify-center py-3">
              <Button onClick={runScan} disabled={scanning} size="lg" className="font-display">
                {scanning ? <><Loader2 className="w-4 h-4 animate-spin ml-2" /> جاري تحليل الترتيب…</> : <><ArrowRightLeft className="w-4 h-4 ml-2" /> ابدأ فحص الترتيب بدون إنترنت</>}
              </Button>
            </div>
          </div>
        )}

        {report && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <div className="text-[10px] text-muted-foreground">تم فحصه</div>
                <div className="font-display font-bold">{report.scanned}</div>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <div className="text-[10px] text-muted-foreground">ترجمات موجودة</div>
                <div className="font-display font-bold">{report.translated}</div>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <div className="text-[10px] text-muted-foreground">اقتراحات ترتيب</div>
                <div className="font-display font-bold text-primary">{suggestions.length}</div>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <div className="text-[10px] text-muted-foreground">متوسط الثقة</div>
                <div className="font-display font-bold">{avgConfidence}%</div>
              </div>
            </div>

            {suggestions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>المحدد للتطبيق: <b className="text-foreground">{selectedSuggestions.length}</b></span>
                  <span>انزياح/عكس: {report.byMethod.sequence} · عبارات قصيرة: {report.byMethod.phrase} · مكرر: {report.byMethod.duplicate}</span>
                </div>
                <Progress value={avgConfidence} className="h-2" />
              </div>
            )}

            <ScrollArea className="flex-1 max-h-[54vh] border border-border rounded-md mt-2">
              {suggestions.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  لا توجد ترجمات غير مرتبة يمكن إصلاحها بثقة. جرّب نطاق “كل المشروع” أو قوة “قوي” إذا كانت الترجمات مستوردة من ملف مختلف تماماً.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {suggestions.map((suggestion: ReorderSuggestion) => {
                    const isOpen = expanded.has(suggestion.key);
                    const isSelected = selected.has(suggestion.key);
                    return (
                      <div key={suggestion.key} className="p-3 space-y-2">
                        <div className="flex items-start gap-3">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelected(suggestion.key)} className="mt-1" />
                          <button className="flex-1 min-w-0 text-right" onClick={() => toggleExpanded(suggestion.key)}>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={methodTone[suggestion.method]}>{methodLabel[suggestion.method]}</Badge>
                              <Badge variant="secondary">{suggestion.confidence}% · {confidenceLabel(suggestion.confidence)}</Badge>
                              <code className="text-[10px] text-muted-foreground font-mono">{suggestion.key}</code>
                            </div>
                            <div className="mt-2 text-sm font-semibold line-clamp-2">{suggestion.problem}</div>
                            <div className="mt-1 text-xs text-muted-foreground line-clamp-1">{suggestion.original}</div>
                          </button>
                        </div>

                        {isOpen && (
                          <div className="mr-8 space-y-2">
                            <div className="rounded-md border border-border bg-muted/20 p-2 text-xs leading-6">
                              <div className="font-semibold text-foreground">السبب:</div>
                              <div className="text-muted-foreground">{suggestion.reason}</div>
                              {suggestion.evidence.length > 0 && (
                                <div className="mt-1 text-muted-foreground">الدليل: {suggestion.evidence.join("، ")}</div>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2">
                                <div className="font-semibold text-destructive mb-1">الترجمة الحالية الخاطئة</div>
                                <div className="leading-6 whitespace-pre-wrap">{suggestion.current || "—"}</div>
                              </div>
                              <div className="rounded-md border border-primary/30 bg-primary/10 p-2">
                                <div className="font-semibold text-primary mb-1">الإصلاح المقترح</div>
                                <div className="leading-6 whitespace-pre-wrap">{suggestion.suggested}</div>
                                {suggestion.sourceKey && <div className="mt-1 text-[10px] text-muted-foreground">من: {suggestion.sourceKey}</div>}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="flex gap-2 flex-wrap">
              <Button variant="ghost" onClick={() => { onClose(); reset(); }}>
                <X className="w-4 h-4 ml-1" /> إغلاق
              </Button>
              <Button variant="outline" size="sm" onClick={reset}>
                <RefreshCw className="w-4 h-4 ml-1" /> إعادة الضبط
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelected(new Set(suggestions.map((s) => s.key)))} disabled={!suggestions.length}>
                تحديد الكل
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelected(new Set())} disabled={!suggestions.length}>
                إلغاء التحديد
              </Button>
              <Button onClick={handleApply} disabled={selectedSuggestions.length === 0} className="font-display">
                <CheckCircle2 className="w-4 h-4 ml-1" /> تطبيق {selectedSuggestions.length} إصلاح ترتيب
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OfflineReorderFixDialog;
