import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Download, Upload, Search, Plus, RefreshCw } from "lucide-react";
import {
  tmList,
  tmRemove,
  tmClear,
  tmUpsert,
  tmExportJSON,
  tmImportJSON,
  type TMEntry,
} from "@/lib/tm-store";

interface TMPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
  /** Optional: pre-populate the "approve current" form. */
  pendingApprovals?: Array<{ key: string; original: string; translation: string }>;
}

const TMPanel = ({ open, onOpenChange, onChanged, pendingApprovals }: TMPanelProps) => {
  const [list, setList] = useState<TMEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [draftOriginal, setDraftOriginal] = useState("");
  const [draftTranslation, setDraftTranslation] = useState("");

  const refresh = async () => {
    setList(await tmList());
    setLoaded(true);
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  const filtered = q.trim()
    ? list.filter((e) => {
        const hay = `${e.original} ${e.translation}`.toLowerCase();
        return hay.includes(q.trim().toLowerCase());
      })
    : list;

  const add = async () => {
    const o = draftOriginal.trim();
    const t = draftTranslation.trim();
    if (!o || !t) return;
    await tmUpsert(o, t);
    setDraftOriginal("");
    setDraftTranslation("");
    toast.success("أُضيف إلى ذاكرة الترجمة");
    await refresh();
    onChanged?.();
  };

  const remove = async (id: string) => {
    await tmRemove(id);
    await refresh();
    onChanged?.();
  };

  const clearAll = async () => {
    if (!confirm("سيُمسح كل ذاكرتك. متابعة؟")) return;
    await tmClear();
    await refresh();
    onChanged?.();
    toast.success("مُسحت ذاكرة الترجمة");
  };

  const exportJson = async () => {
    const json = await tmExportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tm-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير الذاكرة");
  };

  const importJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const n = await tmImportJSON(String(reader.result));
        await refresh();
        onChanged?.();
        toast.success(`استُورد ${n} مدخلاً`);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const approveAll = async () => {
    if (!pendingApprovals || pendingApprovals.length === 0) return;
    let saved = 0;
    for (const p of pendingApprovals) {
      if (!p.original.trim() || !p.translation.trim()) continue;
      await tmUpsert(p.original, p.translation);
      saved++;
    }
    await refresh();
    onChanged?.();
    toast.success(`أُضيف ${saved} مدخلاً إلى الذاكرة`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-2xl flex flex-col gap-0 p-0 overflow-hidden"
      >
        <SheetHeader className="px-5 py-4 border-b border-border text-right">
          <SheetTitle className="font-display">ذاكرة الترجمة (TM)</SheetTitle>
          <SheetDescription className="text-xs leading-relaxed">
            ترجمات معتمدة سابقاً. أيّ جملة أصلية تتطابق مع الذاكرة وتُترجَم بشكل مختلف ستُوسَم تلقائياً.
            تُحفَظ محلياً في متصفّحك (IndexedDB).
          </SheetDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="secondary" className="text-xs">
              المجموع: {list.length} مدخل
            </Badge>
            {pendingApprovals && pendingApprovals.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={approveAll}
                className="h-6 text-xs"
              >
                اعتمد {pendingApprovals.length} ترجمة من الفحص الحالي
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!loaded ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              جارٍ التحميل…
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-muted/30 border border-border p-3 space-y-2">
                <div className="text-xs text-muted-foreground mb-1">إضافة مدخل يدوي</div>
                <Input
                  value={draftOriginal}
                  onChange={(e) => setDraftOriginal(e.target.value)}
                  placeholder="الأصل (إنجليزي)"
                  className="text-sm"
                />
                <Input
                  value={draftTranslation}
                  onChange={(e) => setDraftTranslation(e.target.value)}
                  placeholder="الترجمة المعتمدة"
                  className="text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={add}
                  disabled={!draftOriginal.trim() || !draftTranslation.trim()}
                  className="w-full gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة</span>
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ابحث في الذاكرة…"
                  className="text-sm pr-9"
                />
              </div>

              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 [overflow-wrap:anywhere]">
                  {q ? "لا نتائج لبحثك." : "ذاكرتك فارغة. أضف مدخلاً أو اعتمد ترجمات من الفحص."}
                </p>
              ) : (
                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                  {filtered.map((e) => (
                    <article
                      key={e.id}
                      className="rounded-lg border border-border bg-card p-3 space-y-1.5"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="text-xs text-muted-foreground [overflow-wrap:anywhere] [word-break:break-word]">
                            {e.original}
                          </div>
                          <div className="text-sm [overflow-wrap:anywhere] [word-break:break-word]">
                            {e.translation}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            مُؤكَّدة {e.count} مرّة · آخر تحديث {new Date(e.updatedAt).toLocaleDateString("ar")}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => remove(e.id)}
                          aria-label="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <SheetFooter className="px-5 py-4 border-t border-border flex flex-col sm:flex-row gap-2 sm:gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={importJson} className="gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>استيراد</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportJson}
              disabled={list.length === 0}
              className="gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={list.length === 0}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>مسح الكل</span>
            </Button>
          </div>
          <Button type="button" size="sm" onClick={() => onOpenChange(false)} className="font-display font-bold">
            إغلاق
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default TMPanel;
