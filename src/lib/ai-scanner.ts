// AI-assisted scanner for the Quality Lab. Wraps the existing
// `enhance-translations` Supabase edge function with a Quality-Lab-shaped
// API: takes (entries, options) and returns LocalIssue records, ready to
// merge into a UnifiedScanReport.
//
// Two modes:
//   - mode="grammar": ask AI to flag grammar/punctuation/structural issues
//   - mode="enhance": ask AI to suggest stylistic improvements
//
// Hybrid coverage:
//   - filterMode="missing-only": only send entries that have NO local issues.
//     Saves ~70-90% of API calls because the local scanner already catches
//     the obvious problems.
//   - filterMode="all": send every entry (more thorough, costlier).

import { supabase } from "@/integrations/supabase/client";
import type { LocalIssue, IssueSeverity, IssueType } from "@/lib/local-enhance-scanner";

export interface AIScanEntry {
  key: string;
  original: string;
  translation: string;
}

export type AIScanMode = "grammar" | "enhance";
export type AIFilterMode = "missing-only" | "all";

export interface AIScanOptions {
  mode: AIScanMode;
  model: string;
  filterMode: AIFilterMode;
  /** keys with at least one local issue — used for filterMode="missing-only" */
  keysWithLocalIssues?: Set<string>;
  glossary?: string;
  /** entries per request; defaults to 10 */
  batchSize?: number;
  /** parallel batches; defaults to 3 */
  parallel?: number;
}

export interface AIScanProgress {
  current: number;
  total: number;
  totalIssuesSoFar: number;
}

export interface AIScanResult {
  issues: LocalIssue[];
  totalSent: number;
  errors: number;
  cancelled: boolean;
}

interface RawAIIssue {
  key: string;
  original: string;
  translation?: string;
  current?: string;
  suggested?: string;
  suggestion?: string;
  reason?: string;
  detail?: string;
  issue?: string;
  severity?: IssueSeverity;
  type?: IssueType | "style";
}

const DEFAULT_BATCH = 10;
const DEFAULT_PARALLEL = 3;

function severity(s: IssueSeverity | undefined): IssueSeverity {
  return s === "high" || s === "medium" || s === "low" ? s : "medium";
}

function aiTypeToIssueType(t: string | undefined): IssueType {
  switch (t) {
    case "grammar":
    case "punctuation":
    case "missing_char":
    case "consistency":
    case "accuracy":
    case "terminology":
      return t;
    case "style":
      return "style" as IssueType;
    default:
      return "style" as IssueType;
  }
}

function normaliseGrammarIssue(raw: RawAIIssue): LocalIssue | null {
  if (!raw?.key || !raw?.original) return null;
  const translation = raw.translation ?? raw.current ?? "";
  const suggestion = raw.suggestion ?? raw.suggested ?? translation;
  return {
    key: raw.key,
    original: raw.original,
    translation,
    suggestion,
    issue: raw.issue ?? raw.reason ?? "ملاحظة من النموذج",
    reason:
      raw.detail ??
      raw.reason ??
      "النموذج رصد هذه المشكلة. راجعها قبل التطبيق لأنّها قد لا تكون قطعية.",
    severity: severity(raw.severity),
    type: aiTypeToIssueType(raw.type ?? "grammar"),
    rule: "ai_grammar",
  };
}

function normaliseEnhanceSuggestion(raw: RawAIIssue): LocalIssue | null {
  if (!raw?.key || !raw?.original) return null;
  const current = raw.current ?? raw.translation ?? "";
  const suggested = raw.suggested ?? raw.suggestion ?? current;
  if (!suggested || suggested === current) return null;
  return {
    key: raw.key,
    original: raw.original,
    translation: current,
    suggestion: suggested,
    issue: raw.reason ?? "اقتراح تحسين أسلوبي",
    reason:
      raw.detail ??
      raw.reason ??
      "النموذج اقترح صياغة أوضح أو أقرب للسياق. هذه اقتراحات أسلوبية لا أخطاء.",
    severity: "low",
    type: aiTypeToIssueType(raw.type ?? "style"),
    rule: "ai_enhance",
  };
}

function pickEntries(entries: AIScanEntry[], opts: AIScanOptions): AIScanEntry[] {
  if (opts.filterMode === "all" || !opts.keysWithLocalIssues) return entries;
  return entries.filter((e) => !opts.keysWithLocalIssues!.has(e.key));
}

interface RunHandle {
  promise: Promise<AIScanResult>;
  cancel: () => void;
}

export function runAIScan(
  entries: AIScanEntry[],
  options: AIScanOptions,
  onProgress?: (p: AIScanProgress) => void,
): RunHandle {
  const batchSize = options.batchSize ?? DEFAULT_BATCH;
  const parallel = options.parallel ?? DEFAULT_PARALLEL;

  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };

  const promise = (async (): Promise<AIScanResult> => {
    const target = pickEntries(entries, options);
    const totalSent = target.length;
    if (totalSent === 0) {
      return { issues: [], totalSent: 0, errors: 0, cancelled: false };
    }

    const batches: AIScanEntry[][] = [];
    for (let i = 0; i < target.length; i += batchSize) {
      batches.push(target.slice(i, i + batchSize));
    }

    let processed = 0;
    let errors = 0;
    const allIssues: LocalIssue[] = [];

    for (let i = 0; i < batches.length; i += parallel) {
      if (cancelled) break;
      const chunk = batches.slice(i, i + parallel);

      const results = await Promise.all(
        chunk.map(async (batch) => {
          try {
            const { data, error } = await supabase.functions.invoke("enhance-translations", {
              body: {
                entries: batch.map((e) => ({
                  key: e.key,
                  original: e.original,
                  translation: e.translation,
                })),
                mode: options.mode,
                glossary: options.glossary?.slice(0, 5000),
                aiModel: options.model,
              },
            });
            if (error) {
              errors++;
              return [] as LocalIssue[];
            }
            const out: LocalIssue[] = [];
            const rawIssues: RawAIIssue[] = options.mode === "grammar"
              ? (data?.issues ?? [])
              : (data?.suggestions ?? []);
            for (const r of rawIssues) {
              const norm = options.mode === "grammar"
                ? normaliseGrammarIssue(r)
                : normaliseEnhanceSuggestion(r);
              if (norm) out.push(norm);
            }
            return out;
          } catch {
            errors++;
            return [] as LocalIssue[];
          }
        }),
      );

      for (let j = 0; j < results.length; j++) {
        allIssues.push(...results[j]);
        processed += chunk[j].length;
      }

      onProgress?.({
        current: Math.min(processed, totalSent),
        total: totalSent,
        totalIssuesSoFar: allIssues.length,
      });
    }

    return { issues: allIssues, totalSent, errors, cancelled };
  })();

  return { promise, cancel };
}

export const AI_MODELS: Array<{ value: string; label: string; group: "google" | "openai" }> = [
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview (سريع — مُوصى)", group: "google" },
  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview (دقة عالية)", group: "google" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (متوازن)", group: "google" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (الأخف)", group: "google" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (دقة عالية، أبطأ)", group: "google" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (الجيل السابق)", group: "google" },
  { value: "gpt-5", label: "GPT-5 (دقة قصوى)", group: "openai" },
  { value: "gpt-5-mini", label: "GPT-5 mini (متوازن — أرخص)", group: "openai" },
  { value: "gpt-5-nano", label: "GPT-5 nano (الأسرع — الأرخص)", group: "openai" },
];
