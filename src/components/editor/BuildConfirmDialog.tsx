import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2, AlertTriangle } from "lucide-react";

export interface BuildPreviewTagIssue {
  key: string;
  reason: string;
}

export interface BuildPreview {
  totalTranslations: number;
  protectedCount: number;
  normalCount: number;
  categories: Record<string, number>;
  sampleKeys: string[];
  /** عدد الترجمات التي رموزها التقنية مفقودة/زائدة/مختلفة الترتيب عن الأصل. */
  tagIssueCount?: number;
  /** عيّنة من الترجمات المعيبة لعرضها في حوار التأكيد. */
  tagIssueSamples?: BuildPreviewTagIssue[];
}

interface BuildConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: BuildPreview | null;
  onConfirm: () => void;
  building: boolean;
}

const BuildConfirmDialog = ({ open, onOpenChange, preview, onConfirm, building }: BuildConfirmDialogProps) => {
  if (!preview) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">تأكيد البناء 🏗️</DialogTitle>
          <DialogDescription className="font-body text-sm">
            مراجعة الترجمات التي ستُرسل للبناء
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Total count */}
          <div className="text-center p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-3xl font-display font-bold text-primary">{preview.totalTranslations}</p>
            <p className="text-sm text-muted-foreground font-body">ترجمة ستُرسل للبناء</p>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-2 text-sm font-body">
            <div className="p-2 rounded bg-secondary/10 border border-secondary/20 text-center">
              <p className="font-bold text-secondary">{preview.normalCount}</p>
              <p className="text-xs text-muted-foreground">عادية</p>
            </div>
            <div className="p-2 rounded bg-accent/10 border border-accent/20 text-center">
              <p className="font-bold text-accent">{preview.protectedCount}</p>
              <p className="text-xs text-muted-foreground">محمية</p>
            </div>
          </div>

          {/* Categories */}
          {Object.keys(preview.categories).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-display font-bold text-muted-foreground">توزيع حسب الفئة:</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {Object.entries(preview.categories)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => (
                    <div key={cat} className="flex justify-between items-center text-xs font-body px-2 py-1 rounded bg-muted/50">
                      <span className="truncate">{cat}</span>
                      <span className="font-bold text-foreground">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {preview.totalTranslations === 0 && (
            <div className="p-3 rounded bg-destructive/10 border border-destructive/20 text-center">
              <p className="text-sm text-destructive font-display font-bold">⚠️ لا توجد ترجمات للإرسال!</p>
              <p className="text-xs text-muted-foreground font-body">تأكد من أنك أدخلت ترجمات في المحرر</p>
            </div>
          )}
        </div>

          {!!preview.tagIssueCount && preview.tagIssueCount > 0 && (
            <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                <p className="text-sm font-display font-bold">
                  تحذير: {preview.tagIssueCount} ترجمة فيها مشاكل في الرموز التقنية
                </p>
              </div>
              <p className="text-xs text-muted-foreground font-body">
                الرموز مفقودة/زائدة أو ترتيبها يختلف عن الأصل. قد تظهر «??» في اللعبة.
                يُنصح بفتح أداة «إصلاح الرموز التقنية» قبل البناء.
              </p>
              {!!preview.tagIssueSamples?.length && (
                <ul className="text-[11px] font-mono text-muted-foreground max-h-24 overflow-y-auto space-y-0.5 pl-2">
                  {preview.tagIssueSamples.slice(0, 5).map((s) => (
                    <li key={s.key} className="truncate">• {s.key} — {s.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="font-body">
            إلغاء
          </Button>
          <Button onClick={onConfirm} disabled={building || preview.totalTranslations === 0} className="font-display font-bold">
            {building ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <FileDown className="w-4 h-4 ml-2" />}
            بناء الملف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BuildConfirmDialog;
