import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X, CheckCircle2, XCircle, ChevronRight, ChevronLeft } from "lucide-react";

/** Cap rendered rows per page so the dialog stays usable on mobile with very large imports. */
const PAGE_SIZE = 100;

export interface ImportConflict {
  key: string;
  file: string;
  label: string;
  original: string;
  oldTranslation: string;
  newTranslation: string;
  /** True when the new value is byte-identical to the existing one. */
  identical: boolean;
}

interface ImportConflictDialogProps {
  open: boolean;
  conflicts: ImportConflict[];
  autoAppliedCount: number;
  sourceLabel?: string;
  onCancel: () => void;
  onApply: (approvedKeys: Set<string>) => void;
}

type Decision = "approve" | "reject";

const ImportConflictDialog: React.FC<ImportConflictDialogProps> = ({
  open, conflicts, autoAppliedCount, sourceLabel, onCancel, onApply,
}) => {
  // Per-key decision; default = "approve" so users can hit "تطبيق" without ticking each row.
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [page, setPage] = useState(0);

  // Reset decisions when a new staged import comes in (different conflict set).
  useEffect(() => {
    if (open) {
      setDecisions({});
      setPage(0);
    }
  }, [open, conflicts]);

  const pageCount = Math.max(1, Math.ceil(conflicts.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, conflicts.length);
  const visibleConflicts = useMemo(
    () => conflicts.slice(pageStart, pageEnd),
    [conflicts, pageStart, pageEnd],
  );

  const approvedCount = useMemo(
    () => conflicts.filter(c => (decisions[c.key] ?? "approve") === "approve").length,
    [conflicts, decisions],
  );

  const identicalCount = useMemo(
    () => conflicts.filter(c => c.identical).length,
    [conflicts],
  );
  const differingCount = conflicts.length - identicalCount;

  const setAll = (v: Decision) => {
    const next: Record<string, Decision> = {};
    for (const c of conflicts) next[c.key] = v;
    setDecisions(next);
  };

  const toggleOne = (key: string, v: Decision) => {
    setDecisions(prev => ({ ...prev, [key]: v }));
  };

  const handleApply = () => {
    const approved = new Set(
      conflicts.filter(c => (decisions[c.key] ?? "approve") === "approve").map(c => c.key),
    );
    onApply(approved);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-3xl max-h-[90dvh] h-[90dvh] sm:h-auto flex flex-col gap-3 overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            🔄 مقارنة الترجمات قبل الاستيراد
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {sourceLabel ? `المصدر: ${sourceLabel} — ` : ""}
            يوجد <span className="font-bold text-foreground">{conflicts.length}</span> ترجمة موجودة مسبقاً
            {differingCount > 0 && (
              <> (<span className="font-bold text-amber-600 dark:text-amber-400">{differingCount} مختلف</span>
              {identicalCount > 0 ? <> + <span className="text-muted-foreground/80">{identicalCount} متطابق</span></> : null}
              )</>
            )}
            {differingCount === 0 && identicalCount > 0 && (
              <> (كلها <span className="text-muted-foreground/80">متطابقة</span>)</>
            )}
            .
            {autoAppliedCount > 0
              ? ` (+ ${autoAppliedCount} ترجمة جديدة بدون تعارض ستُضاف تلقائياً)`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 border-b border-border pb-2">
          <Button variant="outline" size="sm" onClick={() => setAll("approve")} className="font-body">
            <CheckCircle2 className="w-4 h-4 ml-1" /> الموافقة على الكل
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAll("reject")} className="font-body">
            <XCircle className="w-4 h-4 ml-1" /> رفض الكل
          </Button>
          <span className="text-xs text-muted-foreground self-center mr-auto">
            موافق على {approvedCount} / {conflicts.length}
          </span>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground border-b border-border pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="h-7 px-2 font-body"
              aria-label="السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="font-body">
              الصفحة {safePage + 1} / {pageCount}
              <span className="mx-1 text-muted-foreground/60">
                — السطور {pageStart + 1}…{pageEnd} من {conflicts.length}
              </span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="h-7 px-2 font-body mr-auto"
              aria-label="التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/*
          NOTE: Use a native scroll container instead of Radix ScrollArea — its
          custom-scrollbar viewport doesn't handle touch reliably on Android
          Chrome, leaving large lists effectively unscrollable on mobile.
          `min-h-0` is required so this flex child can actually shrink and
          scroll inside the column-flex DialogContent.
        */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain border border-border rounded-md touch-pan-y">
          <div className="divide-y divide-border">
            {visibleConflicts.map((c, i) => {
              const decision = decisions[c.key] ?? "approve";
              const globalIndex = pageStart + i;
              return (
                <div
                  key={c.key}
                  className={`p-3 transition-colors ${decision === "reject" ? "bg-destructive/5" : c.identical ? "bg-muted/10" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[10px] text-muted-foreground font-mono bg-muted/30 px-1.5 py-0.5 rounded">
                      {globalIndex + 1}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[260px]" title={c.file}>
                      {c.file}
                    </span>
                    {c.label && (
                      <span className="text-[11px] text-muted-foreground/60 truncate max-w-[180px]" title={c.label}>
                        {c.label}
                      </span>
                    )}
                    {c.identical && (
                      <span className="text-[10px] text-muted-foreground/80 bg-muted/40 px-1.5 py-0.5 rounded">
                        متطابق
                      </span>
                    )}
                    <div className="mr-auto flex gap-1">
                      <Button
                        size="sm"
                        variant={decision === "approve" ? "default" : "outline"}
                        onClick={() => toggleOne(c.key, "approve")}
                        className="h-7 px-2 font-body text-xs"
                      >
                        <Check className="w-3 h-3 ml-1" /> موافق
                      </Button>
                      <Button
                        size="sm"
                        variant={decision === "reject" ? "destructive" : "outline"}
                        onClick={() => toggleOne(c.key, "reject")}
                        className="h-7 px-2 font-body text-xs"
                      >
                        <X className="w-3 h-3 ml-1" /> رفض
                      </Button>
                    </div>
                  </div>
                  {c.original && (
                    <div className="text-[11px] text-muted-foreground/70 mb-1.5 font-body break-words" dir="ltr">
                      {c.original}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-body" dir="rtl">
                    <div className="border border-border/60 rounded-md p-2 bg-muted/20">
                      <div className="text-[10px] text-muted-foreground/80 mb-1">القديم (الحالي):</div>
                      <div className="whitespace-pre-wrap break-words">
                        {c.oldTranslation || <span className="text-muted-foreground/40">∅</span>}
                      </div>
                    </div>
                    <div className="border border-primary/40 rounded-md p-2 bg-primary/5">
                      <div className="text-[10px] text-primary/80 mb-1">الجديد (من الملف):</div>
                      <div className="whitespace-pre-wrap break-words">
                        {c.newTranslation || <span className="text-muted-foreground/40">∅</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onCancel} className="font-body">
            <X className="w-4 h-4 ml-1" /> إلغاء الاستيراد
          </Button>
          <Button onClick={handleApply} className="font-body">
            <CheckCircle2 className="w-4 h-4 ml-1" /> تطبيق ({approvedCount} موافق
            {autoAppliedCount > 0 ? ` + ${autoAppliedCount} جديد` : ""})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportConflictDialog;
