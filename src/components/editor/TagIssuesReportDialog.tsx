// تقرير مفصّل لكلّ الترجمات التي قد تُسبّب ظهور `??` في اللعبة.
// يصنّف السبب لكلّ صف ويوفّر زرّ «انتقال» يقفز إلى موقع النصّ في المحرّر،
// و«إصلاح» سريع لتطبيق الإصلاح الآلي على ذلك الصفّ فقط.
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Wrench, ArrowLeftCircle, Loader2 } from "lucide-react";
import { DetailedIssue, TagIssueCause } from "@/lib/tag-restore";

interface Props {
  open: boolean;
  onClose: () => void;
  issues: DetailedIssue[];
  onJumpToEntry: (key: string) => void;
  onFixOne: (key: string, proposed: string) => void;
  onFixAllAuto: () => void;
  isApplying?: boolean;
}

const CAUSE_LABEL: Record<TagIssueCause, { label: string; color: string }> = {
  "pua-inside-word":   { label: "رمز داخل كلمة", color: "bg-destructive/15 text-destructive border-destructive/40" },
  "missing-tag":       { label: "رمز ناقص",      color: "bg-orange-500/15 text-orange-400 border-orange-500/40" },
  "extra-tag":         { label: "رمز زائد",      color: "bg-amber-500/15 text-amber-400 border-amber-500/40" },
  "wrong-order":       { label: "ترتيب/قيمة خاطئة", color: "bg-rose-500/15 text-rose-400 border-rose-500/40" },
  "misplaced":         { label: "موقع خاطئ",     color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40" },
  "needs-line-break":  { label: "فاصل سطر ناقص", color: "bg-sky-500/15 text-sky-400 border-sky-500/40" },
  "literal-line-break":{ label: "<br>/\\n حرفي", color: "bg-slate-500/15 text-slate-300 border-slate-500/40" },
};

const TagIssuesReportDialog: React.FC<Props> = ({ open, onClose, issues, onJumpToEntry, onFixOne, onFixAllAuto, isApplying }) => {
  // تجميع إحصائيّات الأسباب
  const causeCounts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const issue of issues) for (const cause of issue.causes) c[cause] = (c[cause] || 0) + 1;
    return c;
  }, [issues]);

  const autoCount = issues.filter(i => i.autoFixable).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display">تقرير: أين تظهر `??` ولماذا</DialogTitle>
          <DialogDescription className="font-body text-sm">
            {issues.length} نص محتمل مع تصنيف السبب لكلّ منها. اضغط «انتقال» للوصول إليه أو «إصلاح» لتطبيق الإصلاح الآلي على ذلك الصفّ فقط.
          </DialogDescription>
        </DialogHeader>

        {/* بطاقات الإحصاء */}
        <div className="flex flex-wrap gap-2 my-3">
          {(Object.keys(CAUSE_LABEL) as TagIssueCause[]).map(cause => {
            const n = causeCounts[cause] || 0;
            if (!n) return null;
            const meta = CAUSE_LABEL[cause];
            return (
              <Badge key={cause} variant="outline" className={`${meta.color} font-body`}>
                {meta.label}: <span className="font-bold mx-1">{n}</span>
              </Badge>
            );
          })}
        </div>

        <ScrollArea className="flex-1 border rounded-md">
          <ul className="divide-y divide-border">
            {issues.map(issue => (
              <li key={issue.key} className="p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs text-muted-foreground truncate">{issue.msbtFile}</span>
                      <span className="text-xs text-muted-foreground">#{issue.index}</span>
                      <span className="text-xs text-foreground/70 truncate" title={issue.label}>{issue.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {issue.causes.map(c => (
                        <Badge key={c} variant="outline" className={`${CAUSE_LABEL[c].color} text-[10px] py-0`}>
                          {CAUSE_LABEL[c].label}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs font-body text-foreground/90 line-clamp-2 break-words">
                      <span className="text-muted-foreground">الترجمة:</span> {issue.translation}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { onJumpToEntry(issue.key); onClose(); }}>
                      <ArrowLeftCircle className="w-3 h-3 ml-1" />
                      انتقال
                    </Button>
                    {issue.autoFixable && (
                      <Button size="sm" variant="default" className="text-xs h-7" onClick={() => onFixOne(issue.key, issue.proposed)}>
                        <Wrench className="w-3 h-3 ml-1" />
                        إصلاح
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {issues.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground font-body">لا توجد مشاكل مكتشفة 🎉</li>
            )}
          </ul>
        </ScrollArea>

        <DialogFooter className="gap-2 mt-3">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <Button onClick={onFixAllAuto} disabled={autoCount === 0 || isApplying}>
            {isApplying ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Wrench className="w-4 h-4 ml-1" />}
            إصلاح آلي للكلّ ({autoCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TagIssuesReportDialog;
