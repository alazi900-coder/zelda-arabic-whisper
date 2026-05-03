// Frontend client for the google-roundtrip edge function.
// The user supplies their own Google Cloud Translation v2 API key; it is
// stored in localStorage on this device only and POSTed with each request.
// We do not store it on the server.

import { supabase } from "@/integrations/supabase/client";
import type { LocalIssue } from "@/lib/local-enhance-scanner";

const STORAGE_KEY = "quality-lab.google.api-key";

export interface RoundTripEntry {
  key: string;
  originalEnglish: string;
  arabic: string;
}

export interface RoundTripResultIssue {
  key: string;
  originalEnglish: string;
  arabic: string;
  backTranslation: string;
  similarity: number;
  severity: "high" | "medium" | "low";
}

export interface RoundTripResponse {
  issues: RoundTripResultIssue[];
  processed: number;
  threshold: number;
  errors: number;
  cancelled: boolean;
}

export interface RoundTripProgress {
  current: number;
  total: number;
  flaggedSoFar: number;
}

export function loadGoogleApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveGoogleApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore (private mode, quota, etc.)
  }
}

export function clearGoogleApiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

interface RunHandle {
  promise: Promise<RoundTripResponse>;
  cancel: () => void;
}

export function runGoogleRoundTrip(
  entries: RoundTripEntry[],
  options: {
    apiKey: string;
    threshold?: number;
    batchSize?: number;
    parallel?: number;
  },
  onProgress?: (p: RoundTripProgress) => void,
): RunHandle {
  const batchSize = options.batchSize ?? 25;
  const parallel = options.parallel ?? 2;

  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };

  const promise = (async (): Promise<RoundTripResponse> => {
    if (entries.length === 0) {
      return { issues: [], processed: 0, threshold: options.threshold ?? 0.55, errors: 0, cancelled: false };
    }

    const batches: RoundTripEntry[][] = [];
    for (let i = 0; i < entries.length; i += batchSize) {
      batches.push(entries.slice(i, i + batchSize));
    }

    const allIssues: RoundTripResultIssue[] = [];
    let processed = 0;
    let errors = 0;
    let lastThreshold = options.threshold ?? 0.55;

    for (let i = 0; i < batches.length; i += parallel) {
      if (cancelled) break;
      const chunk = batches.slice(i, i + parallel);

      const results = await Promise.all(
        chunk.map(async (batch) => {
          try {
            const { data, error } = await supabase.functions.invoke("google-roundtrip", {
              body: {
                entries: batch,
                apiKey: options.apiKey,
                threshold: options.threshold ?? 0.55,
              },
            });
            if (error) {
              errors++;
              return { issues: [] as RoundTripResultIssue[], count: batch.length };
            }
            if (data?.error) {
              errors++;
              return { issues: [] as RoundTripResultIssue[], count: batch.length };
            }
            if (typeof data?.threshold === "number") lastThreshold = data.threshold;
            return {
              issues: (data?.issues ?? []) as RoundTripResultIssue[],
              count: batch.length,
            };
          } catch {
            errors++;
            return { issues: [] as RoundTripResultIssue[], count: batch.length };
          }
        }),
      );

      for (const r of results) {
        allIssues.push(...r.issues);
        processed += r.count;
      }

      onProgress?.({
        current: processed,
        total: entries.length,
        flaggedSoFar: allIssues.length,
      });
    }

    return {
      issues: allIssues,
      processed,
      threshold: lastThreshold,
      errors,
      cancelled,
    };
  })();

  return { promise, cancel };
}

/**
 * Convert RoundTrip-shape issues into the unified LocalIssue shape used
 * by the Quality Lab report.
 */
export function roundTripIssuesToLocal(rt: RoundTripResultIssue[]): LocalIssue[] {
  return rt.map((it) => {
    const pct = Math.round(it.similarity * 100);
    return {
      key: it.key,
      original: it.originalEnglish,
      translation: it.arabic,
      suggestion: it.arabic, // we don't auto-fix from a back-translation
      issue: `تباين دلالي مع الأصل (${pct}%)`,
      reason:
        `أعدنا ترجمة الترجمة العربية إلى الإنجليزية عبر Google، فحصلنا على:\n«${it.backTranslation}»\n` +
        `تشابهها مع الأصل ${pct}% فقط (نستخدم Sørensen–Dice على الكلمات والثنائيات). ` +
        `هذا مؤشّر قويّ على انحراف المعنى. راجع الترجمة يدوياً.`,
      severity: it.severity,
      type: "accuracy",
      rule: "google_low_similarity",
    };
  });
}
