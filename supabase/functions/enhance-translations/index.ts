import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EnhanceEntry {
  key: string;
  original: string;
  translation: string;
  fileName?: string;
  tableName?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entries, mode, glossary, aiModel } = await req.json() as {
      entries: EnhanceEntry[];
      mode?: 'enhance' | 'grammar';
      glossary?: string;
      aiModel?: string;
    };

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const gatewayModelMap: Record<string, string> = {
      'gemini-3-flash-preview': 'google/gemini-3-flash-preview',
      'gemini-3-pro-preview': 'google/gemini-3-pro-preview',
      'gemini-2.5-flash': 'google/gemini-2.5-flash',
      'gemini-2.5-flash-lite': 'google/gemini-2.5-flash-lite',
      'gemini-2.5-pro': 'google/gemini-2.5-pro',
      'gemini-2.0-flash': 'google/gemini-2.0-flash',
      'gpt-5': 'openai/gpt-5',
      'gpt-5-mini': 'openai/gpt-5-mini',
      'gpt-5-nano': 'openai/gpt-5-nano',
    };
    const resolvedModel = (aiModel && gatewayModelMap[aiModel]) || 'google/gemini-2.5-flash';

    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ suggestions: [], issues: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Grammar check mode
    if (mode === 'grammar') {
      const grammarPrompt = `أنت مدقق ترجمة عربية لألعاب الفيديو. ركّز فقط على الأخطاء الجوهرية التالية:

1. **حروف ناقصة أو زائدة في الكلمات** (مثل "المعركه" ↔ "المعركة"، "أستخدم" ↔ "استخدم")
2. **كلمات ملتصقة** بدون مسافة بينها
3. **ترتيب كلمات خاطئ** يجعل الجملة غير مفهومة أو ركيكة
4. **ترجمة حرفية ضعيفة** ينبغي إعادة صياغتها لتكون طبيعية بالعربية
5. **عدم تطابق مع ترجمات أخرى** لنفس المصطلح في القاموس
6. **مسافات مكررة أو ناقصة** بين الكلمات

🚫 **لا تقترح تعديلات على**:
- الهمزات (إ/أ/ا) إلا لو كانت تكسر معنى الكلمة
- التنوين والحركات
- الأسماء الأعلام (Link, Zelda, Hyrule…) — اترك كما هي بأي شكل كانت (إنجليزي أو معرّب)
- الأسلوب التفضيلي البحت

⚠️ مهم جداً: لا تكسر الوسوم التقنية [Color:Red] [Icon:*] ولا رموز PUA (\\uE000-\\uE0FF).

لكل خطأ، حدد مستوى الخطورة:
- high: خطأ يغير المعنى أو يجعل النص غير مفهوم
- medium: خطأ إملائي أو نحوي واضح
- low: تحسين بسيط في الترقيم أو التنسيق

النصوص:
${entries.map((e, i) => `[${i}] الأصل: ${e.original}\nالترجمة: ${e.translation}`).join('\n\n')}

أجب بـ JSON فقط:
{
  "issues": [
    {
      "index": 0,
      "issue": "وصف مختصر جداً للخطأ (3-7 كلمات)",
      "detail": "شرح أطول يوضح لماذا هو خطأ وأي قاعدة لغوية خالفها",
      "suggestion": "النص المصحح كاملاً",
      "severity": "high|medium|low"
    }
  ]
}

أعِد فقط النصوص التي بها أخطاء فعلية. لا تقترح تحسينات أسلوبية هنا.
حقل detail إلزامي ويجب أن يشرح لماذا هذا خطأ بوضوح (سطر أو سطرين).`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages: [
            { role: 'system', content: 'أنت مدقق لغوي عربي. أجب بـ JSON صالح فقط. لا تقترح تعديلات أسلوبية — فقط أخطاء موضوعية.' },
            { role: 'user', content: grammarPrompt }
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Grammar check error:', response.status, errText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'تم تجاوز حد الطلبات' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'الرصيد غير كافٍ' }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw new Error(`AI error: ${response.status}`);
      }

      const aiResult = await response.json();
      const content = aiResult.choices?.[0]?.message?.content || '';
      let parsed: { issues: any[] } = { issues: [] };
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
        const raw = (jsonMatch[1] || content).trim();
        const objMatch = raw.match(/\{[\s\S]*\}/);
        if (objMatch) {
          parsed = JSON.parse(objMatch[0]);
        } else {
          console.error('No JSON object found in AI response:', content.slice(0, 500));
        }
      } catch (e) {
        console.error('JSON parse error:', e, 'Content:', content.slice(0, 500));
      }

      const mappedIssues = (parsed.issues || []).map((i: any) => ({
        key: entries[i.index]?.key || '',
        original: entries[i.index]?.original || '',
        translation: entries[i.index]?.translation || '',
        issue: i.issue,
        detail: i.detail || '',
        suggestion: i.suggestion,
        severity: i.severity || 'medium',
      })).filter((i: any) => i.key && i.suggestion);

      return new Response(JSON.stringify({ issues: mappedIssues }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enhanced style/quality check mode
    const enhancePrompt = `أنت مراجع ترجمة عربية لألعاب الفيديو. ركّز على الأخطاء الجوهرية فقط واقترح إصلاحاً.

**أنواع المشاكل المسموح بها فقط:**
1. **missing_char** — حرف ناقص أو زائد ("المعركه"↔"المعركة")
2. **accuracy** — ترجمة حرفية تحرف المعنى أو تجعله ركيكاً
3. **style** — جملة بترتيب كلمات سيئ أو غير مفهومة بحاجة إعادة صياغة
4. **consistency** — نفس المصطلح مترجم بشكلين مختلفين بين الجمل
5. **terminology** — مصطلح من القاموس مترجم بشكل خاطئ

🚫 **لا تقترح أبداً**:
- تصحيح همزات (إ/أ/ا) إلا لو غيّرت المعنى
- إضافة تنوين/حركات
- تغيير الأسماء الأعلام إلى الإنجليزية أو العكس — اتركها كما هي
- تعديلات تفضيلية في الأسلوب لو الجملة مفهومة

⚠️ **قواعد صارمة:**
- لا تكسر الوسوم التقنية [Color:Red] [Icon:*] ولا رموز PUA (\\uE000-\\uE0FF)
- لا تُعِد النص نفسه

${glossary ? `**القاموس المعتمد (التزم بهذه المصطلحات):**\n${glossary.slice(0, 3000)}` : ''}

**النصوص للمراجعة:**
${entries.map((e, i) => `[${i}] الأصل: ${e.original}\nالترجمة: ${e.translation}`).join('\n\n')}

أجب بـ JSON فقط:
{
  "suggestions": [
    {
      "index": 0,
      "suggested": "النص المحسن كاملاً (الخيار الأفضل)",
      "alternatives": ["بديل ثاني", "بديل ثالث"],
      "reason": "وصف مختصر للمشكلة (3-7 كلمات)",
      "detail": "شرح أطول يوضح لماذا هذه مشكلة وأي قاعدة خالفتها الترجمة الحالية",
      "type": "missing_char|grammar|terminology|accuracy|style|consistency|punctuation"
    }
  ]
}

**مهم:**
- أعِد فقط الترجمات التي بها مشاكل حقيقية
- لا تقترح تعديلات تفضيلية بحتة
- ركز على الأخطاء الموضوعية والحروف الناقصة أولاً
- إذا كان النص صحيحاً لا تُعِده
- حقل detail إلزامي يشرح لماذا هذه مشكلة (سطر أو سطرين)`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [
          { role: 'system', content: 'أنت مترجم ومراجع محترف لألعاب نينتندو، خاصة سلسلة Zelda. أجب بـ JSON صالح فقط. ركز على الأخطاء الحقيقية لا الأسلوبية.' },
          { role: 'user', content: enhancePrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Enhance error:', response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'تم تجاوز حد الطلبات' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'الرصيد غير كافٍ' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '';
    let parsed: { suggestions: any[] } = { suggestions: [] };
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const raw = (jsonMatch[1] || content).trim();
      const objMatch = raw.match(/\{[\s\S]*\}/);
      if (objMatch) {
        parsed = JSON.parse(objMatch[0]);
      } else {
        console.error('No JSON object found in enhance response:', content.slice(0, 500));
      }
    } catch (e) {
      console.error('JSON parse error (enhance):', e, 'Content:', content.slice(0, 500));
    }

    const mappedSuggestions = (parsed.suggestions || []).map((s: any) => ({
      key: entries[s.index]?.key || '',
      original: entries[s.index]?.original || '',
      current: entries[s.index]?.translation || '',
      suggested: s.suggested,
      alternatives: Array.isArray(s.alternatives) ? s.alternatives.filter((a: unknown) => typeof a === 'string' && a.trim()) : [],
      reason: s.reason,
      detail: s.detail || '',
      type: s.type || 'style',
    })).filter((s: any) => s.key && s.suggested);

    return new Response(JSON.stringify({ suggestions: mappedSuggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Enhancement error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'خطأ غير متوقع',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
