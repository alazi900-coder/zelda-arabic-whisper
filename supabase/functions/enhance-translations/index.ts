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
  speaker?: string;
}

const gatewayModelMap: Record<string, string> = {
  'gemini-2.5-flash': 'google/gemini-2.5-flash',
  'gemini-2.5-pro': 'google/gemini-2.5-pro',
  'gemini-3-flash-preview': 'google/gemini-3-flash-preview',
  'gpt-5': 'openai/gpt-5',
};

function extractJson(content: string): any {
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fence?.[1] || content).trim();
  const obj = raw.match(/\{[\s\S]*\}/);
  if (!obj) return {};
  try { return JSON.parse(obj[0]); } catch { return {}; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entries, mode = 'enhance', glossary, aiModel } = await req.json() as {
      entries: EnhanceEntry[];
      mode?: 'enhance' | 'grammar';
      glossary?: string;
      aiModel?: string;
    };

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resolvedModel = (aiModel && gatewayModelMap[aiModel]) || 'google/gemini-2.5-flash';

    const isGrammar = mode === 'grammar';

    const enhancePrompt = isGrammar
      ? `أنت مدقق لغوي عربي متخصص في ترجمات ألعاب الفيديو (سلسلة The Legend of Zelda).
ابحث في كل ترجمة عن:
1. أخطاء إملائية (همزات، تاء مربوطة/مفتوحة، ألف مقصورة)
2. أخطاء نحوية (مذكر/مؤنث، رفع/نصب)
3. حروف ناقصة أو زائدة
4. علامات ترقيم خاطئة
5. مسافات مزدوجة

النصوص:
${entries.map((e, i) => `[${i}] EN: ${e.original}\nAR: ${e.translation}`).join('\n\n')}

أجب بـ JSON فقط بهذا الشكل:
{
  "results": [
    {
      "index": 0,
      "context": { "sceneType": "dialogue|combat|emotional|system|tutorial|unknown", "tone": "formal|casual|dramatic|neutral", "character": "Link/Zelda/..." },
      "issues": [{ "type": "literal|awkward|inconsistent|context_mismatch|style", "message": "وصف موجز", "severity": "high|medium|low" }],
      "suggestions": [{ "text": "النص المصحح", "reason": "سبب الاقتراح", "style": "literary|natural|concise|dramatic" }],
      "preferredSuggestion": "أفضل اقتراح"
    }
  ]
}
أعد فقط النصوص التي بها مشاكل فعلية.`
      : `أنت مترجم محترف ومراجع لغوي لسلسلة The Legend of Zelda. حافظ على المصطلحات المعتمدة (Link, Zelda, Hyrule, Master Sword, Triforce, Ganon...).

${glossary ? `**القاموس المعتمد:**\n${glossary.slice(0, 3000)}\n` : ''}

لكل نص: حلل السياق (نوع المشهد، الشخصية، النبرة) واكتشف المشاكل واقترح 2-4 بدائل بأنماط مختلفة (أدبي/طبيعي/مختصر/درامي).

أنواع المشاكل:
- literal: ترجمة حرفية جداً
- awkward: صياغة ركيكة عربياً
- context_mismatch: لا تناسب نوع المشهد
- style: تحسين أسلوبي
- inconsistent: عدم اتساق مع القاموس

النصوص:
${entries.map((e, i) => `[${i}]${e.speaker ? ` (المتحدث: ${e.speaker})` : ''} EN: ${e.original}\nAR: ${e.translation}`).join('\n\n')}

⚠️ مهم جداً:
- لا تكسر الوسوم التقنية مثل [Color:Red] [Icon:Heart] أزرار A/B/X/Y/L/R/ZL/ZR
- حافظ على رموز PUA (\\uE000-\\uE0FF) كما هي
- أبقِ الأسماء الأعلام بالإنجليزية
- لا تقترح إعادة النص نفسه

أجب بـ JSON فقط بهذا الشكل:
{
  "results": [
    {
      "index": 0,
      "context": { "sceneType": "dialogue|combat|emotional|system|tutorial|unknown", "tone": "formal|casual|dramatic|neutral", "character": "اسم الشخصية أو null" },
      "issues": [{ "type": "literal|awkward|inconsistent|context_mismatch|style", "message": "وصف موجز", "severity": "high|medium|low" }],
      "suggestions": [{ "text": "البديل المقترح", "reason": "لماذا هذا أفضل", "style": "literary|natural|concise|dramatic" }],
      "preferredSuggestion": "أفضل بديل"
    }
  ]
}
أعد فقط النصوص التي بها فرص تحسين حقيقية.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [
          { role: 'system', content: 'أنت مترجم ومراجع محترف لألعاب نينتندو، خاصة سلسلة Zelda. أجب بـ JSON صالح فقط.' },
          { role: 'user', content: enhancePrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Enhance error:', response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'تم تجاوز حد الطلبات. حاول بعد قليل.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'الرصيد غير كافٍ. أضف رصيدًا في إعدادات Lovable Cloud.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);
    const rawResults: any[] = parsed.results || [];

    const mapped = rawResults
      .map((r) => {
        const entry = entries[r.index];
        if (!entry) return null;
        return {
          key: entry.key,
          original: entry.original,
          currentTranslation: entry.translation,
          context: {
            sceneType: r.context?.sceneType || 'unknown',
            tone: r.context?.tone || 'neutral',
            character: r.context?.character || undefined,
          },
          issues: Array.isArray(r.issues) ? r.issues.filter((i: any) => i?.message) : [],
          suggestions: Array.isArray(r.suggestions)
            ? r.suggestions.filter((s: any) => s?.text && s.text !== entry.translation)
            : [],
          preferredSuggestion: r.preferredSuggestion && r.preferredSuggestion !== entry.translation
            ? r.preferredSuggestion : undefined,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && (r.issues.length > 0 || r.suggestions.length > 0 || !!r.preferredSuggestion));

    return new Response(JSON.stringify({ results: mapped }), {
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
