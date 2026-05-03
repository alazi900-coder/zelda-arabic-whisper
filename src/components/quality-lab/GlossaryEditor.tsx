import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Download, Upload, RefreshCw } from "lucide-react";
import {
  loadCustomDicts,
  saveCustomDicts,
  clearCustomDicts,
  EMPTY_DICTS,
  dictsTotalCount,
  type CustomDicts,
  type Pair,
  type ProperNounEntry,
} from "@/lib/glossary-store";

interface GlossaryEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (dicts: CustomDicts) => void;
}

const PAIR_TABS = [
  { key: "hamza", label: "همزة", left: "خاطئ", right: "صحيح", placeholder: ["هاذا", "هذا"] },
  { key: "taMarbutah", label: "تاء مربوطة", left: "خاطئ", right: "صحيح", placeholder: ["نهايه", "نهاية"] },
  { key: "gaming", label: "مصطلحات", left: "إنجليزي", right: "عربي", placeholder: ["dungeon", "سرداب"] },
] as const;

type PairTabKey = (typeof PAIR_TABS)[number]["key"];

const PairList = ({
  pairs,
  onChange,
  leftPlaceholder,
  rightPlaceholder,
  leftLabel,
  rightLabel,
}: {
  pairs: Pair[];
  onChange: (next: Pair[]) => void;
  leftPlaceholder: string;
  rightPlaceholder: string;
  leftLabel: string;
  rightLabel: string;
}) => {
  const [draftLeft, setDraftLeft] = useState("");
  const [draftRight, setDraftRight] = useState("");

  const add = () => {
    const l = draftLeft.trim();
    const r = draftRight.trim();
    if (!l || !r) return;
    if (pairs.some(([w]) => w === l)) {
      toast.warning("هذه القاعدة موجودة مسبقاً");
      return;
    }
    onChange([...pairs, [l, r] as Pair]);
    setDraftLeft("");
    setDraftRight("");
  };

  const remove = (i: number) => {
    onChange(pairs.filter((_, idx) => idx !== i));
  };

  const updateAt = (i: number, side: 0 | 1, value: string) => {
    const next = pairs.slice();
    const pair = next[i];
    next[i] = (side === 0 ? [value, pair[1]] : [pair[0], value]) as Pair;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-muted/30 border border-border p-3 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Label className="text-xs mb-1 block">{leftLabel}</Label>
            <Input
              value={draftLeft}
              onChange={(e) => setDraftLeft(e.target.value)}
              placeholder={leftPlaceholder}
              className="text-sm"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs mb-1 block">{rightLabel}</Label>
            <Input
              value={draftRight}
              onChange={(e) => setDraftRight(e.target.value)}
              placeholder={rightPlaceholder}
              className="text-sm"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              size="sm"
              onClick={add}
              disabled={!draftLeft.trim() || !draftRight.trim()}
              className="gap-1 w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة</span>
            </Button>
          </div>
        </div>
      </div>

      {pairs.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          لا توجد قواعد بعد. أضف قاعدة جديدة من الأعلى.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
          {pairs.map(([w, r], i) => (
            <div
              key={`${w}__${i}`}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5"
            >
              <Input
                value={w}
                onChange={(e) => updateAt(i, 0, e.target.value)}
                className="text-xs flex-1"
              />
              <span className="text-muted-foreground text-xs">→</span>
              <Input
                value={r}
                onChange={(e) => updateAt(i, 1, e.target.value)}
                className="text-xs flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(i)}
                className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ProperNounsList = ({
  list,
  onChange,
}: {
  list: ProperNounEntry[];
  onChange: (next: ProperNounEntry[]) => void;
}) => {
  const [draftEn, setDraftEn] = useState("");
  const [draftAr, setDraftAr] = useState("");

  const add = () => {
    const en = draftEn.trim();
    const ar = draftAr.trim();
    if (!en || !ar) return;
    if (list.some((p) => p.en.toLowerCase() === en.toLowerCase())) {
      toast.warning("هذا الاسم موجود مسبقاً");
      return;
    }
    onChange([
      ...list,
      { en, ar: ar.split("،").map((s) => s.trim()).filter(Boolean), category: "other" },
    ]);
    setDraftEn("");
    setDraftAr("");
  };

  const remove = (i: number) => onChange(list.filter((_, idx) => idx !== i));

  const updateAr = (i: number, value: string) => {
    const next = list.slice();
    next[i] = { ...next[i], ar: value.split("،").map((s) => s.trim()).filter(Boolean) };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-muted/30 border border-border p-3 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Label className="text-xs mb-1 block">الاسم بالإنجليزية</Label>
            <Input
              value={draftEn}
              onChange={(e) => setDraftEn(e.target.value)}
              placeholder="Bokoblin"
              className="text-sm"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs mb-1 block">صيغ عربية مقبولة (افصلها بفاصلة عربية «،»)</Label>
            <Input
              value={draftAr}
              onChange={(e) => setDraftAr(e.target.value)}
              placeholder="بوكوبلين، بوكوبيلين"
              className="text-sm"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              size="sm"
              onClick={add}
              disabled={!draftEn.trim() || !draftAr.trim()}
              className="gap-1 w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة</span>
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          الفحص يعدّ الاسم «ضائعاً» فقط إذا لم يظهر في الترجمة بأيّ من الصيغ العربية المقبولة ولا بصيغته الإنجليزية الأصلية.
        </p>
      </div>

      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          لا أسماء أعلام مخصّصة بعد.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
          {list.map((pn, i) => (
            <div
              key={`${pn.en}__${i}`}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5"
            >
              <span className="text-xs font-mono shrink-0 max-w-[30%] truncate" title={pn.en}>
                {pn.en}
              </span>
              <span className="text-muted-foreground text-xs">→</span>
              <Input
                value={pn.ar.join("، ")}
                onChange={(e) => updateAr(i, e.target.value)}
                className="text-xs flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(i)}
                className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const GlossaryEditor = ({ open, onOpenChange, onSaved }: GlossaryEditorProps) => {
  const [dicts, setDicts] = useState<CustomDicts>(EMPTY_DICTS);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState<PairTabKey | "properNouns">("hamza");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void loadCustomDicts().then((d) => {
      if (cancelled) return;
      setDicts(d);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const update = <K extends keyof CustomDicts>(key: K, value: CustomDicts[K]) => {
    setDicts((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    await saveCustomDicts(dicts);
    onSaved?.(dicts);
    toast.success("حُفظ القاموس المخصّص");
    onOpenChange(false);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(dicts, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quality-lab-glossary-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير القاموس");
  };

  const importJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const next: CustomDicts = {
            hamza: Array.isArray(parsed.hamza) ? parsed.hamza : [],
            taMarbutah: Array.isArray(parsed.taMarbutah) ? parsed.taMarbutah : [],
            gaming: Array.isArray(parsed.gaming) ? parsed.gaming : [],
            properNouns: Array.isArray(parsed.properNouns) ? parsed.properNouns : [],
          };
          setDicts(next);
          toast.success(`استُورد ${dictsTotalCount(next)} قاعدة`);
        } catch {
          toast.error("ملف JSON غير صالح");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const clearAll = async () => {
    if (!confirm("سيُمسح كل قاموسك المخصّص. متابعة؟")) return;
    await clearCustomDicts();
    setDicts(EMPTY_DICTS);
    onSaved?.(EMPTY_DICTS);
    toast.success("مُسح القاموس");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl flex flex-col gap-0 p-0 overflow-hidden"
      >
        <SheetHeader className="px-5 py-4 border-b border-border text-right">
          <SheetTitle className="font-display">إدارة القاموس المخصّص</SheetTitle>
          <SheetDescription className="text-xs leading-relaxed">
            القواعد التي تضيفها هنا تُفحص بعد القواميس المضمّنة. تُحفظ محلياً في متصفّحك (IndexedDB) ولا تُرسَل لأيّ خادم.
          </SheetDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="secondary" className="text-xs">
              المجموع: {dictsTotalCount(dicts)} قاعدة
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!loaded ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              جارٍ التحميل…
            </div>
          ) : (
            <Tabs
              value={active}
              onValueChange={(v) => setActive(v as PairTabKey | "properNouns")}
              className="w-full"
            >
              <TabsList className="grid grid-cols-4 w-full mb-4">
                {PAIR_TABS.map((t) => (
                  <TabsTrigger key={t.key} value={t.key} className="text-xs">
                    {t.label}
                    {dicts[t.key].length > 0 && (
                      <span className="mr-1 text-[10px] opacity-70">
                        ({dicts[t.key].length})
                      </span>
                    )}
                  </TabsTrigger>
                ))}
                <TabsTrigger value="properNouns" className="text-xs">
                  أعلام
                  {dicts.properNouns.length > 0 && (
                    <span className="mr-1 text-[10px] opacity-70">
                      ({dicts.properNouns.length})
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {PAIR_TABS.map((t) => (
                <TabsContent key={t.key} value={t.key} className="mt-0">
                  <PairList
                    pairs={dicts[t.key]}
                    onChange={(next) => update(t.key, next)}
                    leftLabel={t.left}
                    rightLabel={t.right}
                    leftPlaceholder={t.placeholder[0]}
                    rightPlaceholder={t.placeholder[1]}
                  />
                </TabsContent>
              ))}

              <TabsContent value="properNouns" className="mt-0">
                <ProperNounsList
                  list={dicts.properNouns}
                  onChange={(next) => update("properNouns", next)}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>

        <SheetFooter className="px-5 py-4 border-t border-border flex flex-col sm:flex-row gap-2 sm:gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={importJson}
              className="gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>استيراد</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportJson}
              disabled={dictsTotalCount(dicts) === 0}
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
              disabled={dictsTotalCount(dicts) === 0}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>مسح الكل</span>
            </Button>
          </div>
          <Button type="button" size="sm" onClick={save} className="font-display font-bold">
            حفظ وإغلاق
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default GlossaryEditor;
