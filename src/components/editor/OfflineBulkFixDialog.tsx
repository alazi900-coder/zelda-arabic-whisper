// Offline bulk-fix dialog: scans every entry locally (no network) using the
// unified Quality-Lab scanner, groups auto-fixable issues by rule, and lets
// the user apply selected groups in one click. For each group we show:
//   - the problem (issue label)
//   - the reason (why it's wrong)
//   - the solution (sample before/after)
//   - the count of affected entries
import React, { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Wand2, CheckCircle2, X, AlertTriangle, ShieldAlert, Info, ChevronDown, ChevronUp,
} from "lucide-react";
import { scanUnified, type LocalIssue, type IssueSeverity } from "@/lib/quality-lab-scanner";
import type { ExtractedEntry } from "@/components/editor/types";
import type { CustomDicts } from "@/lib/glossary-store";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  entries: ExtractedEntry[];
  translations: Record<string, string>;
  customDicts?: CustomDicts;
  onApply: (updates: Record<string, string>) => void;
}

interface RuleGroup {
  rule: string;
  issue: string;
  reason: string;
  severity: IssueSeverity;
  count: number;
  sample: LocalIssue;
  fixable: LocalIssue[];
}

const sevStyle: Record<IssueSeverity, string> = {
  high: "border-destructive/40 bg-destructive/10 text-destructive",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
};
const sevIcon: Record<IssueSeverity, React.ReactNode> = {
  high: <ShieldAlert className="w-3.5 h-3.5" />,
  medium: <AlertTriangle className="w-3.5 h-3.5" />,
  low: <Info className="w-3.5 h-3.5" />,
};
const sevLabel: Record<IssueSeverity, string> = { high: "خطير", medium: "متوسط", low: "بسيط" };

const OfflineBulkFixDialog: React.FC<Props> = ({
  open, onClose, entries, translations, customDicts, onApply,
}) => {
  const [scanning, setScanning] = useState(false);
  const [groups, setGroups] = useState<RuleGroup[]>([]);
  const [scanned, setScanned] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [totalIssues, setTotalIssues] = useState(0);

  const runScan = async () => {
    if (!entries.length) return;
    setScanning(true);
    // yield to UI
    await new Promise((r) => setTimeout(r, 30));
    try {
      const inputs = entries
        .map((e) => {
          const key = `${e.msbtFile}:${e.index}`;
          const tr = translations[key];
          if (!tr?.trim()) return null;
          return { key, original: e.original, translation: tr, maxBytes: e.maxBytes };
        })
        .filter(Boolean) as { key: string; original: string; translation: string; maxBytes?: number }[];

      const report = scanUnified(inputs, customDicts);

      // group by rule, keeping only auto-fixable issues (suggestion differs)
      const byRule = new Map<string, RuleGroup>();
      for (const it of report.issues) {
        if (!it.suggestion || it.suggestion === it.translation) continue;
        // de-duplicate per key+rule (keep first fix)
        const g = byRule.get(it.rule);
        if (!g) {
          byRule.set(it.rule, {
            rule: it.rule, issue: it.issue, reason: it.reason,
            severity: it.severity, count: 1, sample: it, fixable: [it],
          });
        } else {
          if (g.fixable.find((x) => x.key === it.key)) continue;
          g.count++;
          g.fixable.push(it);
        }
      }
      const list = [...byRule.values()].sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
        return b.count - a.count;
      });
      setGroups(list);
      setTotalIssues(report.total);
      setSelected(new Set(list.map((g) => g.rule)));
      setScanned(true);
    } finally {
      setScanning(false);
    }
  };

  const toggleSel = (rule: string) =>
    setSelected((p) => { const n = new Set(p); n.has(rule) ? n.delete(rule) : n.add(rule); return n; });
  const toggleExp = (rule: string) =>
    setExpanded((p) => { const n = new Set(p); n.has(rule) ? n.delete(rule) : n.add(rule); return n; });

  const totalSelected = useMemo(
    () => groups.filter((g) => selected.has(g.rule)).reduce((sum, g) => sum + g.count, 0),
    [groups, selected],
  );

  const handleApply = () => {
    // Apply rules in their displayed order so each fix builds on the previous
    // one (e.g. punctuation fixes after spaces). Re-scan would be ideal but
    // keeping it simple: collapse multiple fixes per key by chaining them.
    const updates: Record<string, string> = {};
    for (const g of groups) {
      if (!selected.has(g.rule)) continue;
      for (const it of g.fixable) {
        const current = updates[it.key] ?? it.translation;
        // only apply if our recorded suggestion still matches the latest text
        if (current === it.translation) updates[it.key] = it.suggestion;
      }
    }
    const applied = Object.keys(updates).length;
    if (!applied) {
      toast({ title: "لا يوجد ما يُطبَّق", description: "اختر مجموعة واحدة على الأقل." });
      return;
    }
    onApply(updates);
    toast({ title: `✅ تم تطبيق ${applied} إصلاحاً تلقائياً` });
    onClose();
  };

  const reset = () => { setGroups([]); setScanned(false); setSelected(new Set()); setExpanded(new Set()); setTotalIssues(0); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" /> الفحص الشامل والإصلاح التلقائي (دون اتصال)
          </DialogTitle>
          <DialogDescription className="text-sm">
            يفحص كل الترجمات محلياً ويصنّف المشاكل القابلة للإصلاح حسب نوعها مع شرح
            المشكلة والسبب والحل، ثم يطبّق ما تختاره دفعة واحدة.
          </DialogDescription>
        </DialogHeader>

        {!scanned && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <p className="text-sm text-muted-foreground text-center">
              سيتم فحص <b>{entries.length}</b> إدخالاً محلياً عبر أكثر من ٢٠ قاعدة (مسافات، ترقيم،
              أقواس، وسوم تقنية، همزات، كلمات شائعة، تكرارات، تشكيل، اتساق…).
            </p>
            <Button onClick={runScan} disabled={scanning} size="lg" className="font-display">
              {scanning ? <><Loader2 className="w-4 h-4 animate-spin ml-2" /> جاري الفحص…</> : <><Wand2 className="w-4 h-4 ml-2" /> ابدأ الفحص الشامل</>}
            </Button>
          </div>
        )}

        {scanned && (
          <>
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="text-xs text-muted-foreground">
                وُجد <b className="text-foreground">{totalIssues}</b> مشكلة إجمالاً،
                منها <b className="text-primary">{groups.reduce((s, g) => s + g.count, 0)}</b> قابلة للإصلاح التلقائي
                موزّعة على <b>{groups.length}</b> فئة.
              </div>
              <Button variant="ghost" size="sm" onClick={reset} className="text-xs">
                إعادة الفحص
              </Button>
            </div>

            <ScrollArea className="flex-1 max-h-[55vh] border border-border rounded-md mt-2">
              {groups.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  🎉 لا توجد مشاكل قابلة للإصلاح التلقائي.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {groups.map((g) => {
                    const isOpen = expanded.has(g.rule);
                    const isSel = selected.has(g.rule);
                    return (
                      <div key={g.rule} className="p-3">
                        <div className="flex items-start gap-3">
                          <Checkbox checked={isSel} onCheckedChange={() => toggleSel(g.rule)} className="mt-1" />
                          <div className="flex-1 min-w-0">
                            <button onClick={() => toggleExp(g.rule)} className="w-full text-right">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={`text-[10px] gap-1 ${sevStyle[g.severity]}`}>
                                  {sevIcon[g.severity]} {sevLabel[g.severity]}
                                </Badge>
                                <span className="font-display font-semibold text-sm">{g.issue}</span>
                                <Badge variant="secondary" className="text-[10px]">{g.count} ترجمة</Badge>
                                <code className="text-[10px] text-muted-foreground/70 font-mono">{g.rule}</code>
                                <span className="ml-auto">
                                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </span>
                              </div>
                            </button>
                            {isOpen && (
                              <div className="mt-2 space-y-2">
                                <div className="text-xs bg-muted/30 rounded p-2 border border-border/50">
                                  <div className="text-muted-foreground/80 mb-1 font-semibold">السبب:</div>
                                  <div>{g.reason}</div>
                                </div>
                                <div className="text-xs bg-primary/5 rounded p-2 border border-primary/20">
                                  <div className="text-primary/80 mb-1 font-semibold">الحل المُطبَّق (مثال):</div>
                                  <div className="space-y-1" dir="rtl">
                                    <div><span className="text-[10px] text-muted-foreground ml-1">قبل:</span>
                                      <span className="bg-destructive/15 text-destructive line-through px-1 rounded">
                                        {g.sample.translation.slice(0, 120)}{g.sample.translation.length > 120 ? "…" : ""}
                                      </span>
                                    </div>
                                    <div><span className="text-[10px] text-muted-foreground ml-1">بعد:</span>
                                      <span className="bg-primary/15 text-primary font-semibold px-1 rounded">
                                        {g.sample.suggestion.slice(0, 120)}{g.sample.suggestion.length > 120 ? "…" : ""}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                <X className="w-4 h-4 ml-1" /> إغلاق
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelected(new Set(groups.map((g) => g.rule)))}>
                تحديد الكل
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                إلغاء التحديد
              </Button>
              <Button onClick={handleApply} disabled={totalSelected === 0} className="font-display">
                <CheckCircle2 className="w-4 h-4 ml-1" /> تطبيق {totalSelected} إصلاحاً
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OfflineBulkFixDialog;
