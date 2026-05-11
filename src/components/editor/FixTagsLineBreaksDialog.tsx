import React, { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, FileText, FileCheck2, AlertTriangle, Tags, AlignLeft, ChevronRight, Sparkles } from "lucide-react";
import type { RestoreReport, RestoreIssue, RestoreIssueReasons } from "@/lib/tag-restore";

interface FixTagsLineBreaksDialogProps {
  open: boolean;
  report: RestoreReport | null;
  /** يُغلق النافذة دون تطبيق أيّ إصلاح. */
  onClose: () => void;
  /** يطبّق الإصلاح الآليّ فقط (لا يلمس عناصر «للمراجعة»). */
  onApply: () => void;
}

/** يُظهر الرموز المخفيّة (PUA و FFF9..FFFC) بشكل قابل للقراءة. */
function renderInvisible(text: string): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let buffer = "";
  const flush = (k: string) => {
    if (buffer) {
      parts.push(<span key={`t-${k}-${parts.length}`}>{buffer}</span>);
      buffer = "";
    }
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const code = c.charCodeAt(0);
    if ((code >= 0xfff9 && code <= 0xfffc) || (code >= 0xe000 && code <= 0xe0ff)) {
      flush(`pre-${i}`);
      parts.push(
        <span
          key={`tag-${i}`}
          className="inline-block bg-amber-200 text-amber-900 rounded px-1 mx-0.5 text-[10px] font-mono"
          title={`U+${code.toString(16).toUpperCase().padStart(4, "0")}`}
        >
          {`⟨${code.toString(16).toUpperCase().padStart(4, "0")}⟩`}
        </span>,
      );
    } else if (c === "\n") {
      flush(`pre-${i}`);
      parts.push(
        <span key={`nl-${i}`} className="text-blue-500 mx-0.5" title="فاصل سطر">↵</span>,
      );
      parts.push(<br key={`br-${i}`} />);
    } else {
      buffer += c;
    }
  }
  flush("end");
  return parts;
}

/** أسطر مقروءة من أسباب المشكلة. */
function describeReasons(r: RestoreIssueReasons): string[] {
  const out: string[] = [];
  if (r.missingTags > 0) out.push(`رموز مفقودة: ${r.missingTags}`);
  if (r.extraTags > 0) out.push(`رموز زائدة: ${r.extraTags}`);
  if (r.changedTagPositions > 0) out.push(`رموز اختلف ترتيبها/قيمتها: ${r.changedTagPositions}`);
  if (r.missingLineBreaksAuto > 0) out.push(`فواصل أسطر ناقصة: ${r.missingLineBreaksAuto}`);
  if (r.missingLineBreaksPartial > 0) out.push(`فواصل أسطر ناقصة (تقسيم جزئي): ${r.missingLineBreaksPartial}`);
  if (r.needsNormalize) out.push("يحتوي <br> / \\n / CR يجب تحويلها");
  return out;
}

const IssueCard: React.FC<{ issue: RestoreIssue; index: number }> = ({ issue, index }) => {
  const reasonLines = describeReasons(issue.reasons);
  const showAfter = issue.kind === "auto";

  return (
    <Card className="border-border/60">
      <CardHeader className="py-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">
              #{index + 1}
            </Badge>
            <CardTitle className="text-sm font-semibold truncate max-w-[20rem]" title={issue.label}>
              {issue.label}
            </CardTitle>
            <Badge variant="secondary" className="text-[10px] font-mono">
              {issue.msbtFile}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {reasonLines.map((r, i) => (
              <Badge
                key={i}
                variant="outline"
                className={
                  issue.kind === "auto"
                    ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30"
                }
              >
                {r}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 pb-3">
        <div className="grid gap-2">
          <div className="bg-muted/40 rounded p-2">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
              <FileText className="h-3 w-3" />
              الأصل
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words font-mono" dir="auto">
              {renderInvisible(issue.original)}
            </div>
          </div>
          <div className="bg-rose-50 dark:bg-rose-950/30 rounded p-2">
            <div className="flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-300 mb-1">
              <AlertTriangle className="h-3 w-3" />
              الترجمة الحاليّة
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words font-mono" dir="rtl">
              {renderInvisible(issue.before)}
            </div>
          </div>
          {showAfter && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-2">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 mb-1">
                <FileCheck2 className="h-3 w-3" />
                بعد الإصلاح الآلي
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words font-mono" dir="rtl">
                {renderInvisible(issue.after)}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const FixTagsLineBreaksDialog: React.FC<FixTagsLineBreaksDialogProps> = ({
  open,
  report,
  onClose,
  onApply,
}) => {
  const [tab, setTab] = useState<"auto" | "review">("auto");

  const totalIssues = (report?.autoFixable || 0) + (report?.needsReview || 0);
  const affectedFiles = useMemo(
    () => (report ? Object.keys(report.byFile).length : 0),
    [report],
  );

  // اختر افتراضياً التبويب الذي يحتوي على نتائج
  React.useEffect(() => {
    if (!report) return;
    if (report.autoFixable === 0 && report.needsReview > 0) setTab("review");
    else setTab("auto");
  }, [report]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] flex flex-col"
        dir="rtl"
        aria-describedby="fix-tags-dialog-desc"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-primary" />
            إصلاح الرموز التقنية وفواصل السطور
          </DialogTitle>
          <DialogDescription id="fix-tags-dialog-desc" className="text-xs">
            فحص محلّي بدون ذكاء اصطناعي. الإصلاح يعمل لكلّ ترجمة تحتاجه قبل أن تختفي.
          </DialogDescription>
        </DialogHeader>

        {/* شبكة الإحصائيّات */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-[11px] text-muted-foreground">تمّ فحصها</div>
            <div className="text-2xl font-bold tabular-nums">{report?.scanned ?? 0}</div>
          </div>
          <div className="rounded-md border bg-emerald-50 dark:bg-emerald-950/30 p-3">
            <div className="text-[11px] text-emerald-700 dark:text-emerald-300">إصلاح آليّ</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
              {report?.autoFixable ?? 0}
            </div>
          </div>
          <div className="rounded-md border bg-amber-50 dark:bg-amber-950/30 p-3">
            <div className="text-[11px] text-amber-700 dark:text-amber-300">للمراجعة</div>
            <div className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
              {report?.needsReview ?? 0}
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-[11px] text-muted-foreground">ملفّات متأثّرة</div>
            <div className="text-2xl font-bold tabular-nums">{affectedFiles}</div>
          </div>
        </div>

        {totalIssues === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <Sparkles className="h-8 w-8 mx-auto text-emerald-500" />
              <div className="text-base font-semibold">كلّ الترجمات سليمة</div>
              <div className="text-sm text-muted-foreground">
                لا توجد رموز مفقودة ولا فواصل أسطر ناقصة.
              </div>
            </div>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "auto" | "review")} className="flex-1 min-h-0 flex flex-col">
            <TabsList className="self-start">
              <TabsTrigger value="auto" className="gap-1.5">
                <FileCheck2 className="h-3.5 w-3.5" />
                إصلاح آليّ
                <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                  {report?.autoFixable ?? 0}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="review" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                للمراجعة
                <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                  {report?.needsReview ?? 0}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="auto" className="flex-1 min-h-0 mt-3">
              {!report || report.autoExamples.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  لا توجد ترجمات قابلة للإصلاح الآليّ.
                </div>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <ChevronRight className="h-3 w-3" />
                    عند الضغط على «طبّق الإصلاح الآليّ» سيُحدَّث {report.autoFixable} ترجمة. يمكنك التراجع لكلّ ترجمة على حدة.
                  </div>
                  <ScrollArea className="h-[50vh] pr-2">
                    <div className="space-y-2">
                      {report.autoExamples.map((issue, i) => (
                        <IssueCard key={issue.key} issue={issue} index={i} />
                      ))}
                      {report.autoFixable > report.autoExamples.length && (
                        <div className="text-center text-xs text-muted-foreground py-2">
                          + {report.autoFixable - report.autoExamples.length} ترجمة أخرى ستُعالَج بنفس الطريقة (غير معروضة هنا).
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </>
              )}
            </TabsContent>

            <TabsContent value="review" className="flex-1 min-h-0 mt-3">
              {!report || report.reviewExamples.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  لا توجد ترجمات تحتاج مراجعة يدويّة.
                </div>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <ChevronRight className="h-3 w-3" />
                    هذه الترجمات لا نُعدّلها آلياً (تقسيم جزئي، رمز مختلف، رمز زائد). راجعها يدويّاً في المحرّر.
                  </div>
                  <ScrollArea className="h-[50vh] pr-2">
                    <div className="space-y-2">
                      {report.reviewExamples.map((issue, i) => (
                        <IssueCard key={issue.key} issue={issue} index={i} />
                      ))}
                      {report.needsReview > report.reviewExamples.length && (
                        <div className="text-center text-xs text-muted-foreground py-2">
                          + {report.needsReview - report.reviewExamples.length} ترجمة أخرى تحتاج مراجعة (غير معروضة هنا).
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* توزيع الملفّات (مختصر) */}
        {report && affectedFiles > 0 && (
          <div className="border-t pt-2 flex flex-wrap gap-1.5 text-[11px]">
            <span className="text-muted-foreground">الملفّات:</span>
            {Object.entries(report.byFile).slice(0, 8).map(([file, n]) => (
              <Badge key={file} variant="outline" className="font-mono">
                {file} <span className="mx-1 text-muted-foreground">·</span> {n}
              </Badge>
            ))}
            {Object.keys(report.byFile).length > 8 && (
              <Badge variant="outline" className="text-muted-foreground">
                + {Object.keys(report.byFile).length - 8} ملفّات أخرى
              </Badge>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
          <Button
            onClick={onApply}
            disabled={!report || report.autoFixable === 0}
            className="gap-1.5"
          >
            <Wrench className="h-3.5 w-3.5" />
            طبّق الإصلاح الآليّ ({report?.autoFixable ?? 0})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FixTagsLineBreaksDialog;
