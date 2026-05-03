import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Google round-trip translation pass.
//
// For each (originalEnglish, currentArabic) pair, calls Google Cloud
// Translation v2 to translate the Arabic text BACK to English, then
// computes a similarity score against the original English. A low
// similarity is a strong signal that the meaning of the translation
// drifted (semantic accuracy issue).
//
// The Google API key must be supplied per-request (the user enters it
// once in the Quality Lab UI; it is held in browser localStorage and
// passed in the request body). The key is NEVER stored on the server.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RoundTripEntry {
  key: string;
  originalEnglish: string;
  arabic: string;
}

interface RoundTripRequest {
  entries: RoundTripEntry[];
  apiKey: string;
  threshold?: number; // default 0.55 — below this we flag
}

interface RoundTripIssue {
  key: string;
  originalEnglish: string;
  arabic: string;
  backTranslation: string;
  similarity: number;
  severity: "high" | "medium" | "low";
}

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

const bigrams = (tokens: string[]): Set<string> => {
  const out = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    out.add(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
};

// Sørensen–Dice similarity over the union of unigrams and bigrams.
const dice = (a: string, b: string): number => {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const setA = new Set<string>([...ta, ...bigrams(ta)]);
  const setB = new Set<string>([...tb, ...bigrams(tb)]);
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter++;
  return (2 * inter) / (setA.size + setB.size);
};

const severityFromScore = (score: number, threshold: number): "high" | "medium" | "low" => {
  if (score < threshold * 0.55) return "high";
  if (score < threshold) return "medium";
  return "low";
};

async function translateBatch(
  texts: string[],
  apiKey: string,
): Promise<string[]> {
  if (texts.length === 0) return [];
  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
  const body = {
    q: texts,
    source: "ar",
    target: "en",
    format: "text",
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const translations = (json?.data?.translations ?? []) as Array<{ translatedText: string }>;
  return translations.map((t) => t.translatedText ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entries, apiKey, threshold = 0.55 } = (await req.json()) as RoundTripRequest;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Google API key is required (apiKey in request body)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return new Response(JSON.stringify({ issues: [], processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Google Translate v2 accepts up to 128 strings per request and 5K chars
    // total. Cap conservatively at 50.
    const BATCH = 50;
    const issues: RoundTripIssue[] = [];

    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const arabicTexts = batch.map((e) => e.arabic);
      let backs: string[];
      try {
        backs = await translateBatch(arabicTexts, apiKey);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(
          JSON.stringify({ error: msg, issues, processed: i }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      for (let j = 0; j < batch.length; j++) {
        const e = batch[j];
        const back = backs[j] ?? "";
        const score = dice(e.originalEnglish, back);
        if (score < threshold) {
          issues.push({
            key: e.key,
            originalEnglish: e.originalEnglish,
            arabic: e.arabic,
            backTranslation: back,
            similarity: score,
            severity: severityFromScore(score, threshold),
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ issues, processed: entries.length, threshold }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
