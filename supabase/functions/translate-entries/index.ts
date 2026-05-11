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
  return text.replace(/TAG_\d+/g, (m) => tags.get(m) ?? m);
}

// --- Strict JSON via tool calling (#24) ---
// One logical schema, four provider-specific encodings. The model is asked to
// invoke `submit_translations` with an array of strings in input order. If the
// model ignores the tool, callers fall back to the existing text-parse path.
const TOOL_NAME = 'submit_translations';
const TOOL_DESCRIPTION =
  'Submit the Arabic translations of the input entries. Provide one string per entry, in the same order they were given. Do not add explanations.';

const openAITool = {
  type: 'function',
  function: {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        translations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Arabic translations in input order, one per entry.',
        },
      },
      required: ['translations'],
    },
  },
} as const;

const geminiTool = {
  function_declarations: [
    {
      name: TOOL_NAME,
      description: TOOL_DESCRIPTION,
      parameters: {
        type: 'OBJECT',
        properties: {
          translations: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
        },
        required: ['translations'],
      },
    },
  ],
} as const;

// Extract a translations array from a tool-call response. Returns null if no
// usable tool call is found (caller should fall back to text parsing).
function extractTranslationsFromOpenAITool(
  message: Record<string, unknown> | undefined,
): string[] | null {
  if (!message || typeof message !== 'object') return null;
  const toolCalls = (message as { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> }).tool_calls;
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;
  const call = toolCalls.find((c) => c?.function?.name === TOOL_NAME) ?? toolCalls[0];
  const argsStr = call?.function?.arguments;
  if (typeof argsStr !== 'string' || argsStr.length === 0) return null;
  try {
    const parsed = JSON.parse(argsStr) as { translations?: unknown };
    if (Array.isArray(parsed.translations) && parsed.translations.every((x) => typeof x === 'string')) {
      return parsed.translations as string[];
    }
  } catch {
    /* fall back to text parse */
  }
  return null;
}

function extractTranslationsFromGeminiTool(
  candidates: Array<{ content?: { parts?: Array<{ functionCall?: { name?: string; args?: unknown } }> } }> | undefined,
): string[] | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const fnPart = parts.find((p) => p?.functionCall?.name === TOOL_NAME);
  const args = fnPart?.functionCall?.args as { translations?: unknown } | undefined;
  if (args && Array.isArray(args.translations) && args.translations.every((x) => typeof x === 'string')) {
    return args.translations as string[];
  }
  return null;
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

// --- Built-in Zelda/gaming glossary for free translation engines ---
const BUILTIN_GLOSSARY: ReadonlyArray<readonly [string, string]> = [
  // Zelda proper nouns
  ["Link", "لينك"], ["Zelda", "زيلدا"], ["Ganon", "غانون"], ["Ganondorf", "غاندورف"],
  ["Hyrule", "هايرول"], ["Triforce", "تريفورس"], ["Master Sword", "سيف الماستر"],
  ["Bokoblin", "بوكوبلين"], ["Moblin", "موبلين"], ["Lynel", "لينيل"], ["Hinox", "هينوكس"],
  ["Guardian", "الحارس"], ["Sheikah", "شيكا"], ["Zonai", "زوناي"], ["Korok", "كوروك"],
  ["Goron", "غورون"], ["Zora", "زورا"], ["Rito", "ريتو"], ["Gerudo", "غيرودو"],
  ["Deku", "ديكو"], ["Kokiri", "كوكيري"], ["Navi", "نافي"], ["Epona", "إيبونا"],
  ["Rupee", "روبية"], ["Rupees", "روبيات"],
  ["Purah", "بورا"], ["Impa", "إمبا"], ["Robbie", "روبي"], ["Sidon", "سيدون"],
  ["Riju", "ريجو"], ["Tulin", "تولين"], ["Yunobo", "يونوبو"], ["Mineru", "مينيرو"],
  ["Rauru", "راؤرو"], ["Sonia", "سونيا"], ["Hestu", "هيستو"],
  ["Death Mountain", "جبل الموت"], ["Kakariko", "كاكاريكو"], ["Hateno", "هاتينو"],
  ["Rito Village", "قرية ريتو"], ["Goron City", "مدينة غورون"],
  ["Zora's Domain", "مملكة زورا"], ["Gerudo Town", "بلدة غيرودو"],
  ["Lookout Landing", "ميناء المراقبة"], ["Great Sky Island", "جزيرة السماء الكبرى"],
  ["Depths", "الأعماق"], ["Sky", "السماء"], ["Surface", "السطح"],
  // Gaming terms
  ["HP", "الصحة"], ["heart", "قلب"], ["hearts", "قلوب"],
  ["stamina", "القدرة"], ["stamina wheel", "عجلة القدرة"],
  ["fast travel", "السفر السريع"], ["warp", "انتقال"],
  ["shrine", "مزار"], ["temple", "معبد"], ["dungeon", "زنزانة"],
  ["side quest", "مهمة جانبية"], ["main quest", "مهمة رئيسية"],
  ["armor set", "طقم درع"], ["weapon", "سلاح"], ["shield", "درع"], ["bow", "قوس"],
  ["arrow", "سهم"], ["arrows", "سهام"], ["bomb", "قنبلة"],
  ["elixir", "إكسير"], ["potion", "جرعة"], ["meal", "وجبة"], ["recipe", "وصفة"],
  ["ingredients", "المكونات"], ["cooking pot", "قدر الطبخ"],
  ["fuse", "دمج"], ["attach", "إلحاق"], ["recall", "استرجاع"], ["ascend", "صعود"],
  ["ultrahand", "اليد الفائقة"], ["autobuild", "البناء التلقائي"],
  ["inventory", "المخزون"], ["quest log", "سجل المهام"], ["map", "خريطة"],
  ["save", "حفظ"], ["load", "تحميل"], ["game over", "انتهت اللعبة"],
  ["treasure chest", "صندوق كنز"], ["boss", "زعيم"], ["mini-boss", "زعيم صغير"],
  ["enemy", "عدو"], ["enemies", "أعداء"], ["monster", "وحش"],
  ["damage", "ضرر"], ["defense", "دفاع"], ["attack", "هجوم"],
  ["critical hit", "ضربة حرجة"], ["sneak strike", "ضربة خفية"],
  ["quest", "مهمة"], ["quest complete", "اكتملت المهمة"],
  ["equip", "تجهيز"], ["unequip", "إزالة التجهيز"],
  ["drop", "إسقاط"], ["pick up", "التقاط"],
  ["paraglider", "المظلة الشراعية"], ["horse", "حصان"],
  ["tower", "برج"], ["stable", "اسطبل"], ["village", "قرية"],
  ["fairy", "جنية"], ["Great Fairy", "الجنية العظيمة"],
  ["Blood Moon", "قمر الدم"], ["Star Fragment", "شظية نجم"],
  ["Ancient", "قديم"], ["Royal", "ملكي"], ["Mighty", "عتيد"],
];

function buildGlossaryMap(glossaryText?: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const [en, ar] of BUILTIN_GLOSSARY) {
    map.set(en, ar);
  }
  if (glossaryText?.trim()) {
    for (const line of glossaryText.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || t.startsWith('//')) continue;
      const eqIdx = t.indexOf('=');
      if (eqIdx < 0) continue;
      const en = t.slice(0, eqIdx).trim();
      const ar = t.slice(eqIdx + 1).trim();
      if (en && ar) map.set(en, ar);
    }
  }
  return map;
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
    const { entries, glossary, context, tmExamples, userApiKey, translationEngine, translationQuality, geminiModel, myMemoryEmail, category, filePath, labels, extraInstructions, temperature: rawTemperature, strictJson: rawStrictJson } = await req.json() as {
      entries: { key: string; original: string; label?: string; maxBytes?: number }[];
      glossary?: string;
      context?: { key: string; original: string; translation?: string }[];
      tmExamples?: { original: string; translation: string; sim?: number }[];
      userApiKey?: string;
      translationEngine?: 'gemini' | 'lovable' | 'mymemory' | 'google';
      translationQuality?: 'fast' | 'quality';
      geminiModel?: 'gemini-2.5-flash-lite' | 'gemini-2.5-flash' | 'gemini-2.5-pro';
      myMemoryEmail?: string;
      category?: string;
      filePath?: string;
      labels?: string[];
      extraInstructions?: string;
      temperature?: number;
      strictJson?: boolean;
    };

    // Strict JSON via tool calling (#24): default ON. When false, behave exactly
    // as before. When true, the engine asks the model to invoke a tool and parses
    // the structured payload first; falls back to text parsing if the model
    // ignored the tool.
    const strictJson: boolean = rawStrictJson !== false;

    // Clamp client-provided temperature to a safe range; default 0.2 for backward compat.
    const temperature: number = (() => {
      const t = Number(rawTemperature);
      if (!Number.isFinite(t)) return 0.2;
      if (t < 0) return 0;
      if (t > 2) return 2;
      return t;
    })();

    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ error: 'لا توجد نصوص للترجمة' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Server-side guard: حظر إرسال النصوص التقنية البحتة للذكاء الاصطناعي ----
    // PUA (E000–E0FF) و/أو علامات تنسيق Unicode (FFF9–FFFC) و/أو علامات BiDi/ZW
    // و/أو علامات ترقيم — بدون أيّ حرف أو رقم — لا يجوز إرسالها لأنّها ستُنتج `??`.
    const isOnlyTechnicalTagsServer = (text: string): boolean => {
      if (!text) return false;
      let t = text.replace(/[\s\u00A0\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "");
      t = t.replace(/[\p{P}\p{S}]/gu, "");
      if (!t) return false;
      if (/[\p{L}\p{N}]/u.test(t)) return false;
      return /[\uFFF9\uFFFA\uFFFB\uFFFC\uE000-\uE0FF]/.test(t);
    };

    const blocked: { key: string; original: string; reason: string }[] = [];
    const allowedEntries: typeof entries = [];
    for (const e of entries) {
      if (isOnlyTechnicalTagsServer(e.original)) {
        blocked.push({ key: e.key, original: e.original, reason: 'only-technical-tags' });
      } else {
        allowedEntries.push(e);
      }
    }
    if (blocked.length > 0) {
      console.warn(`[translate-entries] blocked ${blocked.length} technical-only entries from AI`);
    }
    if (allowedEntries.length === 0) {
      return new Response(JSON.stringify({ result: {}, blocked }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Protect tags in brackets before translation
    const protectedEntries = allowedEntries.map(e => {
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

    // TM Boost: similar already-translated entries injected as few-shot examples
    let tmExamplesSection = '';
    if (tmExamples && tmExamples.length > 0) {
      const tmLines = tmExamples
        .filter(t => t.original?.trim() && t.translation?.trim())
        .slice(0, 10)
        .map(t => `EN: "${t.original}" → AR: "${t.translation}"`)
        .join('\n');
      if (tmLines) {
        tmExamplesSection = `\n\nأمثلة من ترجماتك السابقة لجمل مشابهة (حافظ على نفس المصطلحات والأسلوب):
${tmLines}`;
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

    // User-supplied extra instructions (from prompt presets or free-form input)
    const trimmedExtra = (extraInstructions || '').trim().slice(0, 4000);
    const extraInstructionsSection = trimmedExtra
      ? `\n\nتعليمات إضافية من المستخدم (أولوية عليا — تتقدّم على الإعدادات الافتراضية إذا تعارضت):\n${trimmedExtra}`
      : '';

    const userPrompt = `ترجم النصوص التالية من الإنجليزية إلى العربية. أعد فقط مصفوفة JSON تحتوي على النصوص المترجمة بنفس الترتيب، بدون أي شرح أو تعليقات.${metadataSection}${glossarySection}${tmExamplesSection}${contextSection}${extraInstructionsSection}

النصوص للترجمة:
${textsBlock}`;

    // === Google Translate engine (free, no API key) — enhanced ===
    if (translationEngine === 'google') {
      const result: Record<string, string> = {};
      let failedCount = 0;

      // Build glossary: built-in Zelda/gaming terms + user's custom glossary
      const glossaryMap = buildGlossaryMap(glossary);

      // Pre-translate glossary terms via Google to build a replacement cache
      // (Google's Arabic for term → correct glossary Arabic)
      const glossaryReplacements = new Map<string, string>();
      if (glossaryMap.size > 0) {
        // Find which glossary terms actually appear in the entries
        const allText = protectedEntries.map(e => e.cleaned).join(' ').toLowerCase();
        const relevantTerms = [...glossaryMap.entries()]
          .filter(([en]) => allText.includes(en.toLowerCase()))
          .slice(0, 50); // Cap at 50 to avoid too many requests

        // Batch-translate relevant terms (8 concurrent)
        for (let i = 0; i < relevantTerms.length; i += 8) {
          const termBatch = relevantTerms.slice(i, i + 8);
          await Promise.all(termBatch.map(async ([enTerm, arTerm]) => {
            try {
              const termUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(enTerm)}`;
              const resp = await fetch(termUrl);
              if (resp.ok) {
                const data = await resp.json();
                const googleAr = (data?.[0] as [string, string][] | undefined)
                  ?.map((seg: [string, string]) => seg[0]).join('') || '';
                if (googleAr.trim() && googleAr !== arTerm) {
                  glossaryReplacements.set(googleAr, arTerm);
                }
              }
            } catch { /* best-effort */ }
          }));
          if (i + 8 < relevantTerms.length) await new Promise(r => setTimeout(r, 200));
        }
      }

      // Helper: fetch from Google Translate with retry + fallback endpoint
      const googleTranslate = async (text: string): Promise<string | null> => {
        const encoded = encodeURIComponent(text);
        const endpoints = [
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encoded}`,
          `https://translate.google.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encoded}`,
        ];
        for (let attempt = 0; attempt < 3; attempt++) {
          const url = attempt < 2 ? endpoints[0] : endpoints[1];
          try {
            const resp = await fetch(url);
            if (resp.status === 429) {
              await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
              continue;
            }
            if (!resp.ok) continue;
            const data = await resp.json();
            const translated = (data?.[0] as [string, string][] | undefined)
              ?.map((seg: [string, string]) => seg[0]).join('') || '';
            if (translated.trim()) return translated;
          } catch {
            await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
          }
        }
        return null;
      };

      // Detect remaining English words (excluding TAG_ placeholders and single letters)
      const findEnglishWords = (text: string): string[] => {
        // Remove TAG_N placeholders before checking
        const cleaned = text.replace(/TAG_\d+/g, '');
        // Match English words (2+ letters), excluding common abbreviations and single chars
        const matches = cleaned.match(/\b[A-Za-z]{2,}\b/g) || [];
        return [...new Set(matches)];
      };

      // Re-translate individual English words that Google left untranslated
      const fixEnglishWords = async (translated: string, englishWords: string[]): Promise<string> => {
        let fixed = translated;
        // Batch translate remaining English words
        for (const word of englishWords.slice(0, 10)) {
          // Skip TAG placeholders and very short words
          if (word.startsWith('TAG') || word.length < 2) continue;
          // Check glossary first
          const glossaryAr = glossaryMap.get(word) || glossaryMap.get(word.toLowerCase());
          if (glossaryAr) {
            fixed = fixed.replace(new RegExp(`\\b${word}\\b`, 'gi'), glossaryAr);
            continue;
          }
          // Translate the individual word
          const wordTranslated = await googleTranslate(word);
          if (wordTranslated && wordTranslated.trim() && !/[A-Za-z]/.test(wordTranslated)) {
            fixed = fixed.replace(new RegExp(`\\b${word}\\b`, 'g'), wordTranslated);
          }
        }
        return fixed;
      };

      // Translate entries in concurrent batches
      const CONCURRENT = 8;
      for (let i = 0; i < protectedEntries.length; i += CONCURRENT) {
        const batch = protectedEntries.slice(i, i + CONCURRENT);
        await Promise.all(batch.map(async (entry) => {
          let translated = await googleTranslate(entry.cleaned);
          if (!translated) { failedCount++; return; }

          // Apply cached glossary replacements
          for (const [googleAr, correctAr] of glossaryReplacements) {
            if (translated.includes(googleAr)) {
              translated = translated.replace(
                new RegExp(googleAr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                correctAr
              );
            }
          }

          // Fix remaining English words in translation
          const remainingEnglish = findEnglishWords(translated);
          if (remainingEnglish.length > 0) {
            translated = await fixEnglishWords(translated, remainingEnglish);
          }

          const restored = restoreTags(translated, entry.tags);
          result[entry.key] = postProcess(restored, entry.original);
        }));
        if (i + CONCURRENT < protectedEntries.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      const response: Record<string, unknown> = { translations: result };
      if (failedCount > 0) {
        response.warning = `فشلت ترجمة ${failedCount} نص من أصل ${protectedEntries.length}`;
      }
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === MyMemory translation engine — enhanced with glossary ===
    if (translationEngine === 'mymemory') {
      const mmGlossaryMap = buildGlossaryMap(glossary);
      const sortedTerms = [...mmGlossaryMap.entries()].sort((a, b) => b[0].length - a[0].length);
      const result: Record<string, string> = {};
      let totalChars = 0;
      const CONCURRENT = 5;
      for (let i = 0; i < protectedEntries.length; i += CONCURRENT) {
        const batch = protectedEntries.slice(i, i + CONCURRENT);
        const promises = batch.map(async (entry) => {
          // Pre-process: protect glossary terms with placeholders
          let textToTranslate = entry.cleaned;
          const termPlaceholders: Array<{ placeholder: string; arabic: string }> = [];
          let termIdx = 0;
          for (const [en, ar] of sortedTerms) {
            const regex = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            if (regex.test(textToTranslate)) {
              const ph = `GLTERM_${termIdx++}`;
              termPlaceholders.push({ placeholder: ph, arabic: ar });
              textToTranslate = textToTranslate.replace(
                new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ph
              );
            }
          }
          const text = encodeURIComponent(textToTranslate);
          let url = `https://api.mymemory.translated.net/get?q=${text}&langpair=en|ar`;
          if (myMemoryEmail) url += `&de=${encodeURIComponent(myMemoryEmail)}`;
          try {
            const mmResponse = await fetch(url);
            if (!mmResponse.ok) { await mmResponse.text(); return; }
            const mmData = await mmResponse.json();
            let translated = mmData?.responseData?.translatedText;
            if (translated && translated.trim()) {
              // Post-process: restore glossary terms
              for (const { placeholder, arabic } of termPlaceholders) {
                translated = translated.replace(new RegExp(placeholder, 'gi'), arabic);
              }
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


    let data: { choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ function: { arguments: string } }> } }> } | undefined;

    if (userApiKey && userApiKey.trim()) {
      // Use user's own Gemini API key — prefer explicit geminiModel; fallback to quality
      const resolvedGeminiModel = geminiModel
        || (translationQuality === 'quality' ? 'gemini-2.5-pro' : 'gemini-2.5-flash');
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedGeminiModel}:generateContent?key=${userApiKey.trim()}`;
      
      const geminiBody: Record<string, unknown> = {
        contents: [
          { role: 'user', parts: [{ text: userPrompt }] }
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature,
          topP: 0.9,
        },
      };
      if (strictJson) {
        geminiBody.tools = [geminiTool];
        geminiBody.tool_config = {
          function_calling_config: { mode: 'ANY', allowed_function_names: [TOOL_NAME] },
        };
      }
      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
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
      let translations: string[] | null = strictJson
        ? extractTranslationsFromGeminiTool(geminiData?.candidates)
        : null;
      if (!translations) {
        const parts = geminiData?.candidates?.[0]?.content?.parts;
        const textPart = Array.isArray(parts) ? parts.find((p: { text?: string }) => typeof p?.text === 'string') : null;
        const content = textPart?.text || parts?.[0]?.text || '';
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error('فشل في تحليل استجابة Gemini');
        // eslint-disable-next-line no-control-regex -- intentional: sanitises stray control bytes from model output before JSON.parse
        const sanitized = jsonMatch[0].replace(/[\x00-\x1F\x7F]/g, ' ');
        translations = JSON.parse(sanitized);
      }

      const result: Record<string, string> = {};
      const safeTranslations = translations ?? [];
      for (let i = 0; i < Math.min(protectedEntries.length, safeTranslations.length); i++) {
        if (safeTranslations[i] && safeTranslations[i].trim()) {
          const restored = restoreTags(safeTranslations[i], protectedEntries[i].tags);
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
      const lovableBody: Record<string, unknown> = {
        model: gatewayModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
      };
      if (strictJson) {
        lovableBody.tools = [openAITool];
        lovableBody.tool_choice = { type: 'function', function: { name: TOOL_NAME } };
      }
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(lovableBody),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('AI gateway error:', err);
        if (response.status === 402) throw new Error('انتهت نقاط الذكاء الاصطناعي — استخدم مفتاح Gemini الشخصي');
        if (response.status === 429) throw new Error('تم تجاوز حد الطلبات، حاول لاحقاً');
        throw new Error(`AI error: ${response.status}`);
      }

      data = await response.json();
      const lovableMessage = data?.choices?.[0]?.message;
      let translations: string[] | null = strictJson
        ? extractTranslationsFromOpenAITool(lovableMessage)
        : null;
      if (!translations) {
        const content = lovableMessage?.content || '';
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error('Failed to parse AI response');
        // eslint-disable-next-line no-control-regex -- intentional: sanitises stray control bytes from model output before JSON.parse
        const sanitized = jsonMatch[0].replace(/[\x00-\x1F\x7F]/g, ' ');
        translations = JSON.parse(sanitized);
      }

      const result: Record<string, string> = {};
      const safeTranslations = translations ?? [];
      for (let i = 0; i < Math.min(protectedEntries.length, safeTranslations.length); i++) {
        if (safeTranslations[i] && safeTranslations[i].trim()) {
          const restored = restoreTags(safeTranslations[i], protectedEntries[i].tags);
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
