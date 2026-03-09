import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PolishEntry {
  key: string;
  original: string;
  translation: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entries, glossary } = await req.json() as {
      entries: PolishEntry[];
      glossary?: string;
    };

    if (!entries?.length) {
      return new Response(JSON.stringify({ error: 'No entries provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const glossaryContext = glossary
      ? `\n\nمصطلحات القاموس (يجب الالتزام بها):\n${glossary}`
      : '';

    const entriesText = entries.map((e, i) =>
      `[${i}] EN: ${e.original}\nAR: ${e.translation}`
    ).join('\n\n');

    const systemPrompt = `أنت مدقق لغوي عربي متخصص في ترجمات ألعاب الفيديو (زيلدا). مهمتك:
1. تصحيح الأخطاء النحوية والإملائية
2. تحسين سلاسة وطبيعية النص العربي
3. ضمان اتساق المصطلحات مع القاموس
4. الحفاظ على جميع الرموز التقنية [Tags] والمتغيرات كما هي
5. عدم تغيير المعنى الأصلي

أجب بصيغة JSON فقط. لكل نص، أعد الترجمة المحسنة وسبب التغيير.
إذا كان النص سليماً ولا يحتاج تحسين، أعده كما هو مع سبب "سليم".${glossaryContext}`;

    const userPrompt = `حسّن الترجمات التالية:\n\n${entriesText}\n\nأجب بـ JSON array بالشكل:
[{"index": 0, "improved": "النص المحسن", "reason": "سبب التغيير", "changed": true/false}]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_polished",
            description: "Return polished Arabic translations",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      index: { type: "number" },
                      improved: { type: "string" },
                      reason: { type: "string" },
                      changed: { type: "boolean" },
                    },
                    required: ["index", "improved", "reason", "changed"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["results"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_polished" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، حاول لاحقاً" }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "نقاط غير كافية، أضف رصيداً لحسابك" }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "خطأ في خدمة الذكاء الاصطناعي" }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "لم يتم الحصول على نتائج" }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const results = parsed.results.map((r: any, i: number) => ({
      key: entries[r.index ?? i]?.key,
      original: entries[r.index ?? i]?.original,
      current: entries[r.index ?? i]?.translation,
      improved: r.improved,
      reason: r.reason,
      changed: r.changed,
    })).filter((r: any) => r.key);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error("polish error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير متوقع" }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
