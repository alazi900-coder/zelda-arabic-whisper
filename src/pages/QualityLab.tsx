import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import QualityLabHero from "@/components/quality-lab/QualityLabHero";
import InputZone, { type ScanEntry } from "@/components/quality-lab/InputZone";
import StatsPanel from "@/components/quality-lab/StatsPanel";
import IssueCard from "@/components/quality-lab/IssueCard";
import FilterBar, {
  type SeverityFilter,
  type FixFilter,
} from "@/components/quality-lab/FilterBar";
import ActionsBar from "@/components/quality-lab/ActionsBar";
import GlossaryEditor from "@/components/quality-lab/GlossaryEditor";
import AIScanPanel from "@/components/quality-lab/AIScanPanel";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import {
  loadCustomDicts,
  EMPTY_DICTS,
  dictsTotalCount,
  type CustomDicts,
} from "@/lib/glossary-store";
import {
  scanUnified,
  type LocalIssue,
  type UnifiedScanReport,
} from "@/lib/quality-lab-scanner";

const PAGE_SIZE = 30;

// Rules whose suggestions are derived deterministically from a curated
// dictionary or trivial whitespace logic, so they're safe to apply in bulk
// without human review.
const SAFE_RULES = new Set<string>([
  "dict_hamza",
  "dict_ta_marbutah",
  "double_space",
  "leading_trailing",
  "space_before_punct",
  "missing_space_after_punct",
  "no_space_after_punct",
  "tab_chars",
  "repeated_word",
]);

const RULE_LABELS: Record<string, string> = {
  double_space: "مسافات مكرّرة",
  space_before_punct: "مسافة قبل ترقيم",
  missing_space_after_punct: "مسافة ناقصة بعد ترقيم",
  no_space_after_punct: "مسافة ناقصة بعد ترقيم",
  tab_chars: "محارف Tab",
  leading_trailing: "مسافات أطراف",
  repeated_word: "كلمة مكرّرة",
  repeated_char: "حرف مكرّر",
  glued_scripts: "نصوص ملتصقة",
  missing_tags: "وسوم ناقصة",
  damaged_pua: "رموز PUA تالفة",
  ph_mismatch: "محدّدات مختلفة",
  unclosed_brackets: "أقواس غير مغلقة",
  byte_over: "تجاوز البايتات",
  punct_parity: "ترقيم غير متطابق",
  missing_terminal_punct: "نقطة أخيرة مفقودة",
  untranslated: "غير مترجم",
  verbatim_copy: "نسخ حرفي",
  common_untranslated: "كلمات شائعة غير مترجمة",
  hamza_pattern: "همزة شائعة",
  has_diacritics: "تشكيل",
  consistency: "اتساق المصطلحات",
  dict_hamza: "همزة (قاموس)",
  dict_ta_marbutah: "تاء مربوطة (قاموس)",
  dict_gaming_term: "مصطلح ألعاب",
  dict_proper_noun: "اسم علم",
  digit_mismatch: "أرقام مختلفة",
  ai_grammar: "فحص بالنموذج",
  ai_enhance: "تحسين أسلوبي",
};

const QualityLab = () => {
  const inputRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const [entries, setEntries] = useState<ScanEntry[]>([]);
  const [report, setReport] = useState<UnifiedScanReport | null>(null);
  const [shown, setShown] = useState(PAGE_SIZE);

  const [customDicts, setCustomDicts] = useState<CustomDicts>(EMPTY_DICTS);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [rule, setRule] = useState<string>("all");
  const [fix, setFix] = useState<FixFilter>("all");

  useEffect(() => {
    const prev = document.title;
    document.title = "مختبر جودة الترجمة العربية — أداة تعريب زيلدا";
    return () => {
      document.title = prev;
    };
  }, []);

  useEffect(() => {
    void loadCustomDicts().then(setCustomDicts);
  }, []);

  const scrollDown = () => {
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const runScan = (loaded: ScanEntry[], dicts: CustomDicts = customDicts) => {
    setEntries(loaded);
    const next = scanUnified(loaded, dicts);
    setReport(next);
    setShown(PAGE_SIZE);
    setSearch("");
    setSeverity("all");
    setRule("all");
    setFix("all");
  };

  const onGlossarySaved = (next: CustomDicts) => {
    setCustomDicts(next);
    if (entries.length > 0) {
      runScan(entries, next);
    }
  };

  const onAIResults = (newIssues: LocalIssue[]) => {
    if (!report) return;
    if (newIssues.length === 0) return;
    const seen = new Set<string>(
      report.issues.map((it) => `${it.key}|${it.rule}|${it.issue}`),
    );
    const added: LocalIssue[] = [];
    for (const it of newIssues) {
      const sig = `${it.key}|${it.rule}|${it.issue}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      added.push(it);
    }
    if (added.length === 0) return;

    const merged = [...report.issues, ...added];
    const bySeverity = { high: 0, medium: 0, low: 0 } as Record<"high" | "medium" | "low", number>;
    const byRule: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const affected = new Set<string>();
    for (const it of merged) {
      bySeverity[it.severity] = (bySeverity[it.severity] ?? 0) + 1;
      byRule[it.rule] = (byRule[it.rule] ?? 0) + 1;
      byType[it.type] = (byType[it.type] ?? 0) + 1;
      affected.add(it.key);
    }
    setReport({
      issues: merged,
      bySeverity,
      byRule,
      byType,
      affectedEntries: affected.size,
      totalScanned: report.totalScanned,
      total: merged.length,
    });
  };

  const keysWithLocalIssues = useMemo(() => {
    if (!report) return new Set<string>();
    return new Set(report.issues.map((i) => i.key));
  }, [report]);

  const onLoaded = (loaded: ScanEntry[]) => {
    runScan(loaded);
    setTimeout(() => {
      reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const reset = () => {
    setEntries([]);
    setReport(null);
    setShown(PAGE_SIZE);
    setSearch("");
    setSeverity("all");
    setRule("all");
    setFix("all");
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const sortedIssues = useMemo<LocalIssue[]>(() => {
    if (!report) return [];
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...report.issues].sort((a, b) => order[a.severity] - order[b.severity]);
  }, [report]);

  const filteredIssues = useMemo<LocalIssue[]>(() => {
    if (sortedIssues.length === 0) return [];
    const q = search.trim().toLowerCase();
    return sortedIssues.filter((it) => {
      if (severity !== "all" && it.severity !== severity) return false;
      if (rule !== "all" && it.rule !== rule) return false;
      const fixable = it.suggestion && it.suggestion !== it.translation;
      if (fix === "fixable" && !fixable) return false;
      if (fix === "manual" && fixable) return false;
      if (q) {
        const hay = `${it.key} ${it.original} ${it.translation} ${it.issue} ${it.reason}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sortedIssues, search, severity, rule, fix]);

  const ruleOptions = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.byRule)
      .map(([r, count]) => ({
        value: r,
        label: RULE_LABELS[r] ?? r,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [report]);

  const safeFixCount = useMemo(
    () =>
      sortedIssues.filter(
        (it) => SAFE_RULES.has(it.rule) && it.suggestion && it.suggestion !== it.translation,
      ).length,
    [sortedIssues],
  );

  const visible = filteredIssues.slice(0, shown);
  const hasMore = filteredIssues.length > shown;

  const clearFilters = () => {
    setSearch("");
    setSeverity("all");
    setRule("all");
    setFix("all");
  };

  const applySafe = () => {
    if (!report || safeFixCount === 0) return;
    // For each entry, walk safe issues in order and chain their suggestions.
    // dict_hamza produces a fully-fixed translation; same for ta_marbutah.
    // Whitespace-rule suggestions are also full strings, so the LAST safe
    // issue per entry wins.
    const byKey = new Map<string, string>();
    const fixedKeys = new Set<string>();
    for (const it of sortedIssues) {
      if (!SAFE_RULES.has(it.rule)) continue;
      if (!it.suggestion || it.suggestion === it.translation) continue;
      // Use the latest suggestion for each key (the scanner sees rules in a
      // specific order; later ones already incorporate earlier whitespace
      // fixes if any. For dictionary rules the suggestion is independent.)
      byKey.set(it.key, it.suggestion);
      fixedKeys.add(it.key);
    }
    if (fixedKeys.size === 0) return;
    const updated = entries.map((e) =>
      byKey.has(e.key) ? { ...e, translation: byKey.get(e.key)! } : e,
    );
    runScan(updated);
    toast.success(`طُبّق ${safeFixCount} إصلاح على ${fixedKeys.size} إدخال`);
    setTimeout(() => {
      reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const downloadJson = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportIssues = () => {
    if (!report) return;
    downloadJson(`quality-report-${Date.now()}.json`, {
      generatedAt: new Date().toISOString(),
      totalScanned: report.totalScanned,
      total: report.total,
      affectedEntries: report.affectedEntries,
      bySeverity: report.bySeverity,
      byRule: report.byRule,
      issues: report.issues,
    });
    toast.success("تم تصدير التقرير");
  };

  const exportEntries = () => {
    if (entries.length === 0) return;
    downloadJson(`translations-${Date.now()}.json`, entries);
    toast.success("تم تصدير الترجمات");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <QualityLabHero onScrollDown={scrollDown} />

      <div ref={inputRef}>
        <InputZone onLoaded={onLoaded} />
      </div>

      <section className="px-4 max-w-6xl mx-auto w-full pb-2">
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setGlossaryOpen(true)}
            className="gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>القاموس المخصّص ({dictsTotalCount(customDicts)})</span>
          </Button>
        </div>
      </section>

      <GlossaryEditor
        open={glossaryOpen}
        onOpenChange={setGlossaryOpen}
        onSaved={onGlossarySaved}
      />

      {entries.length > 0 && report && (
        <AIScanPanel
          entries={entries}
          keysWithLocalIssues={keysWithLocalIssues}
          onResults={onAIResults}
        />
      )}

      {report && (
        <div ref={reportRef} className="pb-16">
          <StatsPanel report={report} onReset={reset} />

          <ActionsBar
            totalIssues={report.total}
            safeFixCount={safeFixCount}
            hasReport={true}
            onApplySafe={applySafe}
            onExportIssues={exportIssues}
            onExportEntries={exportEntries}
          />

          {sortedIssues.length > 0 && (
            <FilterBar
              total={sortedIssues.length}
              filtered={filteredIssues.length}
              search={search}
              onSearch={(s) => {
                setSearch(s);
                setShown(PAGE_SIZE);
              }}
              severity={severity}
              onSeverity={(s) => {
                setSeverity(s);
                setShown(PAGE_SIZE);
              }}
              rule={rule}
              onRule={(r) => {
                setRule(r);
                setShown(PAGE_SIZE);
              }}
              ruleOptions={ruleOptions}
              fix={fix}
              onFix={(f) => {
                setFix(f);
                setShown(PAGE_SIZE);
              }}
              onClearAll={() => {
                clearFilters();
                setShown(PAGE_SIZE);
              }}
            />
          )}

          <section className="px-4 max-w-6xl mx-auto w-full">
            {sortedIssues.length === 0 ? (
              <div className="rounded-2xl bg-card border border-emerald-500/30 p-10 text-center">
                <Badge
                  variant="outline"
                  className="mb-3 bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                >
                  ممتاز
                </Badge>
                <p className="text-sm text-muted-foreground">
                  لم يكتشف الفحص أيّ مشكلة ضمن القواعد المتاحة. الترجمات نظيفة بنيوياً.
                </p>
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="rounded-2xl bg-card border border-border p-10 text-center">
                <p className="text-sm text-muted-foreground">
                  لا توجد نتائج تطابق التصفية الحالية. جرّب تخفيف الشروط.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {visible.map((issue, i) => (
                    <IssueCard
                      key={`${issue.key}__${issue.rule}__${i}`}
                      issue={issue}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div className="flex justify-center mt-6">
                    <button
                      type="button"
                      onClick={() => setShown((v) => v + PAGE_SIZE)}
                      className="px-5 py-2.5 rounded-full border border-primary/40 bg-primary/10 hover:bg-primary/20 text-sm font-display font-bold transition-colors"
                    >
                      تحميل المزيد ({filteredIssues.length - shown} متبقّ)
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      <footer className="mt-auto py-6 text-center text-xs text-muted-foreground border-t border-border">
        مختبر جودة الترجمة — يعمل بالكامل داخل متصفّحك
      </footer>
    </div>
  );
};

export default QualityLab;
