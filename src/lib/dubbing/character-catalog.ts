// ============================================================
// Zelda TotK Voice Dubbing — Rich Character & Tone Catalog
// كل شخصية:
//   • صوت Gemini فريد (من قائمة الـ30 voice الرسمية)
//   • وصف شخصي يُحقن في الـ prompt
//   • نبرات أساسية حسب الدور + نبرات حصرية تطابق شخصيتها
// ============================================================

export type CharacterRole =
  | "hero" | "royalty" | "sage" | "villain" | "elder"
  | "child" | "warrior" | "scholar" | "merchant" | "monster"
  | "spirit" | "narrator" | "civilian";

export interface Tone {
  id: string;
  labelAr: string;
  prefix: string;
  voiceOverride?: string;
  category: "neutral" | "positive" | "negative" | "intense" | "subtle";
}

export interface Character {
  id: string;
  nameAr: string;
  nameEn: string;
  /** اسم صوت Gemini TTS الرسمي (من قائمة الـ30) */
  voice: string;
  /** ذكر أم أنثى — يُحقن في prompt لتفادي خطأ النوع */
  gender?: "male" | "female";
  gradient: string;
  emoji: string;
  role: CharacterRole;
  promptAr: string;
  /** نبرات حصرية لهذه الشخصية (تُضاف فوق نبرات الدور) */
  extraTones?: Tone[];
  /** نبرات لا تليق بهذه الشخصية */
  excludeTones?: string[];
}

// ============================================================
// قائمة أصوات Gemini TTS الرسمية الـ30 (للمرجع والتحقق)
// https://ai.google.dev/gemini-api/docs/speech-generation
// ============================================================
export const GEMINI_VOICES = [
  "Zephyr","Puck","Charon","Kore","Fenrir","Leda","Orus","Aoede",
  "Callirrhoe","Autonoe","Enceladus","Iapetus","Umbriel","Algieba",
  "Despina","Erinome","Algenib","Rasalgethi","Laomedeia","Achernar",
  "Alnilam","Schedar","Gacrux","Pulcherrima","Achird","Zubenelgenubi",
  "Vindemiatrix","Sadachbia","Sadaltager","Sulafat",
] as const;

// ── النبرات الأساسية المشتركة ───────────────────────────────
export const BASE_TONES: Tone[] = [
  { id: "neutral",     labelAr: "عادي",            category: "neutral",  prefix: "" },
  { id: "happy",       labelAr: "فرِح",            category: "positive", prefix: "بصوت فرحان مبتهج تتلألأ فيه السعادة، قل: " },
  { id: "calm",        labelAr: "هادئ",            category: "subtle",   prefix: "بصوت هادئ متأمل بطيء الإيقاع، قل: " },
  { id: "sad",         labelAr: "حزين",            category: "negative", prefix: "بصوت حزين مكسور تتسلل إليه الدموع، قل: " },
  { id: "lament",      labelAr: "رثاء",            category: "negative", prefix: "بصوت متهدج كأنك ترثي حبيباً فقدته للأبد، نَفَسُك ثقيل وكلماتك تخرج ببطء شديد ووجع عميق، قل: " },
  { id: "angry",       labelAr: "غاضب",            category: "intense",  prefix: "بصوت غاضب حاد تنفجر فيه الكلمات، قل: " },
  { id: "fearful",     labelAr: "خائف",            category: "negative", prefix: "بصوت خائف مرتجف متقطع الأنفاس، قل: " },
  { id: "whisper",     labelAr: "همس",             category: "subtle",   prefix: "بهمس خفيف سري كأنك تخاف أن يسمعك أحد، قل: " },
  { id: "shout",       labelAr: "صراخ",            category: "intense",  prefix: "بصوت عالٍ مرتفع كأنك تصرخ في معركة، قل: " },
  { id: "commanding",  labelAr: "آمِر",            category: "intense",  prefix: "بنبرة قائد آمر لا يُرَد، حازم وواضح، قل: " },
  { id: "mocking",     labelAr: "ساخر",            category: "negative", prefix: "بنبرة ساخرة مستهزئة فيها استعلاء، قل: " },
  { id: "surprised",   labelAr: "متفاجئ",          category: "intense",  prefix: "بصوت متفاجئ مذهول لم يصدق ما يسمع، قل: " },
];

export const VILLAIN_TONES: Tone[] = [
  { id: "evil",        labelAr: "شرير",            category: "intense",  prefix: "بصوت شرير منخفض يقطر تهديداً ووعيداً، قل: " },
  { id: "menacing",    labelAr: "مهيب مخيف",       category: "intense",  prefix: "بصوت مهيب مخيف جداً يجمد الدم في العروق، قل: " },
  { id: "evil_laugh",  labelAr: "ضحكة شريرة",      category: "intense",  prefix: "ابدأ بضحكة شريرة عميقة ثم قل بنبرة الانتصار المظلم: " },
];

export const REGAL_TONES: Tone[] = [
  { id: "regal",       labelAr: "ملكي مهيب",       category: "neutral",  prefix: "بهيبة ووقار ملكي عميق، قل ببطء وثقة: " },
  { id: "prophetic",   labelAr: "نبوي",            category: "subtle",   prefix: "بصوت نبوي قديم كأنك تكشف نبوءة آلاف السنين، قل ببطء شديد ووقار: " },
  { id: "wise",        labelAr: "حكيم",            category: "subtle",   prefix: "بحكمة عميقة وتأمل، كأن كل كلمة منحوتة من تجربة طويلة، قل: " },
];

export const HERO_TONES: Tone[] = [
  { id: "heroic",      labelAr: "بطولي",           category: "intense",  prefix: "بصوت بطولي شجاع مفعم بالعزيمة والأمل، قل: " },
  { id: "battle_cry",  labelAr: "صرخة معركة",      category: "intense",  prefix: "بصرخة حربية مدوية مليئة بالعزم، قل: " },
  { id: "encouraging", labelAr: "مشجِّع",          category: "positive", prefix: "بنبرة محفّزة دافئة تبعث الأمل في القلوب، قل: " },
];

export const PLAYFUL_TONES: Tone[] = [
  { id: "excited",     labelAr: "متحمس",           category: "positive", prefix: "بحماس وانفعال طفولي بريء، قل بسرعة وفرح: " },
  { id: "playful",     labelAr: "مرِح",            category: "positive", prefix: "بنبرة مرحة مبتسمة طفولية، قل: " },
  { id: "curious",     labelAr: "فضولي",           category: "subtle",   prefix: "بنبرة فضولية منبهرة بكل ما حولك، قل: " },
];

export const TRAGIC_TONES: Tone[] = [
  { id: "broken",      labelAr: "منكسر",           category: "negative", prefix: "بصوت منكسر تماماً كأن قلبك تحطم للتو، نَفَسُك متقطع، قل ببطء: " },
  { id: "tearful",     labelAr: "دامع",            category: "negative", prefix: "بصوت تخنقه العبرات، تحاول أن تتماسك لكنك تنهار، قل: " },
  { id: "nostalgic",   labelAr: "حنين",            category: "subtle",   prefix: "بصوت يفيض بالحنين لذكريات بعيدة جميلة ومؤلمة، قل بهدوء: " },
];

const ROLE_TONES: Record<CharacterRole, Tone[]> = {
  hero:      [...BASE_TONES, ...HERO_TONES, ...TRAGIC_TONES.slice(0, 2)],
  royalty:   [...BASE_TONES, ...REGAL_TONES, ...TRAGIC_TONES],
  sage:      [...BASE_TONES, ...REGAL_TONES, ...TRAGIC_TONES.slice(2)],
  villain:   [...BASE_TONES, ...VILLAIN_TONES],
  elder:     [...BASE_TONES, ...REGAL_TONES, ...TRAGIC_TONES],
  child:     [...BASE_TONES, ...PLAYFUL_TONES],
  warrior:   [...BASE_TONES, ...HERO_TONES],
  scholar:   [...BASE_TONES, ...PLAYFUL_TONES.slice(0, 2)],
  merchant:  [...BASE_TONES, ...PLAYFUL_TONES.slice(0, 2)],
  monster:   [...BASE_TONES, ...VILLAIN_TONES.slice(0, 2)],
  spirit:    [...BASE_TONES, ...REGAL_TONES, ...TRAGIC_TONES],
  narrator:  [...BASE_TONES, ...REGAL_TONES.slice(2)],
  civilian:  [...BASE_TONES],
};

export function getTonesForCharacter(c: Character): Tone[] {
  const fromRole = ROLE_TONES[c.role] ?? BASE_TONES;
  const merged = [...fromRole, ...(c.extraTones ?? [])];
  const excluded = new Set(c.excludeTones ?? []);
  const seen = new Set<string>();
  return merged.filter(t => {
    if (excluded.has(t.id)) return false;
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

// ============================================================
//   الكتالوج — كل شخصية بصوت Gemini فريد ونبرات مخصّصة لها
// ============================================================
export const CHARACTERS: Character[] = [
  // ── أبطال ───────────────────────────────────────────────
  { id: "link", nameAr: "لينك", nameEn: "Link", voice: "Puck", gender: "male", role: "hero",
    gradient: "from-green-500 to-emerald-600", emoji: "🗡️",
    promptAr: "أنت لينك بطل هايرول الصامت. صوتك شاب حازم هادئ تتكلم بإيجاز شديد وتركيز كامل، كلماتك قليلة لكنها تحمل عزماً لا يُكسر.",
    excludeTones: ["mocking", "evil_laugh"],
    extraTones: [
      { id: "link_focus", labelAr: "تركيز قتالي", category: "intense",
        prefix: "بصوت لينك المركّز قبل ضربة قاضية، نَفَسٌ ثابت ونبرة منخفضة حازمة، قل بكلمات قليلة: " },
      { id: "link_quiet", labelAr: "إيماءة صامتة", category: "subtle",
        prefix: "كأنك لينك يكتفي بإيماءة قصيرة، صوت خافت موجز بنبرة هادئة جداً، قل: " },
    ]},

  // ── ملوك وأميرات ────────────────────────────────────────
  { id: "zelda", nameAr: "زيلدا", nameEn: "Zelda", voice: "Kore", gender: "female", role: "royalty", gender: "female",
    gradient: "from-blue-500 to-purple-600", emoji: "🔮",
    promptAr: "أنتِ الأميرة زيلدا، أنثى شابة صاحبة الحكمة وراعية هايرول. صوتك أنثوي ملكي دافئ حازم يظهر فيه قوة هادئة لا تتزعزع.",
    extraTones: [
      { id: "lament_link", labelAr: "رثاء لينك", category: "negative",
        prefix: "بصوت زيلدا حزين متهدج كأنك تودعين لينك للمرة الأخيرة، نَفَسُك مكسور والكلمات تخرج ببطء شديد ووجع عميق، قولي: " },
      { id: "zelda_bloodmoon", labelAr: "تحذير القمر الأحمر", category: "intense",
        prefix: "بصوت زيلدا الأنثوي وهي تحذّر بقلق صادق ورهبة من ظهور القمر الأحمر، نبرة متوترة منخفضة مهيبة فيها رعشة خوف خفية وإحساس بقدوم شر قديم، تنفّس متباطئ بين الجمل، قولي ببطء بوقار: " },
      { id: "zelda_resolve", labelAr: "عزم الأميرة", category: "intense",
        prefix: "بنبرة زيلدا الحازمة في لحظة قرار مصيري، هدوء داخلي صلب كالحديد، قولي: " },
      { id: "zelda_dragon", labelAr: "تنّين الزمن", category: "subtle",
        prefix: "بصوت أثيري بعيد كأنه يأتي من عبر آلاف السنين بعد أن تحوّلت إلى تنّين النور، حزن أبدي هادئ، قولي ببطء: " },
    ]},
  { id: "rauru", nameAr: "راورو", nameEn: "Rauru", voice: "Orus", gender: "male", role: "royalty",
    gradient: "from-amber-500 to-yellow-600", emoji: "👑",
    promptAr: "أنت راورو الملك الأول لهايرول والحكيم الأبدي. صوتك قديم عميق تتكلم بثقة مطلقة وبساطة عميقة كأن كل كلمة تحمل ثقل آلاف السنين.",
    extraTones: [
      { id: "rauru_seal", labelAr: "ختم الضوء", category: "intense",
        prefix: "بصوت راورو في لحظة تضحيته الأخيرة لختم غانون، عزم نبيل ممزوج بسلام داخلي، قل ببطء: " },
      { id: "rauru_blessing", labelAr: "بركة", category: "positive",
        prefix: "بصوت ملك أزلي يبارك بطلاً جديراً، دفء ووقار يفيضان بالأمل، قل: " },
    ]},
  { id: "sonia", nameAr: "سونيا", nameEn: "Sonia", voice: "Aoede", gender: "female", role: "royalty",
    gradient: "from-rose-400 to-pink-500", emoji: "🌸",
    promptAr: "أنتِ الملكة سونيا زوجة راورو وحاملة قوة الزمن. صوتك دافئ ملكي فيه دفء أمومي يبعث على الطمأنينة.",
    extraTones: [
      { id: "sonia_motherly", labelAr: "حنان أمومي", category: "positive",
        prefix: "بصوت أمومي دافئ يطمئن قلب من يخاف، قولي بحنان: " },
    ]},
  { id: "king_dorephan", nameAr: "الملك دوريفان", nameEn: "Dorephan", voice: "Schedar", gender: "male", role: "royalty",
    gradient: "from-cyan-500 to-blue-700", emoji: "🧊",
    promptAr: "أنت الملك دوريفان ملك الزورا العجوز الحكيم. صوتك عميق ثقيل من كبر السن مليء بالحكمة، تتكلم ببطء ووقار ملكي.",
    extraTones: [
      { id: "dorephan_fatherly", labelAr: "أبوي", category: "positive",
        prefix: "بصوت ملك زورا ضخم يتكلم عن ابنه سيدون بحب أبوي وفخر، قل ببطء ووقار: " },
    ]},

  // ── أرواح وحكماء ────────────────────────────────────────
  { id: "mineru", nameAr: "مينيرو", nameEn: "Mineru", voice: "Vindemiatrix", gender: "female", role: "spirit",
    gradient: "from-violet-500 to-purple-700", emoji: "👻",
    promptAr: "أنتِ مينيرو حكيمة الروح وسليلة المعرفة الأبدية. صوتك قديم جداً هادئ، تتكلمين ببطء كأن كل كلمة تُنحت في الحجارة.",
    extraTones: [
      { id: "mineru_construct", labelAr: "روح في تمثال", category: "subtle",
        prefix: "بصوت روح حبيسة في تمثال قتالي قديم، نبرة معدنية بعيدة لكنها واعية، قولي ببطء: " },
    ]},
  { id: "deku_tree", nameAr: "شجرة ديكو", nameEn: "Deku Tree", voice: "Rasalgethi", gender: "male", role: "spirit",
    gradient: "from-green-600 to-emerald-800", emoji: "🌳",
    promptAr: "أنت شجرة ديكو العظيمة روح الغابة الأبدية. صوتك عميق ثقيل قديم جداً، تتكلم ببطء شديد وحكمة مطلقة.",
    extraTones: [
      { id: "deku_ancient", labelAr: "ذاكرة الغابة", category: "subtle",
        prefix: "بصوت شجرة ضاربة في القدم تستعيد ذكريات أحقاب بعيدة، نبرة بطيئة جداً ثقيلة بالحنين، قل: " },
    ]},
  { id: "hylia", nameAr: "هايليا", nameEn: "Hylia", voice: "Achernar", gender: "female", role: "spirit",
    gradient: "from-sky-300 to-indigo-500", emoji: "✨",
    promptAr: "أنتِ الإلهة هايلا حامية هايرول. صوتك أثيري دافئ بعيد كأنه يأتي من السماء، فيه قدسية وحنان.",
    extraTones: [
      { id: "hylia_divine", labelAr: "إلهي", category: "subtle",
        prefix: "بصوت إلهي أثيري يتردد صداه كأنه من السماوات، طمأنينة قدسية تشع نوراً، قولي ببطء: " },
    ]},

  // ── أشرار ───────────────────────────────────────────────
  { id: "ganon", nameAr: "غانوندورف", nameEn: "Ganondorf", voice: "Charon", gender: "male", role: "villain",
    gradient: "from-red-700 to-orange-900", emoji: "💀",
    promptAr: "أنت غانوندورف ملك الظلام والشر المطلق. صوتك عميق مهيب مخيف، تتكلم بطمأنينة مريبة وتهديد ضمني كأن كل كلمة تحمل لعنة أبدية.",
    extraTones: [
      { id: "ganon_demon_king", labelAr: "ملك الشياطين", category: "intense",
        prefix: "بصوت غانوندورف في صورته الكاملة كملك للشياطين، هدوء ثقيل يقطر ازدراءً مطلقاً للعالم، قل ببطء: " },
      { id: "ganon_taunt", labelAr: "استهزاء بلينك", category: "negative",
        prefix: "بنبرة غانوندورف الساخرة وهو يتفحص لينك الضعيف أمامه، استعلاء ملكي مرعب، قل: " },
    ]},
  { id: "kohga", nameAr: "كوهغا", nameEn: "Kohga", voice: "Algenib", gender: "male", role: "villain",
    gradient: "from-gray-600 to-slate-800", emoji: "🎭",
    promptAr: "أنت سيد كوهغا زعيم عصابة ياغا. صوتك درامي مسرحي مبالغ يمزج بين التهديد والكوميديا السوداء، تتفاخر بغطرسة.",
    extraTones: [
      { id: "kohga_brag", labelAr: "تفاخر مهرج", category: "negative",
        prefix: "بنبرة كوهغا المهرجة المسرحية وهو يتفاخر بمكره قبل أن يفشل بطريقة مضحكة، صوت مرتفع غبي الثقة، قل: " },
      { id: "kohga_panic", labelAr: "ذعر مضحك", category: "intense",
        prefix: "بصوت كوهغا حين تنقلب خطته فجأة، صراخ مذعور مبالغ به طفولي، قل: " },
    ]},
  { id: "phantom_ganon", nameAr: "شبح غانون", nameEn: "Phantom Ganon", voice: "Umbriel", gender: "male", role: "villain",
    gradient: "from-purple-900 to-black", emoji: "👤",
    promptAr: "أنت شبح غانون، نسخة مظلمة لا روح فيها. صوتك أجوف مرعب يأتي من العدم، يقطر شراً خالصاً.",
    extraTones: [
      { id: "phantom_hollow", labelAr: "صدى أجوف", category: "intense",
        prefix: "بصوت أجوف مرعب كأنه ينبعث من قاع بئر مظلم، بلا روح بلا تعاطف، قل ببطء مخيف: " },
    ]},
  { id: "yiga_soldier", nameAr: "جندي ياغا", nameEn: "Yiga", voice: "Algieba", gender: "male", role: "villain",
    gradient: "from-red-500 to-rose-700", emoji: "🥷",
    promptAr: "أنت جندي من عصابة ياغا. صوتك ماكر متعجرف مليء بالاستهزاء، تظن نفسك أذكى من ضحيتك.",
    extraTones: [
      { id: "yiga_reveal", labelAr: "كشف الهوية", category: "intense",
        prefix: "بنبرة جندي ياغا وهو يكشف فجأة عن هويته بعد تمثيل دور بريء، انتقال صادم من اللطف إلى الخبث، قل: " },
    ]},

  // ── حكماء أربعة ─────────────────────────────────────────
  { id: "sidon", nameAr: "سيدون", nameEn: "Sidon", voice: "Fenrir", gender: "male", role: "hero",
    gradient: "from-blue-400 to-teal-500", emoji: "🐟",
    promptAr: "أنت الأمير سيدون حكيم الماء وأمير الزورا. صوتك بطولي ودود قوي مشرق، دائماً تنشر الأمل وتشجع.",
    extraTones: [
      { id: "sidon_cheer", labelAr: "تشجيع سيدون", category: "positive",
        prefix: "بحماس سيدون الأسطوري وهو يهتف لصديقه لينك، صوت مرتفع مشرق مفعم بالإيمان المطلق، قل: " },
      { id: "sidon_royal", labelAr: "أمير الزورا", category: "intense",
        prefix: "بنبرة الأمير سيدون الرسمية حين يتحدث باسم شعب الزورا، وقار شاب ممزوج بقوة، قل: " },
    ]},
  { id: "yunobo", nameAr: "يونوبو", nameEn: "Yunobo", voice: "Gacrux", gender: "male", role: "hero",
    gradient: "from-orange-500 to-red-600", emoji: "🔥",
    promptAr: "أنت يونوبو حكيم النار وبطل الغورون. صوتك كبير حيوي دافئ مع طيبة ساذجة، قلبك طيب كالذهب.",
    extraTones: [
      { id: "yunobo_shy", labelAr: "خجل يونوبو", category: "subtle",
        prefix: "بصوت يونوبو الكبير وهو يتلعثم بخجل ساذج طيب، نبرة دافئة مترددة، قل: " },
      { id: "yunobo_roll", labelAr: "هجمة كرة النار", category: "intense",
        prefix: "بهتاف غورون قبل أن يتحوّل إلى كرة نارية مندفعة، طاقة منفجرة جذلى، قل: " },
    ]},
  { id: "tulin", nameAr: "تولين", nameEn: "Tulin", voice: "Achird", gender: "male", role: "child",
    gradient: "from-sky-400 to-blue-500", emoji: "🦅",
    promptAr: "أنت تولين حكيم الريح وشاب الريكو الشجاع. صوتك طفولي حيوي متحمس بطاقة مفرطة وشجاعة بريئة.",
    extraTones: [
      { id: "tulin_brave", labelAr: "شجاعة الفتى", category: "intense",
        prefix: "بصوت تولين الصغير وهو يحاول أن يبدو شجاعاً كأبيه تيبا رغم خوفه الداخلي، نبرة طفولية تحاول التحلي بالصلابة، قل: " },
      { id: "tulin_wind", labelAr: "رفقة الرياح", category: "positive",
        prefix: "بحماس صبي يطير على جناح الرياح للمرة الأولى، صوت فرحان مذهول، قل: " },
    ]},
  { id: "riju", nameAr: "ريجو", nameEn: "Riju", voice: "Pulcherrima", gender: "female", role: "warrior",
    gradient: "from-yellow-400 to-amber-600", emoji: "⚡",
    promptAr: "أنتِ ريجو زعيمة الغيرودو وحكيمة الرعد. صوتك قوي حازم مليء بالشجاعة، تحملين ثقل قومك بثقة قائدة.",
    extraTones: [
      { id: "riju_chief", labelAr: "زعيمة الغيرودو", category: "intense",
        prefix: "بنبرة ريجو الرسمية أمام شعب الغيرودو، صوت شابة تحمل تاج جيل كامل بصلابة لا تتزعزع، قولي: " },
      { id: "riju_thunder", labelAr: "حكمة الرعد", category: "intense",
        prefix: "بصوت ريجو وهي تستدعي قوة الرعد المقدّسة، تركيز حاد ونبرة آمرة، قولي: " },
    ]},

  // ── الدعم ──────────────────────────────────────────────
  { id: "impa", nameAr: "إمبا", nameEn: "Impa", voice: "Sulafat", gender: "female", role: "elder",
    gradient: "from-red-400 to-pink-600", emoji: "⚔️",
    promptAr: "أنتِ إمبا الحكيمة حارسة الأسرار. صوتك قوي رزين حازم دون تردد، تتكلمين بجدية من رأت الكثير.",
    extraTones: [
      { id: "impa_sheikah", labelAr: "أسرار الشيكا", category: "subtle",
        prefix: "بصوت إمبا حارسة أسرار قبيلة الشيكا منذ قرون، حكمة هامسة موزونة، قولي ببطء: " },
    ]},
  { id: "purah", nameAr: "بورا", nameEn: "Purah", voice: "Leda", gender: "female", role: "scholar",
    gradient: "from-teal-400 to-cyan-600", emoji: "🔬",
    promptAr: "أنتِ بورا العالِمة العبقرية. صوتك حيوي متحمس لا يهدأ، تتكلمين بسرعة وفضول دائم وكل اكتشاف يثير حماسك.",
    extraTones: [
      { id: "purah_eureka", labelAr: "لحظة اكتشاف", category: "intense",
        prefix: "بصراخ بورا الجذل عند اكتشاف علمي مذهل، صوت مرتفع منفجر بالحماس، قولي بسرعة: " },
      { id: "purah_lecture", labelAr: "شرح علمي", category: "neutral",
        prefix: "بنبرة بورا وهي تشرح اكتشافها بسرعة، حماس متدفق وحب للتفاصيل التقنية، قولي: " },
    ]},
  { id: "robbie", nameAr: "روبي", nameEn: "Robbie", voice: "Sadaltager", role: "scholar",
    gradient: "from-amber-400 to-orange-500", emoji: "🤖",
    promptAr: "أنت روبي العالم الغريب الأطوار. صوتك حماسي مهووس بالتقنية، تتحدث بسرعة وانبهار طفولي بالاختراعات.",
    extraTones: [
      { id: "robbie_tech", labelAr: "هوس التقنية", category: "intense",
        prefix: "بصوت روبي المهووس وهو يصف اختراعاً عجيباً بانبهار طفولي صاخب، قل بسرعة: " },
    ]},
  { id: "josha", nameAr: "جوشا", nameEn: "Josha", voice: "Enceladus", role: "scholar",
    gradient: "from-purple-400 to-pink-500", emoji: "🔍",
    promptAr: "أنتِ جوشا الباحثة الشابة المهووسة بأسرار الأعماق. صوتك خافت متحمس، تتكلمين بفضول لا ينتهي.",
    extraTones: [
      { id: "josha_depths", labelAr: "همس الأعماق", category: "subtle",
        prefix: "بصوت جوشا الخافت المتحمس وهي تروي قصصاً مرعبة عن الأعماق، همس ممزوج بانبهار، قولي: " },
    ]},
  { id: "teba", nameAr: "تيبا", nameEn: "Teba", voice: "Alnilam", role: "warrior",
    gradient: "from-indigo-400 to-blue-600", emoji: "🏹",
    promptAr: "أنت تيبا المحارب الريكو الأسطوري. صوتك جاد حازم صارم لا مزاح فيه، كلماتك كالسهام مباشرة ودقيقة.",
    extraTones: [
      { id: "teba_father", labelAr: "أبٌ صارم", category: "neutral",
        prefix: "بصوت تيبا الجاد وهو يدرّب ابنه تولين بصرامة محبّة، نبرة موجزة حاسمة، قل: " },
    ]},
  { id: "paya", nameAr: "بايا", nameEn: "Paya", voice: "Despina", role: "civilian",
    gradient: "from-pink-300 to-rose-500", emoji: "💗",
    promptAr: "أنتِ بايا الخجولة من قرية كاكاريكو. صوتك خفيض متلعثم عند التوتر، فيه براءة وحياء واضح.",
    extraTones: [
      { id: "paya_blush", labelAr: "احمرار خجل", category: "subtle",
        prefix: "بصوت بايا المتلعثم الخجول حين تجد لينك ينظر إليها، نبرة مرتعشة خفيضة بريئة، قولي: " },
    ]},
  { id: "kass", nameAr: "كاس", nameEn: "Kass", voice: "Iapetus", role: "merchant",
    gradient: "from-blue-600 to-indigo-800", emoji: "🪗",
    promptAr: "أنت كاس الشاعر الريكو وعازف الأكورديون. صوتك دافئ موسيقي عميق، تتكلم بإيقاع كأنك على وشك الغناء.",
    extraTones: [
      { id: "kass_song", labelAr: "ترتيل قصيدة", category: "subtle",
        prefix: "بصوت كاس الموسيقي العميق وهو يلقي قصيدة قديمة بإيقاع بطيء كأنها أغنية، نبرة دافئة، قل: " },
      { id: "kass_riddle", labelAr: "لغز شاعري", category: "subtle",
        prefix: "بنبرة كاس وهو يلقي لغزاً غامضاً بصوت مرح ينطوي على سر، قل: " },
    ]},
  { id: "beedle", nameAr: "بيدل", nameEn: "Beedle", voice: "Laomedeia", role: "merchant",
    gradient: "from-yellow-500 to-orange-600", emoji: "🎒",
    promptAr: "أنت بيدل التاجر الجوّال المرح. صوتك حيوي ودود مفعم بالحماس لكل صفقة، تتكلم بسرعة وابتسامة دائمة.",
    extraTones: [
      { id: "beedle_sale", labelAr: "ترويج صفقة", category: "positive",
        prefix: "بنبرة بيدل المتحمسة وهو يعرض بضاعته الفاخرة بحماس تاجر بارع، صوت مرتفع ودود، قل بسرعة: " },
    ]},
  { id: "hestu", nameAr: "هيستو", nameEn: "Hestu", voice: "Sadachbia", role: "child",
    gradient: "from-lime-400 to-green-500", emoji: "🎵",
    promptAr: "أنت هيستو كوروك راقص المَرَّاسين. صوتك فرحان مرح طفولي ساذج بشكل لا يصدق، شاكابكاكا!",
    extraTones: [
      { id: "hestu_dance", labelAr: "رقصة المراسين", category: "positive",
        prefix: "بصوت هيستو الفرحان وهو يرقص بمراسينه، نبرة طفولية مغناة شاكابكاكا، قل بمرح: " },
    ]},
  { id: "addison", nameAr: "أديسون", nameEn: "Addison", voice: "Zubenelgenubi", role: "civilian",
    gradient: "from-emerald-400 to-teal-600", emoji: "📋",
    promptAr: "أنت أديسون موظف هادسون لِلبناء. صوتك مرهق متعب لكنه مخلص، تطلب المساعدة بإلحاح ولطف.",
    extraTones: [
      { id: "addison_plea", labelAr: "نداء استغاثة", category: "negative",
        prefix: "بصوت أديسون المنهك وهو يتوسل المساعدة لتثبيت تمثال رئيسه قبل أن يسقط، إلحاح مهذب يائس، قل: " },
    ]},
  { id: "hudson", nameAr: "هادسون", nameEn: "Hudson", voice: "Callirrhoe", role: "civilian",
    gradient: "from-stone-500 to-amber-700", emoji: "🔨",
    promptAr: "أنت هادسون البنّاء الكبير. صوتك دافئ قوي ودود، مفعم بحب البناء والعائلة.",
    extraTones: [
      { id: "hudson_proud", labelAr: "فخر البنّاء", category: "positive",
        prefix: "بصوت هادسون الفخور وهو يتأمل مدينة بناها بيديه، دفء وثقة قوية، قل: " },
    ]},
  { id: "rhondson", nameAr: "روندسون", nameEn: "Rhondson", voice: "Autonoe", role: "civilian",
    gradient: "from-yellow-300 to-amber-500", emoji: "👗",
    promptAr: "أنتِ روندسون من قبيلة الغيرودو زوجة هادسون. صوتك حازم ودافئ، تتكلمين بثقة وقوة.",
    extraTones: [
      { id: "rhondson_design", labelAr: "حماس مصمّمة", category: "positive",
        prefix: "بنبرة روندسون المتحمسة وهي تصف فستاناً صممته للتو بفخر فنان، قولي: " },
    ]},
  { id: "penn", nameAr: "بِن", nameEn: "Penn", voice: "Erinome", role: "civilian",
    gradient: "from-violet-400 to-purple-600", emoji: "📰",
    promptAr: "أنت بِن المراسل الريكو الشاب. صوتك حيوي شغوف بالصحافة، تتكلم بسرعة عاشق الأخبار.",
    extraTones: [
      { id: "penn_scoop", labelAr: "سبق صحفي", category: "intense",
        prefix: "بصوت بِن المتحمس وهو يطارد سبقاً صحفياً مذهلاً، نبرة سريعة شغوفة، قل: " },
    ]},
  { id: "tauro", nameAr: "تاورو", nameEn: "Tauro", voice: "Sadaltager", role: "scholar",
    gradient: "from-amber-600 to-orange-700", emoji: "📜",
    promptAr: "أنت تاورو عالم الآثار من الغيرودو. صوتك جاد مفكر مفتون بأسرار الزوناي القدماء.",
    excludeTones: ["playful"]},
  { id: "kilton", nameAr: "كيلتون", nameEn: "Kilton", voice: "Algenib", role: "merchant",
    gradient: "from-purple-700 to-slate-900", emoji: "🌙",
    promptAr: "أنت كيلتون التاجر الغريب الأطوار عاشق الوحوش. صوتك مهموس غريب فيه شغف مرعب بالمخلوقات.",
    extraTones: [
      { id: "kilton_creepy", labelAr: "هوس الوحوش", category: "negative",
        prefix: "بصوت كيلتون المهموس الغريب وهو يصف وحشاً نادراً بشغف مرعب، نبرة منخفضة محبّة للظلام، قل ببطء: " },
    ]},

  // ── راوي وعموم ─────────────────────────────────────────
  { id: "narrator", nameAr: "الراوي", nameEn: "Narrator", voice: "Rasalgethi", gender: "male", role: "narrator",
    gradient: "from-slate-500 to-gray-600", emoji: "📖",
    promptAr: "أنت الراوي الملحمي لعالم هايرول. صوتك رزين واضح مهيب، تحكي القصة بوقار وعمق وغموض.",
    extraTones: [
      { id: "narrator_epic", labelAr: "افتتاحية ملحمية", category: "intense",
        prefix: "بصوت راوٍ ملحمي يفتتح أسطورة عظيمة، نبرة مهيبة بطيئة موزونة كأنها من فيلم سينمائي، قل: " },
    ]},
  { id: "npc_m", nameAr: "مواطن", nameEn: "Citizen (M)", voice: "Iapetus", role: "civilian",
    gradient: "from-orange-400 to-yellow-500", emoji: "👨",
    promptAr: "أنت مواطن عادي من هايرول. صوتك طبيعي دافئ بسيط، تتكلم بعفوية." },
  { id: "npc_f", nameAr: "مواطنة", nameEn: "Citizen (F)", voice: "Zubenelgenubi", role: "civilian",
    gradient: "from-violet-400 to-purple-500", emoji: "👩",
    promptAr: "أنتِ مواطنة عادية من هايرول. صوتك طبيعي لطيف ودود، تتكلمين بعفوية وبساطة." },
  { id: "child_m", nameAr: "طفل", nameEn: "Child (M)", voice: "Puck", role: "child",
    gradient: "from-sky-300 to-blue-400", emoji: "🧒",
    promptAr: "أنت طفل صغير من هايرول. صوتك بريء حيوي مليء بالطاقة والفضول." },
  { id: "child_f", nameAr: "طفلة", nameEn: "Child (F)", voice: "Leda", role: "child",
    gradient: "from-pink-300 to-rose-400", emoji: "👧",
    promptAr: "أنتِ طفلة صغيرة من هايرول. صوتك بريء عذب مليء بالضحك والمرح." },
  { id: "monster", nameAr: "وحش", nameEn: "Monster", voice: "Charon", role: "monster",
    gradient: "from-red-900 to-black", emoji: "👹",
    promptAr: "أنت وحش من وحوش هايرول. صوتك أجش مرعب غير بشري، تخرج كلمات قليلة بصوت غاضب.",
    extraTones: [
      { id: "monster_growl", labelAr: "هدير", category: "intense",
        prefix: "بصوت وحش يهدر هديراً غير بشري، نبرة أجش غاضبة موجزة، قل: " },
    ]},
];

export function findCharacter(id: string): Character | undefined {
  return CHARACTERS.find(c => c.id === id);
}

/** يتحقق أن صوت الشخصية ضمن قائمة Gemini الرسمية */
export function isValidGeminiVoice(v: string): boolean {
  return (GEMINI_VOICES as readonly string[]).includes(v);
}

export const ROLE_LABELS: Record<CharacterRole, string> = {
  hero:      "أبطال",
  royalty:   "ملوك وأميرات",
  sage:      "حكماء",
  villain:   "أشرار",
  elder:     "كبار السن",
  child:     "أطفال",
  warrior:   "محاربون",
  scholar:   "علماء",
  merchant:  "تجار",
  monster:   "وحوش",
  spirit:    "أرواح",
  narrator:  "روّاة",
  civilian:  "مواطنون",
};
