import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EntryInput {
  key: string;
  original: string;
  translation: string;
  maxBytes?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entries, glossary } = await req.json() as {
      entries: EntryInput[];
      glossary?: string;
    };

    if (!entries?.length) {
      return new Response(JSON.stringify({ improvements: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const glossaryContext = glossary ? `\nمصطلحات القاموس:\n${glossary}` : '';

    const entriesText = entries.map((e, i) =>
      `[${i}] Key: ${e.key}\nEN: ${e.original}\nAR: ${e.translation}${e.maxBytes ? `\nMax: ${e.maxBytes} bytes` : ''}`
    ).join('\n\n');

    const systemPrompt = `أنت مراجع جودة ترجمة ألعاب فيديو متخصص. حلّل الترجمات التالية وحدد فقط النصوص التي تحتاج تحسيناً فعلاً.

معايير الكشف:
1. أخطاء نحوية أو إملائية واضحة (severity: high)
2. ترجمة حرفية غير طبيعية (severity: medium)
3. مصطلحات غير متسقة مع القاموس (severity: high)
4. صياغة ركيكة يمكن تحسينها (severity: low)
5. فقدان المعنى أو السياق (severity: high)
6. ترجمة قصيرة جداً لا تعكس المعنى (severity: medium)

قواعد مهمة:
- لا تقترح تحسينات إذا كانت الترجمة جيدة بالفعل
- لا تغيّر الرموز التقنية [Tags] والمتغيرات
- التزم بمصطلحات القاموس${glossaryContext}`;

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
          { role: "user", content: `حلّل الترجمات التالية واقترح تحسينات للنصوص الضعيفة فقط:\n\n${entriesText}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_improvements",
            description: "Return improvement suggestions for weak translations only",
            parameters: {
              type: "object",
              properties: {
                improvements: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      key: { type: "string" },
                      original: { type: "string" },
                      current: { type: "string" },
                      improved: { type: "string" },
                      reason: { type: "string" },
                      severity: { type: "string", enum: ["low", "medium", "high"] },
                    },
                    required: ["key", "original", "current", "improved", "reason", "severity"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["improvements"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_improvements" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، حاول لاحقاً" }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "نقاط غير كافية، أضف رصيداً" }), {
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
      return new Response(JSON.stringify({ improvements: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error("smart-improve error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير متوقع" }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
