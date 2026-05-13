// =============================================================================
// لوحة فحص وتحسين تقسيم الأسطر (تبويب داخل FixTagsLineBreaksDialog).
// محرّك محلّي ذكي + خيار تحسين بـ AI (Gemini مباشر / Lovable Gateway / Google Translate).
// متوافقة مع الهاتف: تمرير لمسي سلس، أزرار كبيرة، RTL.
// =============================================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, Wand2, Check, X, Pencil, Loader2, RefreshCw, FileText,
  ArrowLeftCircle, Zap, AlertTriangle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  scanLineSplitQuality,
  type LineSplitIssue,
  type LineSplitEntryRef,
  CAUSE_LABEL_AR,
  proposeBetterSplit,
} from "@/lib/line-split-quality";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  entries: LineSplitEntryRef[];
  translations: Record<string, string>;
  onUpdateTranslation: (key: string, value: string) => void;
  onJumpToEntry?: (key: string) => void;
}

type Engine =
  | "local"
  | "gemini-direct"
  | "lovable-gemini-3-flash-preview"
  | "lovable-gemini-3.1-pro-preview"
  | "lovable-gemini-2.5-pro"
  | "lovable-gemini-2.5-flash"
  | "lovable-gpt-5-mini"
  | "google-translate";

const ENGINE_OPTIONS: { value: Engine; label: string; needsKey?: "gemini" | "google" }[] = [
  { value: "local", label: "محلّي ذكي (فوري — افتراضي)" },
  { value: "gemini-direct", label: "Google Gemini API (مفتاحك)", needsKey: "gemini" },
  { value: "lovable-gemini-3-flash-preview", label: "Lovable AI · Gemini 3 Flash" },
  { value: "lovable-gemini-3.1-pro-preview", label: "Lovable AI · Gemini 3.1 Pro" },
  { value: "lovable-gemini-2.5-pro", label: "Lovable AI · Gemini 2.5 Pro" },
  { value: "lovable-gemini-2.5-flash", label: "Lovable AI · Gemini 2.5 Flash" },
  { value: "lovable-gpt-5-mini", label: "Lovable AI · GPT-5 Mini" },
  { value: "google-translate", label: "Google Translate (round-trip)", needsKey: "google" },
];

function engineToBackend(eng: Engine): { engine: string; model?: string } {
  if (eng === "local") return { engine: "local" };
  if (eng === "gemini-direct") return { engine: "gemini-direct" };
  if (eng === "google-translate") return { engine: "google-translate" };
  const model = eng.replace("lovable-", "");
  return { engine: "lovable", model: `google/${model}`.replace("google/gpt", "openai/gpt") };
}

const renderInvisible = (text: string): React.ReactNode => {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let buf = "";
  const flush = (k: string) => { if (buf) { parts.push(<span key={k}>{buf}</span>); buf = ""; } };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const code = c.charCodeAt(0);
    if ((code >= 0xfff9 && code <= 0xfffc) || (code >= 0xe000 && code <= 0xe0ff)) {
      flush(`p${i}`);
      parts.push(
        <span key={`tag-${i}`} className="inline-flex items-center bg-amber-300 text-amber-950 dark:bg-amber-500/80 dark:text-amber-50 rounded px-1 mx-0.5 text-[10px] font-mono">
          ⟨{code.toString(16).toUpperCase().padStart(4, "0")}⟩
        </span>,
      );
    } else if (c === "\n") {
      flush(`p${i}`);
      parts.push(<span key={`nl${i}`} className="text-sky-500 mx-0.5 font-bold">↵</span>);
      parts.push(<br key={`br${i}`} />);
    } else { buf += c; }
  }
  flush("end");
  return parts;
};

export const LineSplitFixPanel: React.FC<Props> = ({
  entries, translations, onUpdateTranslation, onJumpToEntry,
}) => {
  const [issues, setIssues] = useState<LineSplitIssue[]>([]);
  const [scanned, setScanned] = useState(0);
  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [engine, setEngine] = useState<Engine>("local");
  const [geminiKey, setGeminiKey] = useState<string>(() => localStorage.getItem("gemini_api_key") || "");
  const [googleKey, setGoogleKey] = useState<string>(() => localStorage.getItem("google_translate_api_key") || "");
  const [busy, setBusy] = useState<string | null>(null); // key قيد المعالجة بـ AI، أو "all"
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  const editRef = useRef<HTMLTextAreaElement | null>(null);

  const runScan = () => {
    const res = scanLineSplitQuality(entries, translations);
    setIssues(res.issues);
    setScanned(res.scanned);
    setResolvedKeys(new Set());
    setEditingKey(null);
    setPage(0);
  };

  useEffect(() => { runScan(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const visibleIssues = useMemo(
    () => issues.filter(i => !resolvedKeys.has(i.key)),
    [issues, resolvedKeys],
  );

  const totalPages = Math.ceil(visibleIssues.length / PAGE_SIZE);
  const pageIssues = useMemo(
    () => visibleIssues.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [visibleIssues, page, PAGE_SIZE],
  );

  const apply = (key: string, value: string) => {
    if (!value || value === translations[key]) return;
    onUpdateTranslation(key, value);
    setResolvedKeys(prev => { const n = new Set(prev); n.add(key); return n; });
    setEditingKey(null);
  };

  const callAi = async (items: LineSplitIssue[]): Promise<Record<string, string>> => {
    const backend = engineToBackend(engine);
    if (engine === "gemini-direct" && !geminiKey.trim()) {
      throw new Error("أدخل مفتاح Google Gemini أوّلاً.");
    }
    if (engine === "google-translate" && !googleKey.trim()) {
      throw new Error("أدخل مفتاح Google Cloud Translation أوّلاً.");
    }
    if (engine === "gemini-direct") localStorage.setItem("gemini_api_key", geminiKey);
    if (engine === "google-translate") localStorage.setItem("google_translate_api_key", googleKey);

    const payload = {
      ...backend,
      apiKey: engine === "gemini-direct" ? geminiKey : engine === "google-translate" ? googleKey : undefined,
      entries: items.map(it => ({ key: it.key, originalEn: it.original, currentAr: it.current })),
    };
    const { data, error } = await supabase.functions.invoke("improve-line-splits", { body: payload });
    if (error) {
      const msg = (error as Error).message || "فشل الاتصال بمحرك AI";
      if (msg.includes("402")) throw new Error("نفدت الحصة المجانية لـ AI — يرجى إضافة رصيد.");
      if (msg.includes("429")) throw new Error("الكثير من الطلبات بسرعة — انتظر لحظات وأعد المحاولة.");
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return (data?.results || {}) as Record<string, string>;
  };

  const improveOneAi = async (issue: LineSplitIssue) => {
    setBusy(issue.key);
    try {
      const out = await callAi([issue]);
      const next = out[issue.key];
      if (!next) throw new Error("لم يُرجع المحرّك أيّ تقسيم.");
      apply(issue.key, next);
      toast({ title: "✅ تمّ التحسين بـ AI" });
    } catch (e) {
      toast({ title: "❌ خطأ AI", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const improveAllAi = async () => {
    if (visibleIssues.length === 0) return;
    if (!window.confirm(`تحسين ${visibleIssues.length} عنصر بـ AI؟ قد يستغرق وقتاً.`)) return;
    setBusy("all");
    try {
      // دفعات من 15
      const BATCH = 15;
      let done = 0;
      for (let i = 0; i < visibleIssues.length; i += BATCH) {
        const slice = visibleIssues.slice(i, i + BATCH);
        const out = await callAi(slice);
        for (const item of slice) {
          const next = out[item.key];
          if (next) apply(item.key, next);
        }
        done += slice.length;
        toast({ title: `🌐 ${done}/${visibleIssues.length}` });
      }
    } catch (e) {
      toast({ title: "❌ خطأ AI", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const applyAllLocal = () => {
    if (visibleIssues.length === 0) return;
    if (!window.confirm(`تطبيق التقسيم المحلّي على ${visibleIssues.length} عنصر؟ لا يمكن التراجع.`)) return;
    let n = 0;
    for (const it of visibleIssues) {
      if (it.proposed && it.proposed !== it.current) { apply(it.key, it.proposed); n++; }
    }
    toast({ title: `✅ تمّ تطبيق ${n} تقسيم محلّي` });
  };

  const startEdit = (it: LineSplitIssue) => {
    setEditingKey(it.key);
    setEditValue(it.proposed || it.current);
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const selectedEngineOpt = ENGINE_OPTIONS.find(o => o.value === engine)!;
  const isAiEngine = engine !== "local";

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2" dir="rtl">
      {/* شريط الأدوات */}
      <div className="rounded-md border bg-muted/30 p-2 space-y-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] font-medium text-muted-foreground">المحرّك:</label>
          <select
            value={engine}
            onChange={e => setEngine(e.target.value as Engine)}
            className="text-xs sm:text-sm bg-background border rounded px-2 py-1.5 min-w-0 flex-1 sm:flex-none"
          >
            {ENGINE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <Button
            size="sm" variant="outline" onClick={runScan}
            className="h-8 gap-1 text-xs shrink-0"
          >
            <RefreshCw className="h-3 w-3" /> إعادة فحص
          </Button>
        </div>

        {selectedEngineOpt.needsKey === "gemini" && (
          <input
            type="password"
            value={geminiKey}
            onChange={e => setGeminiKey(e.target.value)}
            placeholder="مفتاح Google Gemini API"
            className="w-full text-xs bg-background border rounded px-2 py-1.5"
          />
        )}
        {selectedEngineOpt.needsKey === "google" && (
          <input
            type="password"
            value={googleKey}
            onChange={e => setGoogleKey(e.target.value)}
            placeholder="مفتاح Google Cloud Translation API"
            className="w-full text-xs bg-background border rounded px-2 py-1.5"
          />
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm" onClick={applyAllLocal}
            disabled={visibleIssues.length === 0}
            className="h-10 gap-1 text-xs"
          >
            <Zap className="h-3 w-3" /> تطبيق المقترح المحلّي للكل ({visibleIssues.length})
          </Button>
          {isAiEngine && (
            <Button
              size="sm" variant="secondary" onClick={improveAllAi}
              disabled={visibleIssues.length === 0 || busy !== null}
              className="h-10 gap-1 text-xs"
            >
              {busy === "all" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              تحسين الكل بـ AI
            </Button>
          )}
        </div>
      </div>

      {/* إحصاءات */}
      <div className="grid grid-cols-3 gap-2 text-center shrink-0">
        <div className="rounded-md border bg-muted/40 p-2">
          <div className="text-[10px] text-muted-foreground">تمّ فحصها</div>
          <div className="text-lg font-bold tabular-nums">{scanned}</div>
        </div>
        <div className="rounded-md border bg-amber-100 dark:bg-amber-900/40 p-2">
          <div className="text-[10px] text-amber-800 dark:text-amber-200">تقسيم سيّئ</div>
          <div className="text-lg font-bold tabular-nums text-amber-800 dark:text-amber-100">{visibleIssues.length}</div>
        </div>
        <div className="rounded-md border bg-emerald-100 dark:bg-emerald-900/40 p-2">
          <div className="text-[10px] text-emerald-800 dark:text-emerald-200">تمّ إصلاحها</div>
          <div className="text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-100">{resolvedKeys.size}</div>
        </div>
      </div>

      {/* قائمة المشاكل */}
      {visibleIssues.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-8 text-center">
          <div className="space-y-2">
            <Sparkles className="h-8 w-8 mx-auto text-emerald-500" />
            <div className="text-base font-semibold">
              {scanned === 0 ? "لا توجد ترجمات للفحص" : "تقسيم الأسطر سليم"}
            </div>
            <div className="text-sm text-muted-foreground">
              {resolvedKeys.size > 0 && `أصلحت ${resolvedKeys.size} ترجمة في هذه الجلسة.`}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-0.5 [-webkit-overflow-scrolling:touch] touch-pan-y">
          <div className="space-y-2.5 pb-2">
            {pageIssues.map(it => (
              <div key={it.key} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                        درجة {it.diagnosis.score}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground truncate">
                        <FileText className="h-3 w-3 inline ml-1" />
                        {it.msbtFile} #{it.index}
                      </span>
                      {it.label && (
                        <span className="text-xs text-foreground/80 truncate" title={it.label}>{it.label}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {it.diagnosis.causes.map(c => (
                        <Badge key={c} variant="outline"
                          className="text-[10px] border-amber-500/60 text-amber-800 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-200">
                          <AlertTriangle className="h-2.5 w-2.5 ml-0.5" />
                          {CAUSE_LABEL_AR[c]}
                        </Badge>
                      ))}
                    </div>
                    {it.diagnosis.reasons.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {it.diagnosis.reasons.map((r, i) => (
                          <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                            <span className="mt-0.5 shrink-0">•</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {onJumpToEntry && (
                    <Button size="sm" variant="ghost" className="h-10 w-10 p-0 shrink-0"
                      onClick={() => onJumpToEntry(it.key)} title="انتقال">
                      <ArrowLeftCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="rounded border border-border/60 bg-muted/40 p-2">
                  <div className="text-[10px] text-muted-foreground mb-1">الأصل (إنجليزي)</div>
                  <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words" dir="ltr">
                    {renderInvisible(it.original)}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="rounded border border-rose-500/50 bg-rose-50 dark:bg-rose-950/40 p-2">
                    <div className="text-[10px] font-semibold text-rose-700 dark:text-rose-200 mb-1">قبل (الحالي)</div>
                    <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words text-rose-900 dark:text-rose-100">
                      {renderInvisible(it.current)}
                    </div>
                  </div>
                  <div className="rounded border border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/40 p-2">
                    <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-200 mb-1">بعد (مقترح محلّي)</div>
                    <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words text-emerald-900 dark:text-emerald-100">
                      {renderInvisible(it.proposed)}
                    </div>
                  </div>
                </div>

                {editingKey === it.key && (
                  <div className="rounded-md border border-primary/40 bg-primary/5 p-2 space-y-2">
                    <Textarea
                      ref={editRef}
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      rows={Math.max(3, Math.min(10, editValue.split("\n").length + 1))}
                      dir="rtl"
                      className="text-sm leading-relaxed bg-background"
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)} className="h-9 gap-1">
                        <X className="h-3 w-3" /> إلغاء
                      </Button>
                      <Button size="sm" onClick={() => apply(it.key, editValue)} className="h-9 gap-1">
                        <Check className="h-3 w-3" /> حفظ
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 justify-end">
                  <Button
                    size="sm" variant="outline" className="h-9 gap-1 text-xs"
                    onClick={() => apply(it.key, proposeBetterSplit(it.original, it.current))}
                    disabled={editingKey === it.key}
                  >
                    <Zap className="h-3 w-3" /> تطبيق المحلّي
                  </Button>
                  <Button
                    size="sm" variant="outline" className="h-9 gap-1 text-xs"
                    onClick={() => startEdit(it)} disabled={editingKey === it.key}
                  >
                    <Pencil className="h-3 w-3" /> تعديل يدويّ
                  </Button>
                  {isAiEngine && (
                    <Button
                      size="sm" className="h-9 gap-1 text-xs"
                      onClick={() => improveOneAi(it)}
                      disabled={busy !== null}
                    >
                      {busy === it.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                      تحسين بـ AI
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {totalPages > 1 && (
          <div className="shrink-0 flex items-center justify-center gap-3 py-3 border-t border-border">
            <Button size="sm" variant="outline" className="h-9 px-4 text-xs"
              onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              السابق
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button size="sm" variant="outline" className="h-9 px-4 text-xs"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>
              التالي
            </Button>
          </div>
        )}
        </div>
      )}
    </div>
  );
};

export default LineSplitFixPanel;
