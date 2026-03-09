import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ContextEntry {
  original: string;
  translation?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { target, context, glossary, file } = await req.json() as {
      target: { original: string; translation?: string };
      context: ContextEntry[];
      glossary?: string;
      file?: string;
    };

    if (!target?.original) {
      return new Response(JSON.stringify({ error: 'No target entry provided' }), {
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
      ? `\n\nمصطلحات القاموس (التزم بها):\n${glossary}`
      : '';

    // Build scene context
    const sceneLines = context.map((e, i) => {
      const tr = e.translation ? `\nAR: ${e.translation}` : '';
      return `[${i}] EN: ${e.original}${tr}`;
    }).join('\n\n');

    const systemPrompt = `أنت مترجم ألعاب فيديو متخصص في سلسلة زيلدا. مهمتك تقديم 3 اقتراحات ترجمة عربية لنص محدد مع مراعاة السياق الكامل للمشهد.

قواعد:
1. راعِ سياق الحوار والمشهد الكامل عند الترجمة
2. التزم بمصطلحات القاموس إن وُجد
3. حافظ على جميع الرموز التقنية [Tags] والمتغيرات كما هي
4. قدّم 3 اقتراحات بأساليب مختلفة (رسمي، طبيعي، إبداعي)
5. اشرح سبب كل اقتراح بإيجاز
6. الملف: ${file || 'غير محدد'}${glossaryContext}`;

    const userPrompt = `سياق المشهد (النصوص المحيطة):
${sceneLines}

---
النص المطلوب ترجمته:
EN: ${target.original}
${target.translation ? `الترجمة الحالية: ${target.translation}` : '(غير مترجم بعد)'}

قدّم 3 اقتراحات ترجمة مختلفة مع شرح كل واحد.`;

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
            name: "return_suggestions",
            description: "Return context-aware translation suggestions",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      translation: { type: "string" },
                      style: { type: "string", enum: ["formal", "natural", "creative"] },
                      styleLabel: { type: "string" },
                      reason: { type: "string" },
                      confidence: { type: "number" },
                    },
                    required: ["translation", "style", "styleLabel", "reason", "confidence"],
                    additionalProperties: false,
                  },
                },
                contextNote: { type: "string" },
              },
              required: ["suggestions", "contextNote"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_suggestions" } },
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
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error("context-suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير متوقع" }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
