import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReviewEntry {
  key: string;
  original: string;
  translation: string;
  maxBytes: number;
}

interface ReviewIssue {
  key: string;
  type: 'missing_tag' | 'too_long' | 'inconsistent' | 'untranslated_term' | 'placeholder_mismatch' | 'remaining_english';
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

function extractTags(text: string): string[] {
  const tags = text.match(/\[[^\]]*\]/g) || [];
  return tags;
}

function extractPlaceholders(text: string): string[] {
  const placeholders = text.match(/\uFFFC/g) || [];
  return placeholders;
}

function getUtf16ByteLength(text: string): number {
  // MSBT uses UTF-16LE encoding
  return text.length * 2;
}

/**
 * C3 fix: AI gateways sometimes return JSON with raw \n / \r inside string
 * values (technically invalid JSON, but common in practice). The previous
 * implementation replaced ALL control chars with a space, which destroyed
 * legitimate line breaks in NPC dialogue translations.
 *
 * This helper escapes \n and \r into JSON-valid \\n and \\r so JSON.parse
 * preserves them, then strips remaining control chars (which are noise).
 */
function sanitizeJsonText(raw: string): string {
  return raw
    .replace(/\r\n|\n|\r/g, m => m === '\r' ? '\\r' : '\\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' '); // eslint-disable-line no-control-regex
}

Deno.serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }

   try {
     const { entries, glossary, action, geminiModel, contextEntries } = await req.json() as {
       entries: ReviewEntry[];
       glossary?: string;
       action?: 'review' | 'suggest-short' | 'improve'
              | 'smart-review' | 'grammar-check' | 'context-review'
              | 'quick-alternatives' | 'auto-correct' | 'detect-weak'
              | 'context-retranslate';
       geminiModel?: 'gemini-2.5-flash-lite' | 'gemini-2.5-flash' | 'gemini-2.5-pro';
       contextEntries?: { key: string; original: string; translation: string }[];
     };

     // Resolve AI gateway model: prefer explicit geminiModel, fallback to 2.5-flash
     const resolvedModel = geminiModel
       ? `google/${geminiModel}`
       : 'google/gemini-2.5-flash';

     if (!entries || entries.length === 0) {
       return new Response(JSON.stringify({ issues: [] }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }

     // Helper: lazy-fetch Lovable key
     const getLovableKey = () => {
       const k = Deno.env.get('LOVABLE_API_KEY');
       if (!k) throw new Error('LOVABLE_API_KEY is not configured');
       return k;
     };

     // ==========================================================
     //   NEW ADVANCED REVIEW ACTIONS (ported from Xenoblade)
     //   Adapted for Zelda: keeps [Color:Red], [Icon:Heart], A/B/X/Y buttons
     //   Names: Link, Zelda, Ganon, Hyrule stay in English
     // ==========================================================

     // --- smart-review: مراجعة ذكية عميقة ---
     if (action === 'smart-review') {
       const LOVABLE_API_KEY = getLovableKey();
       const translated = entries.filter(e => e.translation?.trim());
       if (translated.length === 0) return new Response(JSON.stringify({ findings: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       const CHUNK = 15;
       type ReviewFinding = { key: string; original: string; current: string; type: string; issue: string; fix: string };
       const allFindings: ReviewFinding[] = [];
       for (let c = 0; c < translated.length; c += CHUNK) {
         const chunk = translated.slice(c, c + CHUNK);
         const prompt = `أنت مدقق لغوي متخصص في ترجمة ألعاب Zelda. حلّل كل ترجمة وأبلغ عن المشاكل الواضحة فقط:

⚠️ تعليمات حاسمة:
- أبلغ فقط عن المشاكل الواضحة والمؤكدة — لا تقترح تغييرات ذوقية
- غيّر فقط الجزء الذي فيه مشكلة، وأبقِ الباقي كما هو
- أبقِ جميع وسوم Zelda كما هي بدون تغيير: [Color:...], [Icon:...], [PageBreak], A/B/X/Y/L/R/ZL/ZR
- أبقِ أسماء Link, Zelda, Ganon, Hyrule بالإنجليزية
- إذا كان النص مقبولاً ومفهوماً، لا تضعه في النتائج

أنواع المشاكل:
1. literal — ترجمة حرفية جامدة
2. grammar — خطأ نحوي واضح
3. inconsistency — مصطلح مخالف للقاموس
4. naturalness — صياغة ركيكة واضحة

${glossary ? `\nالقاموس المعتمد:\n${glossary.slice(0, 3000)}\n` : ''}

النصوص:
${chunk.map((e, i) => `[${i}] EN: "${e.original}"\nAR: "${e.translation}"`).join('\n\n')}

أخرج JSON array فقط. كل عنصر:
{"i": رقم, "type": "literal"|"grammar"|"inconsistency"|"naturalness", "issue": "وصف المشكلة", "fix": "الترجمة المقترحة"}
أخرج [] إذا لم تجد مشاكل.`;
         const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
           method: 'POST',
           headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
           body: JSON.stringify({ model: resolvedModel, messages: [{ role: 'system', content: 'مدقق لغوي دقيق. أخرج ONLY valid JSON arrays.' }, { role: 'user', content: prompt }] }),
         });
         if (!response.ok) {
           if (response.status === 429) return new Response(JSON.stringify({ error: 'تم تجاوز حد الطلبات، حاول لاحقاً' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
           if (response.status === 402) return new Response(JSON.stringify({ error: 'يجب إضافة رصيد لاستخدام الذكاء الاصطناعي' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
           console.error('AI error:', await response.text()); continue;
         }
         const data = await response.json();
         const m = (data.choices?.[0]?.message?.content || '').match(/\[[\s\S]*\]/);
         if (!m) continue;
         try {
           type AIFinding = { i?: number; type?: string; issue?: string; fix?: string };
           const findings: AIFinding[] = JSON.parse(sanitizeJsonText(m[0]));
           for (const f of findings) {
             if (typeof f.i === 'number' && f.i >= 0 && f.i < chunk.length) {
               allFindings.push({ key: chunk[f.i].key, original: chunk[f.i].original, current: chunk[f.i].translation, type: f.type || 'naturalness', issue: f.issue || '', fix: f.fix || '' });
             }
           }
         } catch (e) { console.error('smart-review parse:', e); }
       }
       return new Response(JSON.stringify({ findings: allFindings }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     // --- grammar-check: فحص نحوي متخصّص ---
     if (action === 'grammar-check') {
       const LOVABLE_API_KEY = getLovableKey();
       const translated = entries.filter(e => e.translation?.trim());
       if (translated.length === 0) return new Response(JSON.stringify({ findings: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       const CHUNK = 15;
       type GrammarFinding = { key: string; original: string; current: string; type: string; issue: string; fix: string };
       const allFindings: GrammarFinding[] = [];
       for (let c = 0; c < translated.length; c += CHUNK) {
         const chunk = translated.slice(c, c + CHUNK);
         const prompt = `أنت مدقق نحوي وإملائي للعربية. أبلغ عن الأخطاء الواضحة فقط:

⚠️ تعليمات:
- فقط الأخطاء النحوية والإملائية المؤكدة — لا تغيّر الأسلوب
- أبقِ وسوم Zelda كما هي: [Color:...], [Icon:...], A/B/X/Y/L/R/ZL/ZR
- أبقِ أسماء Link, Zelda, Ganon, Hyrule بالإنجليزية
- الإصلاح يجب أن يغيّر أقل عدد ممكن من الكلمات

أنواع الأخطاء:
1. gender — تذكير/تأنيث  2. conjugation — تصريف
3. case — إعراب  4. spelling — إملاء (مثل "لاكن"→"لكن")
5. hamza — همزات  6. negation — نفي  7. preposition — حروف جر

${glossary ? `\nالقاموس:\n${glossary.slice(0, 2000)}\n` : ''}

النصوص:
${chunk.map((e, i) => `[${i}] EN: "${e.original}"\nAR: "${e.translation}"`).join('\n\n')}

أخرج JSON array فقط:
{"i": رقم, "type": نوع, "issue": "شرح الخطأ", "fix": "المصحّح"}
[] إذا لم تجد أخطاء.`;
         const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
           method: 'POST',
           headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
           body: JSON.stringify({ model: resolvedModel, messages: [{ role: 'system', content: 'مدقق نحوي/إملائي. أخرج ONLY JSON arrays.' }, { role: 'user', content: prompt }] }),
         });
         if (!response.ok) {
           if (response.status === 429) return new Response(JSON.stringify({ error: 'تم تجاوز حد الطلبات' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
           console.error('AI error:', await response.text()); continue;
         }
         const data = await response.json();
         const m = (data.choices?.[0]?.message?.content || '').match(/\[[\s\S]*\]/);
         if (!m) continue;
         try {
           type AIFinding = { i?: number; type?: string; issue?: string; fix?: string };
           const findings: AIFinding[] = JSON.parse(sanitizeJsonText(m[0]));
           for (const f of findings) {
             if (typeof f.i === 'number' && f.i >= 0 && f.i < chunk.length) {
               allFindings.push({ key: chunk[f.i].key, original: chunk[f.i].original, current: chunk[f.i].translation, type: f.type || 'spelling', issue: f.issue || '', fix: f.fix || '' });
             }
           }
         } catch (e) { console.error('grammar-check parse:', e); }
       }
       return new Response(JSON.stringify({ findings: allFindings }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     // --- context-review: مراجعة مع سياق المشاهد ---
     if (action === 'context-review') {
       const LOVABLE_API_KEY = getLovableKey();
       const translated = entries.filter(e => e.translation?.trim());
       if (translated.length === 0) return new Response(JSON.stringify({ findings: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       const CHUNK = 10;
       type ContextFinding = { key: string; original: string; current: string; type: string; issue: string; fix: string };
       const allFindings: ContextFinding[] = [];
       for (let c = 0; c < translated.length; c += CHUNK) {
         const chunk = translated.slice(c, c + CHUNK);
         const contextBlock = contextEntries && contextEntries.length > 0
           ? `\nسياق إضافي (نصوص مجاورة):\n${contextEntries.slice(0, 30).map(ce => `  "${ce.original}" → "${ce.translation}"`).join('\n')}\n` : '';
         const prompt = `أنت مراجع ترجمات Zelda متخصص في السياق. حلّل كل ترجمة في سياقها وحسّنها.

المشاكل:
1. context-mismatch — صحيحة لغوياً لا تناسب سياق المشهد
2. tone-mismatch — نبرة لا تناسب الشخصية (Zelda رسمية، Ganon شرير...)
3. ambiguity — غامضة قد تُفهم خطأ
4. continuity — عدم اتساق مع الجمل المجاورة
5. improvement — اقتراح تحسين صياغي

أبقِ وسوم Zelda كما هي: [Color:...], [Icon:...], A/B/X/Y/L/R/ZL/ZR.
أبقِ Link, Zelda, Ganon, Hyrule بالإنجليزية.

${glossary ? `\nالقاموس:\n${glossary.slice(0, 2000)}\n` : ''}${contextBlock}

النصوص:
${chunk.map((e, i) => `[${i}] EN: "${e.original}"\nAR: "${e.translation}"`).join('\n\n')}

أخرج JSON array فقط:
{"i": رقم, "type": نوع, "issue": "المشكلة", "fix": "الترجمة المحسّنة"}
[] إذا لا توجد مشاكل.`;
         const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
           method: 'POST',
           headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
           body: JSON.stringify({ model: resolvedModel, messages: [{ role: 'system', content: 'مراجع سياقي. أخرج ONLY JSON arrays.' }, { role: 'user', content: prompt }] }),
         });
         if (!response.ok) {
           if (response.status === 429) return new Response(JSON.stringify({ error: 'تم تجاوز حد الطلبات' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
           console.error('AI error:', await response.text()); continue;
         }
         const data = await response.json();
         const m = (data.choices?.[0]?.message?.content || '').match(/\[[\s\S]*\]/);
         if (!m) continue;
         try {
           type AIFinding = { i?: number; type?: string; issue?: string; fix?: string };
           const findings: AIFinding[] = JSON.parse(sanitizeJsonText(m[0]));
           for (const f of findings) {
             if (typeof f.i === 'number' && f.i >= 0 && f.i < chunk.length) {
               allFindings.push({ key: chunk[f.i].key, original: chunk[f.i].original, current: chunk[f.i].translation, type: f.type || 'improvement', issue: f.issue || '', fix: f.fix || '' });
             }
           }
         } catch (e) { console.error('context-review parse:', e); }
       }
       return new Response(JSON.stringify({ findings: allFindings }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     // --- quick-alternatives: 3 بدائل سريعة لأي نص ---
     if (action === 'quick-alternatives') {
       const LOVABLE_API_KEY = getLovableKey();
       const entry = entries[0];
       if (!entry?.translation?.trim()) return new Response(JSON.stringify({ alternatives: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       const contextBlock = contextEntries && contextEntries.length > 0
         ? `\nسياق:\n${contextEntries.slice(0, 10).map(ce => `  "${ce.original}" → "${ce.translation}"`).join('\n')}\n` : '';
       const prompt = `أنت مترجم Zelda محترف. أعطني 3 بدائل بأساليب متنوعة:

النص الأصلي: "${entry.original}"
الترجمة الحالية: "${entry.translation}"
${entry.maxBytes > 0 ? `الحد الأقصى: ${entry.maxBytes} بايت (كل حرف عربي = 2 بايت)` : ''}

أبقِ وسوم Zelda كما هي: [Color:...], [Icon:...], A/B/X/Y/L/R/ZL/ZR.
أبقِ Link, Zelda, Ganon, Hyrule بالإنجليزية.

${glossary ? `القاموس:\n${glossary.slice(0, 1500)}\n` : ''}${contextBlock}

قدم 3 بدائل:
1. 💬 طبيعي وسلس
2. ✂️ مختصر ومباشر
3. 📚 أدبي وغني

أخرج JSON array فقط بـ 3 عناصر:
{"style": "natural"|"concise"|"literary", "text": "البديل", "reason": "سبب قصير"}`;
       const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
         method: 'POST',
         headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({ model: resolvedModel, messages: [{ role: 'system', content: 'مترجم ألعاب. أخرج ONLY JSON arrays.' }, { role: 'user', content: prompt }] }),
       });
       if (!response.ok) {
         if (response.status === 429) return new Response(JSON.stringify({ error: 'تم تجاوز حد الطلبات' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         throw new Error(`AI error: ${response.status}`);
       }
       const data = await response.json();
       const m = (data.choices?.[0]?.message?.content || '').match(/\[[\s\S]*\]/);
       if (!m) throw new Error('Failed to parse AI response');
       const alternatives = JSON.parse(sanitizeJsonText(m[0]));
       return new Response(JSON.stringify({ alternatives }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     // --- auto-correct: تصحيح إملائي/نحوي جماعي ---
     if (action === 'auto-correct') {
       const LOVABLE_API_KEY = getLovableKey();
       const translated = entries.filter(e => e.translation?.trim());
       if (translated.length === 0) return new Response(JSON.stringify({ corrections: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       const CHUNK = 20;
       type Correction = { key: string; original: string; current: string; corrected: string };
       const allCorrections: Correction[] = [];
       for (let c = 0; c < translated.length; c += CHUNK) {
         const chunk = translated.slice(c, c + CHUNK);
         const prompt = `مصحح إملائي/نحوي آلي. صحّح كل ترجمة بدون تغيير المعنى أو الأسلوب.

قواعد:
- صحّح الأخطاء الإملائية/النحوية فقط، لا تغيّر الصياغة
- أبقِ الوسوم كما هي: [Color:...], [Icon:...], A/B/X/Y/L/R/ZL/ZR
- أبقِ Link, Zelda, Ganon, Hyrule بالإنجليزية
- إذا كان النص سليماً أعده نفسه بالضبط
- صحّح: همزات، تاء/هاء، ياء/ألف مقصورة، تذكير/تأنيث

${chunk.map((e, i) => `[${i}] "${e.translation}"`).join('\n')}

أخرج JSON array فقط بنفس الترتيب يحتوي النصوص المصححة.`;
         const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
           method: 'POST',
           headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
           body: JSON.stringify({ model: resolvedModel, messages: [{ role: 'system', content: 'مصحح إملائي. أخرج ONLY JSON arrays. لا تغيّر المعنى.' }, { role: 'user', content: prompt }] }),
         });
         if (!response.ok) {
           if (response.status === 429) return new Response(JSON.stringify({ error: 'تم تجاوز حد الطلبات' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
           console.error('AI error:', await response.text()); continue;
         }
         const data = await response.json();
         const m = (data.choices?.[0]?.message?.content || '').match(/\[[\s\S]*\]/);
         if (!m) continue;
         try {
           const corrected: string[] = JSON.parse(sanitizeJsonText(m[0]));
           for (let i = 0; i < Math.min(chunk.length, corrected.length); i++) {
             const e = chunk[i];
             const t = corrected[i]?.trim();
             if (t && t !== e.translation) {
               allCorrections.push({ key: e.key, original: e.original, current: e.translation, corrected: t });
             }
           }
         } catch (err) { console.error('auto-correct parse:', err); }
       }
       return new Response(JSON.stringify({ corrections: allCorrections }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     // --- detect-weak: كشف الترجمات الضعيفة ---
     if (action === 'detect-weak') {
       const LOVABLE_API_KEY = getLovableKey();
       const translated = entries.filter(e => e.translation?.trim());
       if (translated.length === 0) return new Response(JSON.stringify({ weakEntries: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       const CHUNK = 15;
       type WeakFinding = { key: string; original: string; current: string; score: number; reason: string; suggestion: string };
       const allWeak: WeakFinding[] = [];
       for (let c = 0; c < translated.length; c += CHUNK) {
         const chunk = translated.slice(c, c + CHUNK);
         const prompt = `مراجع جودة ترجمات Zelda. قيّم كل ترجمة (1-10):
- 1-3: ركيكة/سيئة  - 4-5: مقبولة تحتاج تحسين
- 6-7: جيدة مع ملاحظات  - 8-10: ممتازة (تجاهلها)

${glossary ? `القاموس:\n${glossary.slice(0, 1500)}\n` : ''}

${chunk.map((e, i) => `[${i}] EN: "${e.original}"\nAR: "${e.translation}"`).join('\n\n')}

أخرج JSON array فقط للترجمات بدرجة 7 أو أقل:
{"i": رقم, "score": درجة, "reason": "السبب", "suggestion": "ترجمة أفضل"}
[] إذا كانت كلها ممتازة.`;
         const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
           method: 'POST',
           headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
           body: JSON.stringify({ model: resolvedModel, messages: [{ role: 'system', content: 'مقيّم جودة. أخرج ONLY JSON arrays.' }, { role: 'user', content: prompt }] }),
         });
         if (!response.ok) {
           if (response.status === 429) return new Response(JSON.stringify({ error: 'تم تجاوز حد الطلبات' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
           console.error('AI error:', await response.text()); continue;
         }
         const data = await response.json();
         const m = (data.choices?.[0]?.message?.content || '').match(/\[[\s\S]*\]/);
         if (!m) continue;
         try {
           type WeakAIFinding = { i?: number; score?: number; reason?: string; suggestion?: string };
           const findings: WeakAIFinding[] = JSON.parse(sanitizeJsonText(m[0]));
           for (const f of findings) {
             if (typeof f.i === 'number' && f.i >= 0 && f.i < chunk.length) {
               allWeak.push({ key: chunk[f.i].key, original: chunk[f.i].original, current: chunk[f.i].translation, score: f.score || 5, reason: f.reason || '', suggestion: f.suggestion || '' });
             }
           }
         } catch (err) { console.error('detect-weak parse:', err); }
       }
       allWeak.sort((a, b) => a.score - b.score);
       return new Response(JSON.stringify({ weakEntries: allWeak }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     // --- context-retranslate: إعادة ترجمة مع سياق ---
     if (action === 'context-retranslate') {
       const LOVABLE_API_KEY = getLovableKey();
       const translated = entries.filter(e => e.translation?.trim());
       if (translated.length === 0) return new Response(JSON.stringify({ retranslations: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       const contextBlock = contextEntries && contextEntries.length > 0
         ? `\nسياق:\n${contextEntries.slice(0, 20).map(ce => `  EN: "${ce.original}" → AR: "${ce.translation}"`).join('\n')}\n` : '';
       const CHUNK = 10;
       type Retranslation = { key: string; original: string; current: string; retranslated: string; changes: string };
       const allRetrans: Retranslation[] = [];
       for (let c = 0; c < translated.length; c += CHUNK) {
         const chunk = translated.slice(c, c + CHUNK);
         const prompt = `مترجم Zelda محترف. أعد ترجمة النصوص مع مراعاة السياق.

${glossary ? `القاموس:\n${glossary.slice(0, 2000)}\n` : ''}${contextBlock}

قواعد:
- استخدم السياق لفهم المشهد/الشخصية
- قدّم ترجمة طبيعية تناسب Zelda
- أبقِ وسوم Zelda كما هي: [Color:...], [Icon:...], A/B/X/Y/L/R/ZL/ZR
- أبقِ Link, Zelda, Ganon, Hyrule بالإنجليزية

${chunk.map((e, i) => `[${i}] EN: "${e.original}"\nالترجمة الحالية: "${e.translation}"\n${e.maxBytes > 0 ? `الحد: ${e.maxBytes} بايت` : ''}`).join('\n\n')}

أخرج JSON array فقط بنفس الترتيب:
{"text": "الترجمة الجديدة", "changes": "ملخص التغييرات"}`;
         const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
           method: 'POST',
           headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
           body: JSON.stringify({ model: resolvedModel, messages: [{ role: 'system', content: 'مترجم ألعاب. أخرج ONLY JSON arrays.' }, { role: 'user', content: prompt }] }),
         });
         if (!response.ok) {
           if (response.status === 429) return new Response(JSON.stringify({ error: 'تم تجاوز حد الطلبات' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
           console.error('AI error:', await response.text()); continue;
         }
         const data = await response.json();
         const m = (data.choices?.[0]?.message?.content || '').match(/\[[\s\S]*\]/);
         if (!m) continue;
         try {
           type RetranslationResult = { text?: string; changes?: string };
           const results: RetranslationResult[] = JSON.parse(sanitizeJsonText(m[0]));
           for (let i = 0; i < Math.min(chunk.length, results.length); i++) {
             const e = chunk[i];
             const nt = results[i]?.text?.trim();
             if (nt && nt !== e.translation) {
               allRetrans.push({ key: e.key, original: e.original, current: e.translation, retranslated: nt, changes: results[i].changes || '' });
             }
           }
         } catch (err) { console.error('context-retranslate parse:', err); }
       }
       return new Response(JSON.stringify({ retranslations: allRetrans }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     // --- Handle "suggest short translations" action ---
     if (action === 'suggest-short') {
       const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
       if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

       const tooLongEntries = entries.filter(e => {
         const bytes = getUtf16ByteLength(e.translation);
         return bytes > e.maxBytes && e.maxBytes > 0;
       });

       if (tooLongEntries.length === 0) {
         return new Response(JSON.stringify({ suggestions: [] }), {
           headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         });
       }

        const prompt = `أنت مترجم ألعاب فيديو متخصص في الاختصار. مهمتك: اختصار كل ترجمة لتصبح أقل من الحد المسموح بالبايت.

قواعد صارمة:
- يجب أن تكون الترجمة المقترحة مختلفة وأقصر فعلياً من الحالية
- لا تُعِد نفس النص أبداً - استخدم مرادفات أقصر، احذف كلمات زائدة، أعد صياغة الجملة
- حافظ على جميع الوسوم [Tags] كما هي بدون تغيير
- حافظ على المعنى الأساسي
- كل حرف عربي = 2 بايت في UTF-16

${tooLongEntries.map((e, i) => {
          const currentBytes = getUtf16ByteLength(e.translation);
          const charsToRemove = Math.ceil((currentBytes - e.maxBytes) / 2);
          return `[${i}] الأصلي: "${e.original}"
الترجمة الحالية (${currentBytes} بايت): "${e.translation}"
الحد الأقصى: ${e.maxBytes} بايت — يجب حذف ${charsToRemove} حرف على الأقل`;
        }).join('\n\n')}

أخرج JSON array فقط بنفس الترتيب. مثال: ["ترجمة مختصرة 1", "ترجمة مختصرة 2"]`;

       const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${LOVABLE_API_KEY}`,
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           model: 'google/gemini-2.5-flash',
           messages: [
             { role: 'system', content: 'أنت متخصص في اختصار النصوص. اخرج ONLY JSON arrays.' },
             { role: 'user', content: prompt },
           ],
           temperature: 0.3,
         }),
       });

       if (!response.ok) {
         const err = await response.text();
         console.error('AI gateway error:', err);
         throw new Error(`AI error: ${response.status}`);
       }

       const data = await response.json();
       const content = data.choices?.[0]?.message?.content || '';
       const jsonMatch = content.match(/\[[\s\S]*\]/);
       if (!jsonMatch) throw new Error('Failed to parse AI response');

       const sanitized = sanitizeJsonText(jsonMatch[0]);
       const suggestions: string[] = JSON.parse(sanitized);

       const result = tooLongEntries.map((entry, i) => ({
         key: entry.key,
         original: entry.original,
         current: entry.translation,
         currentBytes: getUtf16ByteLength(entry.translation),
         maxBytes: entry.maxBytes,
         suggested: suggestions[i] || entry.translation,
         suggestedBytes: getUtf16ByteLength(suggestions[i] || entry.translation),
       }));

       return new Response(JSON.stringify({ suggestions: result }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }

      // --- Handle "improve translations" action ---
      if (action === 'improve') {
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

        const translatedEntries = entries.filter(e => e.translation?.trim());

        if (translatedEntries.length === 0) {
          return new Response(JSON.stringify({ improvements: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Process in chunks of 25
        const CHUNK_SIZE = 25;
        type Improvement = { key: string; original: string; current: string; currentBytes: number; maxBytes: number; improved: string; improvedBytes: number };
        const allImprovements: Improvement[] = [];

        for (let c = 0; c < translatedEntries.length; c += CHUNK_SIZE) {
          const chunk = translatedEntries.slice(c, c + CHUNK_SIZE);

          const prompt = `أنت مترجم ألعاب فيديو محترف متخصص في سلسلة زيلدا. مهمتك: إعادة صياغة وتحسين كل ترجمة عربية بشكل ملحوظ.

قواعد صارمة:
- يجب أن تقدم صياغة مختلفة وأفضل لكل نص — لا تُعِد نفس النص أبداً
- أعد صياغة الجملة بالكامل بأسلوب عربي طبيعي وسلس كأنها كُتبت بالعربية أصلاً
- صحّح أي أخطاء نحوية أو إملائية أو ركاكة في الأسلوب
- استخدم مفردات أغنى وأدق — تجنب الترجمة الحرفية
- استخدم مصطلحات مجتمع الألعاب العربي المعروفة (مثل: تريفورس، سيف الماستر، هايرول)
- حافظ على جميع الوسوم [Tags] و ￼ كما هي بدون أي تغيير
- حافظ على طول الترجمة قريباً من الأصل لتناسب صناديق النص في اللعبة
- الحد الأقصى بالبايت مذكور لكل نص — لا تتجاوزه (كل حرف عربي = 2 بايت)
- لا تترجم الأسماء العلم المعروفة (Link, Zelda, Ganon) إلا إذا كان لها مقابل عربي شائع
- حتى لو كانت الترجمة جيدة، قدّم بديلاً أفضل أو مختلفاً في الأسلوب

${glossary ? `\nالقاموس:\n${glossary}\n` : ''}

${chunk.map((e, i) => `[${i}] الأصلي: "${e.original}"
الترجمة الحالية: "${e.translation}"
الحد: ${e.maxBytes} بايت`).join('\n\n')}

أخرج JSON array فقط بنفس الترتيب يحتوي الترجمات المحسّنة. مثال: ["ترجمة محسنة 1", "ترجمة محسنة 2"]`;

          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: 'أنت محسّن ترجمات ألعاب. أخرج ONLY JSON arrays.' },
                { role: 'user', content: prompt },
              ],
              temperature: 0.4,
            }),
          });

          if (!response.ok) {
            const err = await response.text();
            console.error('AI gateway error:', err);
            throw new Error(`AI error: ${response.status}`);
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (!jsonMatch) throw new Error('Failed to parse AI response');

          const sanitized = sanitizeJsonText(jsonMatch[0]);
          const improved: string[] = JSON.parse(sanitized);

          for (let i = 0; i < Math.min(chunk.length, improved.length); i++) {
            const entry = chunk[i];
            const improvedText = improved[i]?.trim();
            if (improvedText && improvedText !== entry.translation) {
              allImprovements.push({
                key: entry.key,
                original: entry.original,
                current: entry.translation,
                currentBytes: getUtf16ByteLength(entry.translation),
                maxBytes: entry.maxBytes,
                improved: improvedText,
                improvedBytes: getUtf16ByteLength(improvedText),
              });
            }
          }
        }

        return new Response(JSON.stringify({ improvements: allImprovements }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // --- Default review action ---
     const issues: ReviewIssue[] = [];

    // Parse glossary for consistency checks
    const glossaryMap = new Map<string, string>();
    if (glossary) {
      for (const line of glossary.split('\n')) {
        const match = line.match(/^(.+?)\s*=\s*(.+)$/);
        if (match) {
          glossaryMap.set(match[1].trim().toLowerCase(), match[2].trim());
        }
      }
    }

    // Build translation consistency map (same original → same translation)
    const translationsByOriginal = new Map<string, { key: string; translation: string }[]>();

    for (const entry of entries) {
      if (!entry.translation?.trim()) continue;

      // 1. Missing tags check
      const originalTags = extractTags(entry.original);
      const translationTags = extractTags(entry.translation);
      
      for (const tag of originalTags) {
        if (!entry.translation.includes(tag)) {
          issues.push({
            key: entry.key,
            type: 'missing_tag',
            severity: 'error',
            message: `وسم مفقود في الترجمة: ${tag}`,
            suggestion: `أضف ${tag} في الموضع المناسب`,
          });
        }
      }

      // 2. Placeholder mismatch
      const origPlaceholders = extractPlaceholders(entry.original);
      const transPlaceholders = extractPlaceholders(entry.translation);
      if (origPlaceholders.length !== transPlaceholders.length) {
        issues.push({
          key: entry.key,
          type: 'placeholder_mismatch',
          severity: 'error',
          message: `عدد العناصر النائبة (￼) مختلف: الأصلي ${origPlaceholders.length}، الترجمة ${transPlaceholders.length}`,
        });
      }

      // 3. Text too long (byte limit)
      if (entry.maxBytes > 0) {
        const translationBytes = getUtf16ByteLength(entry.translation);
        const ratio = translationBytes / entry.maxBytes;
        if (ratio > 1) {
          issues.push({
            key: entry.key,
            type: 'too_long',
            severity: 'error',
            message: `الترجمة تتجاوز الحد (${translationBytes}/${entry.maxBytes} بايت) — لن يتم حقنها`,
            suggestion: `اختصر الترجمة بـ ${translationBytes - entry.maxBytes} بايت`,
          });
        } else if (ratio > 0.8) {
          issues.push({
            key: entry.key,
            type: 'too_long',
            severity: 'warning',
            message: `الترجمة قريبة من الحد (${Math.round(ratio * 100)}% من المساحة المتاحة)`,
          });
        }
      }

      // 4. Track for consistency
      const normOriginal = entry.original.trim().toLowerCase();
      if (!translationsByOriginal.has(normOriginal)) {
        translationsByOriginal.set(normOriginal, []);
      }
      translationsByOriginal.get(normOriginal)!.push({ key: entry.key, translation: entry.translation });

      // 5. Glossary term check
      for (const [term, expected] of glossaryMap) {
        if (entry.original.toLowerCase().includes(term) && !entry.translation.includes(expected)) {
          issues.push({
            key: entry.key,
            type: 'untranslated_term',
            severity: 'warning',
            message: `مصطلح "${term}" يجب أن يُترجم إلى "${expected}" حسب القاموس`,
            suggestion: expected,
          });
        }
      }

      // 6. Remaining English text detection
      // Skip proper nouns, button abbreviations, technical symbols, and short words
      const ZELDA_PROPER_NOUNS = new Set([
        'link', 'zelda', 'ganon', 'ganondorf', 'hyrule', 'navi', 'epona', 'triforce',
        'sheikah', 'goron', 'zora', 'gerudo', 'rito', 'korok', 'bokoblin', 'moblin',
        'lynel', 'hinox', 'guardian', 'malice', 'calamity', 'master', 'sword',
        'purah', 'impa', 'robbie', 'sidon', 'mipha', 'daruk', 'revali', 'urbosa',
        'rauru', 'sonia', 'mineru', 'tulin', 'yunobo', 'riju',
      ]);

      // Button abbreviations and technical symbols commonly left in Arabic text
      const BUTTON_ABBREVIATIONS = new Set([
        // Controller buttons
        'a', 'b', 'x', 'y', 'l', 'r', 'zl', 'zr', 'ls', 'rs',
        'lb', 'rb', 'lt', 'rt', 'up', 'down', 'left', 'right',
        // Common abbreviations
        'hp', 'mp', 'sp', 'atk', 'def', 'exp', 'lvl', 'lv', 'max',
        'min', 'dmg', 'dps', 'crit', 'xp', 'buff', 'debuff',
        // UI terms commonly left
        'ui', 'fps', 'hud', 'api', 'fps', 'rng', 'ai', 'npc',
        // Common game words variants
        'bow', 'map', 'key', 'item', 'shop', 'save', 'load', 'quit',
        'menu', 'back', 'next', 'ok', 'yes', 'no', 'on', 'off',
        // Tech symbols and codes
        'rgb', 'hex', 'var', 'def', 'fn', 'obj', 'arr', 'etc',
        // Very common short English prepositions/particles
        'of', 'to', 'in', 'at', 'by', 'or', 'an', 'is', 'as',
      ]);

      // Strip tags [Tag:Value] before scanning for English words
      const textWithoutTags = entry.translation.replace(/\[[^\]]*\]/g, '');
      const englishWords = textWithoutTags.match(/[a-zA-Z]{2,}/g) || [];
      const remainingEnglish = englishWords.filter(w => {
        const lower = w.toLowerCase();
        return (
          !ZELDA_PROPER_NOUNS.has(lower) && 
          !BUTTON_ABBREVIATIONS.has(lower) && 
          lower.length > 2
        );
      });

      if (remainingEnglish.length > 0) {
        issues.push({
          key: entry.key,
          type: 'remaining_english',
          severity: 'warning',
          message: `كلمات إنجليزية متبقية: ${remainingEnglish.slice(0, 5).join(', ')}`,
          suggestion: 'تحقق من ترجمة هذه الكلمات أو أنها مصطلحات فنية معترف بها',
        });
      }
    }

    // 6. Consistency check: same original text → different translations
    for (const [original, translations] of translationsByOriginal) {
      if (translations.length > 1) {
        const uniqueTranslations = new Set(translations.map(t => t.translation.trim()));
        if (uniqueTranslations.size > 1) {
          for (const t of translations) {
            issues.push({
              key: t.key,
              type: 'inconsistent',
              severity: 'warning',
              message: `نفس النص الأصلي مترجم بأشكال مختلفة (${uniqueTranslations.size} ترجمات مختلفة)`,
              suggestion: translations[0].translation,
            });
          }
        }
      }
    }

    // Summary stats
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    return new Response(JSON.stringify({
      issues,
      summary: {
        total: issues.length,
        errors: errorCount,
        warnings: warningCount,
        checked: entries.length,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Review error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'خطأ غير متوقع' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
