import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Tag Protection: replace [content] and control chars with TAG_N placeholders ---
function protectTags(text: string): { cleaned: string; tags: Map<string, string> } {
  const tags = new Map<string, string>();
  let counter = 0;
  const cleaned = text.replace(/\[[^\]]*\]|[\uFFF9-\uFFFC\uE000-\uE0FF]+/g, (match) => {
    const placeholder = `TAG_${counter++}`;
    tags.set(placeholder, match);
    return placeholder;
  });
  return { cleaned, tags };
}

function restoreTags(text: string, tags: Map<string, string>): string {
  let result = text;
  for (const [placeholder, original] of tags) {
    result = result.replace(placeholder, original);
  }
  return result;
}

// --- Post-processing: clean up AI output ---
function postProcess(translation: string, original: string): string {
  let t = translation;
  // Remove extra whitespace
  t = t.replace(/\s{2,}/g, ' ').trim();
  // Fix Arabic punctuation: ensure ؟ instead of ? when text is Arabic
  const hasArabic = /[\u0600-\u06FF]/.test(t);
  if (hasArabic) {
    // Replace English ? at end with Arabic ؟
    t = t.replace(/\?(\s*)$/g, '؟$1');
    // Replace English ; with Arabic ؛
    t = t.replace(/;/g, '؛');
    // Fix common AI artifacts
    t = t.replace(/\u200F/g, ''); // Remove RTL marks that AI sometimes inserts
  }
  // Restore missing end punctuation
  const origEnd = original.trim();
  const transEnd = t.trim();
  if (origEnd.endsWith('?') && !transEnd.endsWith('؟') && !transEnd.endsWith('?') && hasArabic) {
    t = t.trimEnd() + '؟';
  }
  if (origEnd.endsWith('!') && !transEnd.endsWith('!')) {
    t = t.trimEnd() + '!';
  }
  if (origEnd.endsWith('.') && !transEnd.endsWith('.') && !transEnd.endsWith('。')) {
    t = t.trimEnd() + '.';
  }
  return t;
}

// --- Build the system prompt based on category ---
function buildSystemPrompt(category: string): string {
  const base = `أنت مترجم ألعاب فيديو محترف متخصص في سلسلة The Legend of Zelda. تترجم من الإنجليزية إلى العربية الفصحى المبسطة.

قواعد الأسلوب العامة:
• استخدم العربية الفصحى المبسطة (ليست عامية ولا أكاديمية جامدة)
• اجعل الترجمة طبيعية وسلسة كأنها كُتبت بالعربية أصلاً
• حافظ على طول الترجمة قريباً من الأصل (مهم جداً لصناديق النص في اللعبة)
• لا تضف كلمات زائدة أو شرح غير موجود في الأصل
• حافظ على العلامات TAG_0, TAG_1 إلخ في أماكنها بالضبط
• حافظ على رمز العنصر النائب \uFFFC كما هو
• الأسماء العلم الشهيرة: Link=لينك، Zelda=زيلدا، Ganon=غانون، Hyrule=هايرول، Triforce=تريفورس، Master Sword=سيف الماستر
• أعد فقط مصفوفة JSON من النصوص المترجمة بنفس الترتيب`;

  const categoryPrompts: Record<string, string> = {
    'story': `\n\nأسلوب خاص — حوارات القصة:
• استخدم أسلوباً سردياً أدبياً جذاباً يناسب عالم الفانتازيا
• حافظ على شخصية المتحدث (رسمي للملوك، ودود للقرويين، غامض للحكماء)
• استخدم "أنت" و"أنتِ" حسب السياق
• اجعل الحوارات تبدو حية وطبيعية لا جامدة`,

    'hud': `\n\nأسلوب خاص — واجهة اللعب:
• اختصر قدر الإمكان — كل حرف مهم
• استخدم صيغة الأمر المباشر (اضغط، افتح، أغلق)
• تجنب الضمائر والأدوات غير الضرورية`,

    'main-menu': `\n\nأسلوب خاص — القائمة الرئيسية:
• اختصر قدر الإمكان
• استخدم مصطلحات شائعة في ألعاب الفيديو العربية`,

    'settings': `\n\nأسلوب خاص — الإعدادات:
• استخدم المصطلحات التقنية الشائعة (السطوع، مستوى الصوت، حساسية...)
• اختصر قدر الإمكان`,

    'pause-menu': `\n\nأسلوب خاص — قائمة الإيقاف:
• اختصر بحيث يتسع النص في الأزرار
• استخدم صيغ اسمية مباشرة`,

    'swords': `\n\nأسلوب خاص — أسماء الأسلحة:
• ترجم الوصف ولكن حافظ على الأسماء المميزة
• استخدم صياغة ملحمية مختصرة (سيف البرق، رمح الظلام)`,
    'spears': `\n\nأسلوب خاص — أسماء الرماح: استخدم صياغة ملحمية مختصرة`,
    'bows': `\n\nأسلوب خاص — أسماء الأقواس: استخدم صياغة ملحمية مختصرة`,
    'shields': `\n\nأسلوب خاص — أسماء الدروع: استخدم صياغة ملحمية مختصرة`,
    'armor': `\n\nأسلوب خاص — الملابس والدروع: ترجم الاسم بشكل وصفي مختصر`,

    'food': `\n\nأسلوب خاص — الطعام والطبخ:
• استخدم أسماء الأطعمة الشائعة بالعربية
• للوصفات المركبة، اجعل الاسم وصفياً جذاباً`,

    'monsters': `\n\nأسلوب خاص — الوحوش والأعداء:
• ترجم أسماء الوحوش العامة (Bokoblin=بوكوبلين، Lynel=لينيل)
• حافظ على أسماء الزعماء الشهيرة`,

    'challenge': `\n\nأسلوب خاص — المهام والتحديات:
• استخدم أسلوباً تحفيزياً واضحاً
• اجعل أسماء المهام جذابة ومثيرة`,

    'map': `\n\nأسلوب خاص — المواقع والخرائط:
• حافظ على الأسماء العلم أو اكتبها بالحروف العربية
• ترجم الأوصاف الجغرافية (Peak=قمة، Lake=بحيرة، Forest=غابة)`,

    'tips': `\n\nأسلوب خاص — النصائح والتعليمات:
• استخدم أسلوب المخاطب المباشر
• اجعل التعليمات واضحة ومباشرة`,

    'npc': `\n\nأسلوب خاص — أسماء الشخصيات:
• اكتب الأسماء بالحروف العربية بأقرب نطق ممكن
• لا تترجم معنى الأسماء العلم`,

    'zonai': `\n\nأسلوب خاص — أدوات زوناي:
• ترجم وظيفة الأداة بشكل مختصر وواضح`,

    'materials': `\n\nأسلوب خاص — المواد والموارد:
• استخدم أسماء المواد الشائعة بالعربية`,
  };

  return base + (categoryPrompts[category] || '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entries, glossary, context, userApiKey, translationEngine, translationQuality, geminiModel, userClaudeKey, myMemoryEmail, category, filePath, labels } = await req.json() as {
      entries: { key: string; original: string; label?: string; maxBytes?: number }[];
      glossary?: string;
      context?: { key: string; original: string; translation?: string }[];
      userApiKey?: string;
      translationEngine?: 'gemini' | 'lovable' | 'mymemory' | 'google' | 'claude';
      translationQuality?: 'fast' | 'quality';
      geminiModel?: 'gemini-2.0-flash' | 'gemini-2.5-flash' | 'gemini-2.5-pro';
      userClaudeKey?: string;
      myMemoryEmail?: string;
      category?: string;
      filePath?: string;
      labels?: string[];
    };

    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ error: 'لا توجد نصوص للترجمة' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Protect tags in brackets before translation
    const protectedEntries = entries.map(e => {
      const { cleaned, tags } = protectTags(e.original);
      return { ...e, cleaned, tags };
    });

    // Build rich context block
    let contextSection = '';
    if (context && context.length > 0) {
      const contextLines = context
        .filter(c => c.translation?.trim())
        .map(c => `EN: "${c.original}" → AR: "${c.translation}"`)
        .slice(0, 15)
        .join('\n');
      if (contextLines) {
        contextSection = `\n\nترجمات مجاورة سابقة (استخدمها للاتساق في الأسلوب والمصطلحات):
${contextLines}`;
      }
    }

    // Build glossary section with better formatting
    let glossarySection = '';
    if (glossary && glossary.trim()) {
      const lines = glossary.trim().split('\n').filter(l => l.includes('='));
      if (lines.length > 0) {
        // Take most relevant glossary terms (first 100)
        const relevant = lines.slice(0, 100);
        glossarySection = `\n\nقاموس المصطلحات (يجب استخدام هذه الترجمات بالضبط عند ظهور المصطلح):
${relevant.join('\n')}`;
      }
    }

    // File/category metadata
    let metadataSection = '';
    if (filePath || category) {
      metadataSection = '\n\nمعلومات الملف:';
      if (filePath) metadataSection += `\nمسار الملف: ${filePath}`;
      if (category) metadataSection += `\nالفئة: ${category}`;
    }

    // Build texts block with labels for context
    const textsBlock = protectedEntries.map((e, i) => {
      const labelPart = e.label ? ` (${e.label})` : '';
      const bytePart = e.maxBytes && e.maxBytes > 0 ? ` [حد: ${e.maxBytes} بايت]` : '';
      return `[${i}]${labelPart}${bytePart} ${e.cleaned}`;
    }).join('\n');

    // Build system prompt based on category
    const systemPrompt = buildSystemPrompt(category || 'other');

    const userPrompt = `ترجم النصوص التالية من الإنجليزية إلى العربية. أعد فقط مصفوفة JSON تحتوي على النصوص المترجمة بنفس الترتيب، بدون أي شرح أو تعليقات.${metadataSection}${glossarySection}${contextSection}

النصوص للترجمة:
${textsBlock}`;

    // === Google Translate engine (free, no API key) ===
    if (translationEngine === 'google') {
      const result: Record<string, string> = {};
      const CONCURRENT = 5;
      for (let i = 0; i < protectedEntries.length; i += CONCURRENT) {
        const batch = protectedEntries.slice(i, i + CONCURRENT);
        const promises = batch.map(async (entry) => {
          const text = encodeURIComponent(entry.cleaned);
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${text}`;
          try {
            const gtResponse = await fetch(url);
            if (!gtResponse.ok) return;
            const gtData = await gtResponse.json();
            const translated = (gtData?.[0] as [string, string][] | undefined)
              ?.map((seg: [string, string]) => seg[0])
              .join('') || '';
            if (translated.trim()) {
              const restored = restoreTags(translated, entry.tags);
              result[entry.key] = postProcess(restored, entry.original);
            }
          } catch { /* skip */ }
        });
        await Promise.all(promises);
        if (i + CONCURRENT < protectedEntries.length) {
          await new Promise(r => setTimeout(r, 200));
        }
      }
      return new Response(JSON.stringify({ translations: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === MyMemory translation engine ===
    if (translationEngine === 'mymemory') {
      const result: Record<string, string> = {};
      let totalChars = 0;
      const CONCURRENT = 5;
      for (let i = 0; i < protectedEntries.length; i += CONCURRENT) {
        const batch = protectedEntries.slice(i, i + CONCURRENT);
        const promises = batch.map(async (entry) => {
          const text = encodeURIComponent(entry.cleaned);
          let url = `https://api.mymemory.translated.net/get?q=${text}&langpair=en|ar`;
          if (myMemoryEmail) url += `&de=${encodeURIComponent(myMemoryEmail)}`;
          try {
            const mmResponse = await fetch(url);
            if (!mmResponse.ok) { await mmResponse.text(); return; }
            const mmData = await mmResponse.json();
            const translated = mmData?.responseData?.translatedText;
            if (translated && translated.trim()) {
              const restored = restoreTags(translated, entry.tags);
              result[entry.key] = postProcess(restored, entry.original);
              totalChars += entry.cleaned.length;
            }
          } catch { /* skip */ }
        });
        await Promise.all(promises);
        if (i + CONCURRENT < protectedEntries.length) {
          await new Promise(r => setTimeout(r, 150));
        }
      }
      return new Response(JSON.stringify({ translations: result, charsUsed: totalChars }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Claude/Anthropic translation engine ===
    if (translationEngine === 'claude' && userClaudeKey?.trim()) {
      const claudeKey = userClaudeKey.trim();

      // Detect wrong key type — Claude keys start with "sk-ant-", Gemini keys start with "AIza"
      if (claudeKey.startsWith('AIza')) {
        return new Response(JSON.stringify({
          error: 'يبدو أنك أدخلت مفتاح Gemini في حقل Claude. مفاتيح Claude تبدأ بـ "sk-ant-". غيّر المحرك إلى Gemini أو أدخل مفتاح Anthropic صحيح.'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: translationQuality === 'quality' ? 'claude-sonnet-4-20250514' : 'claude-haiku-35-20241022',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          temperature: 0.2,
        }),
      });

      if (!claudeResponse.ok) {
        const err = await claudeResponse.text();
        console.error('Claude error:', err);
        if (claudeResponse.status === 401) {
          return new Response(JSON.stringify({
            error: 'مفتاح Claude API غير صالح. تأكد من المفتاح من console.anthropic.com (يبدأ بـ sk-ant-).'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (claudeResponse.status === 429) {
          return new Response(JSON.stringify({
            error: 'تم تجاوز حد طلبات Claude، حاول لاحقاً.'
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // Parse Anthropic error body for clearer messages
        let parsedMsg = '';
        try {
          const j = JSON.parse(err);
          parsedMsg = j?.error?.message || '';
        } catch { /* ignore */ }

        if (parsedMsg.toLowerCase().includes('credit balance')) {
          return new Response(JSON.stringify({
            error: 'رصيد حساب Claude فارغ. Anthropic لا تقدم استخداماً مجانياً — يجب شراء رصيد من console.anthropic.com → Plans & Billing. أو استخدم محرك Gemini المجاني بدلاً من ذلك.'
          }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({
          error: `خطأ Claude (${claudeResponse.status}): ${parsedMsg || 'خطأ غير معروف'}`
        }), {
          status: claudeResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const claudeData = await claudeResponse.json();
      const content = claudeData?.content?.[0]?.text || '';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Failed to parse Claude response');

      const sanitized = jsonMatch[0].replace(/[\x00-\x1F\x7F]/g, ' ');
      const translations: string[] = JSON.parse(sanitized);

      const result: Record<string, string> = {};
      for (let i = 0; i < Math.min(protectedEntries.length, translations.length); i++) {
        if (translations[i]?.trim()) {
          const restored = restoreTags(translations[i], protectedEntries[i].tags);
          result[protectedEntries[i].key] = postProcess(restored, protectedEntries[i].original);
        }
      }

      return new Response(JSON.stringify({ translations: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let data: any;

    if (userApiKey && userApiKey.trim()) {
      // Use user's own Gemini API key — prefer explicit geminiModel; fallback to quality
      const resolvedGeminiModel = geminiModel
        || (translationQuality === 'quality' ? 'gemini-2.5-pro' : 'gemini-2.5-flash');
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedGeminiModel}:generateContent?key=${userApiKey.trim()}`;
      
      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: userPrompt }] }
          ],
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          generationConfig: {
            temperature: 0.2,
            topP: 0.9,
          },
        }),
      });

      if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        console.error('Gemini API error:', errText);
        if (geminiResponse.status === 400 || geminiResponse.status === 403) {
          return new Response(JSON.stringify({ error: 'مفتاح API غير صالح أو منتهي الصلاحية. تأكد من المفتاح في Google AI Studio.' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (geminiResponse.status === 429) {
          const isQuotaZero = errText.includes('limit: 0');
          const msg = isQuotaZero
            ? 'حصة مفتاح Gemini المجاني نفدت بالكامل. أنشئ مفتاحاً جديداً من مشروع Google Cloud جديد، أو فعّل الفوترة على ai.google.dev'
            : 'تم تجاوز حد الطلبات المؤقت، حاول مرة أخرى بعد دقيقة';
          return new Response(JSON.stringify({ error: msg }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: `خطأ Gemini: ${geminiResponse.status}` }), {
          status: geminiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const geminiData = await geminiResponse.json();
      const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('فشل في تحليل استجابة Gemini');
      
      const sanitized = jsonMatch[0].replace(/[\x00-\x1F\x7F]/g, ' ');
      const translations: string[] = JSON.parse(sanitized);
      
      const result: Record<string, string> = {};
      for (let i = 0; i < Math.min(protectedEntries.length, translations.length); i++) {
        if (translations[i] && translations[i].trim()) {
          const restored = restoreTags(translations[i], protectedEntries[i].tags);
          result[protectedEntries[i].key] = postProcess(restored, protectedEntries[i].original);
        }
      }
      
      return new Response(JSON.stringify({ translations: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Use Lovable AI gateway — prefer explicit geminiModel; fallback to quality
      const apiKey = Deno.env.get('LOVABLE_API_KEY');
      if (!apiKey) throw new Error('Missing LOVABLE_API_KEY');

      const gatewayModel = geminiModel
        ? `google/${geminiModel}`
        : (translationQuality === 'quality' ? 'google/gemini-2.5-pro' : 'google/gemini-2.5-flash');
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: gatewayModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('AI gateway error:', err);
        if (response.status === 402) throw new Error('انتهت نقاط الذكاء الاصطناعي — استخدم مفتاح Gemini الشخصي');
        if (response.status === 429) throw new Error('تم تجاوز حد الطلبات، حاول لاحقاً');
        throw new Error(`AI error: ${response.status}`);
      }

      data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Failed to parse AI response');

      const sanitized = jsonMatch[0].replace(/[\x00-\x1F\x7F]/g, ' ');
      const translations: string[] = JSON.parse(sanitized);

      const result: Record<string, string> = {};
      for (let i = 0; i < Math.min(protectedEntries.length, translations.length); i++) {
        if (translations[i] && translations[i].trim()) {
          const restored = restoreTags(translations[i], protectedEntries[i].tags);
          result[protectedEntries[i].key] = postProcess(restored, protectedEntries[i].original);
        }
      }

      return new Response(JSON.stringify({ translations: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'خطأ غير متوقع' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
