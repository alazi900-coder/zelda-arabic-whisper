// ============================================================
// Zelda TotK Voice Dubbing — Rich Character & Tone Catalog
// كل شخصية لها صوت Gemini أساسي + مجموعة نبرات (tones) خاصة بطبيعتها
// ============================================================

export type CharacterRole =
  | "hero" | "royalty" | "sage" | "villain" | "elder"
  | "child" | "warrior" | "scholar" | "merchant" | "monster"
  | "spirit" | "narrator" | "civilian";

export interface Tone {
  id: string;
  labelAr: string;
  /** يُسبق به النص المرسل لـ Gemini TTS لتوجيه الأداء */
  prefix: string;
  /** نبرة استثنائية تستبدل صوت الشخصية (نادر) */
  voiceOverride?: string;
  /** فئة عاطفية لتلوين الواجهة */
  category: "neutral" | "positive" | "negative" | "intense" | "subtle";
}

export interface Character {
  id: string;
  nameAr: string;
  nameEn: string;
  voice: string;
  gradient: string;
  emoji: string;
  role: CharacterRole;
  /** وصف الشخصية الأساسي يُحقَن في كل prompt */
  promptAr: string;
  /** نبرات خاصة بهذه الشخصية فقط (تُضاف فوق نبرات الدور) */
  extraTones?: Tone[];
  /** نبرات نريد إخفاءها لهذه الشخصية (مثلاً: لينك لا يضحك بشدة) */
  excludeTones?: string[];
}

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

// نبرات خاصة بالأشرار
export const VILLAIN_TONES: Tone[] = [
  { id: "evil",        labelAr: "شرير",            category: "intense",  prefix: "بصوت شرير منخفض يقطر تهديداً ووعيداً، قل: " },
  { id: "menacing",    labelAr: "مهيب مخيف",       category: "intense",  prefix: "بصوت مهيب مخيف جداً يجمد الدم في العروق، قل: " },
  { id: "evil_laugh",  labelAr: "ضحكة شريرة",      category: "intense",  prefix: "ابدأ بضحكة شريرة عميقة ثم قل بنبرة الانتصار المظلم: " },
];

// نبرات خاصة بالملوك والحكماء
export const REGAL_TONES: Tone[] = [
  { id: "regal",       labelAr: "ملكي مهيب",       category: "neutral",  prefix: "بهيبة ووقار ملكي عميق، قل ببطء وثقة: " },
  { id: "prophetic",   labelAr: "نبوي",            category: "subtle",   prefix: "بصوت نبوي قديم كأنك تكشف نبوءة آلاف السنين، قل ببطء شديد ووقار: " },
  { id: "wise",        labelAr: "حكيم",            category: "subtle",   prefix: "بحكمة عميقة وتأمل، كأن كل كلمة منحوتة من تجربة طويلة، قل: " },
];

// نبرات خاصة بالأبطال
export const HERO_TONES: Tone[] = [
  { id: "heroic",      labelAr: "بطولي",           category: "intense",  prefix: "بصوت بطولي شجاع مفعم بالعزيمة والأمل، قل: " },
  { id: "battle_cry",  labelAr: "صرخة معركة",      category: "intense",  prefix: "بصرخة حربية مدوية مليئة بالعزم، قل: " },
  { id: "encouraging", labelAr: "مشجِّع",          category: "positive", prefix: "بنبرة محفّزة دافئة تبعث الأمل في القلوب، قل: " },
];

// نبرات خاصة بالأطفال والمرحين
export const PLAYFUL_TONES: Tone[] = [
  { id: "excited",     labelAr: "متحمس",           category: "positive", prefix: "بحماس وانفعال طفولي بريء، قل بسرعة وفرح: " },
  { id: "playful",     labelAr: "مرِح",            category: "positive", prefix: "بنبرة مرحة مبتسمة طفولية، قل: " },
  { id: "curious",     labelAr: "فضولي",           category: "subtle",   prefix: "بنبرة فضولية منبهرة بكل ما حولك، قل: " },
];

// نبرات خاصة بالحزن العميق والرثاء
export const TRAGIC_TONES: Tone[] = [
  { id: "broken",      labelAr: "منكسر",           category: "negative", prefix: "بصوت منكسر تماماً كأن قلبك تحطم للتو، نَفَسُك متقطع، قل ببطء: " },
  { id: "tearful",     labelAr: "دامع",            category: "negative", prefix: "بصوت تخنقه العبرات، تحاول أن تتماسك لكنك تنهار، قل: " },
  { id: "nostalgic",   labelAr: "حنين",            category: "subtle",   prefix: "بصوت يفيض بالحنين لذكريات بعيدة جميلة ومؤلمة، قل بهدوء: " },
];

// خرائط النبرات حسب الدور
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

/** يُرجع كامل النبرات المتاحة لشخصية معيّنة */
export function getTonesForCharacter(c: Character): Tone[] {
  const fromRole = ROLE_TONES[c.role] ?? BASE_TONES;
  const merged = [...fromRole, ...(c.extraTones ?? [])];
  const excluded = new Set(c.excludeTones ?? []);
  // إزالة المكرّر بحسب id والاحتفاظ بأول ظهور
  const seen = new Set<string>();
  return merged.filter(t => {
    if (excluded.has(t.id)) return false;
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

// ============================================================
//                       الكتالوج
// ============================================================
export const CHARACTERS: Character[] = [
  // ── الأبطال ─────────────────────────────────────────────
  { id: "link", nameAr: "لينك", nameEn: "Link", voice: "Puck", role: "hero",
    gradient: "from-green-500 to-emerald-600", emoji: "🗡️",
    promptAr: "أنت لينك بطل هايرول الصامت. صوتك شاب حازم هادئ تتكلم بإيجاز شديد وتركيز كامل، كلماتك قليلة لكنها تحمل عزماً لا يُكسر.",
    excludeTones: ["mocking", "evil_laugh"] },

  // ── الأميرات والملوك ────────────────────────────────────
  { id: "zelda", nameAr: "زيلدا", nameEn: "Zelda", voice: "Kore", role: "royalty",
    gradient: "from-blue-500 to-purple-600", emoji: "🔮",
    promptAr: "أنتِ الأميرة زيلدا صاحبة الحكمة وراعية هايرول. صوتك ملكي دافئ حازم يظهر فيه قوة هادئة لا تتزعزع.",
    extraTones: [
      { id: "lament_link", labelAr: "رثاء لينك", category: "negative",
        prefix: "بصوت زيلدا حزين متهدج كأنك تودعين لينك للمرة الأخيرة، نَفَسُك مكسور والكلمات تخرج ببطء شديد ووجع عميق، قولي: " },
    ]},
  { id: "rauru", nameAr: "راورو", nameEn: "Rauru", voice: "Orus", role: "royalty",
    gradient: "from-amber-500 to-yellow-600", emoji: "👑",
    promptAr: "أنت راورو الملك الأول لهايرول والحكيم الأبدي. صوتك قديم عميق تتكلم بثقة مطلقة وبساطة عميقة كأن كل كلمة تحمل ثقل آلاف السنين." },
  { id: "sonia", nameAr: "سونيا", nameEn: "Sonia", voice: "Aoede", role: "royalty",
    gradient: "from-rose-400 to-pink-500", emoji: "🌸",
    promptAr: "أنتِ الملكة سونيا زوجة راورو وحاملة قوة الزمن. صوتك دافئ ملكي فيه دفء أمومي يبعث على الطمأنينة." },
  { id: "king_dorephan", nameAr: "الملك دوريفان", nameEn: "Dorephan", voice: "Schedar", role: "royalty",
    gradient: "from-cyan-500 to-blue-700", emoji: "🧊",
    promptAr: "أنت الملك دوريفان ملك الزورا العجوز الحكيم. صوتك عميق ثقيل من كبر السن مليء بالحكمة، تتكلم ببطء ووقار ملكي." },

  // ── الحكماء والأرواح ────────────────────────────────────
  { id: "mineru", nameAr: "مينيرو", nameEn: "Mineru", voice: "Vindemiatrix", role: "spirit",
    gradient: "from-violet-500 to-purple-700", emoji: "👻",
    promptAr: "أنتِ مينيرو حكيمة الروح وسليلة المعرفة الأبدية. صوتك قديم جداً هادئ، تتكلمين ببطء كأن كل كلمة تُنحت في الحجارة." },
  { id: "deku_tree", nameAr: "شجرة ديكو", nameEn: "Deku Tree", voice: "Rasalgheti", role: "spirit",
    gradient: "from-green-600 to-emerald-800", emoji: "🌳",
    promptAr: "أنت شجرة ديكو العظيمة روح الغابة الأبدية. صوتك عميق ثقيل قديم جداً، تتكلم ببطء شديد وحكمة مطلقة." },
  { id: "hylia", nameAr: "هايليا", nameEn: "Hylia", voice: "Achernar", role: "spirit",
    gradient: "from-sky-300 to-indigo-500", emoji: "✨",
    promptAr: "أنتِ الإلهة هايلا حامية هايرول. صوتك أثيري دافئ بعيد كأنه يأتي من السماء، فيه قدسية وحنان." },

  // ── الأشرار ─────────────────────────────────────────────
  { id: "ganon", nameAr: "غانوندورف", nameEn: "Ganondorf", voice: "Charon", role: "villain",
    gradient: "from-red-700 to-orange-900", emoji: "💀",
    promptAr: "أنت غانوندورف ملك الظلام والشر المطلق. صوتك عميق مهيب مخيف، تتكلم بطمأنينة مريبة وتهديد ضمني كأن كل كلمة تحمل لعنة أبدية." },
  { id: "kohga", nameAr: "كوهغا", nameEn: "Kohga", voice: "Elspeth", role: "villain",
    gradient: "from-gray-600 to-slate-800", emoji: "🎭",
    promptAr: "أنت سيد كوهغا زعيم عصابة ياغا. صوتك درامي مسرحي مبالغ يمزج بين التهديد والكوميديا السوداء، تتفاخر بغطرسة." },
  { id: "phantom_ganon", nameAr: "شبح غانون", nameEn: "Phantom Ganon", voice: "Algieba", role: "villain",
    gradient: "from-purple-900 to-black", emoji: "👤",
    promptAr: "أنت شبح غانون، نسخة مظلمة لا روح فيها. صوتك أجوف مرعب يأتي من العدم، يقطر شراً خالصاً." },
  { id: "yiga_soldier", nameAr: "جندي ياغا", nameEn: "Yiga", voice: "Algieba", role: "villain",
    gradient: "from-red-500 to-rose-700", emoji: "🥷",
    promptAr: "أنت جندي من عصابة ياغا. صوتك ماكر متعجرف مليء بالاستهزاء، تظن نفسك أذكى من ضحيتك." },

  // ── الحكماء الأربعة ─────────────────────────────────────
  { id: "sidon", nameAr: "سيدون", nameEn: "Sidon", voice: "Fenrir", role: "hero",
    gradient: "from-blue-400 to-teal-500", emoji: "🐟",
    promptAr: "أنت الأمير سيدون حكيم الماء وأمير الزورا. صوتك بطولي ودود قوي مشرق، دائماً تنشر الأمل وتشجع." },
  { id: "yunobo", nameAr: "يونوبو", nameEn: "Yunobo", voice: "Gacrux", role: "hero",
    gradient: "from-orange-500 to-red-600", emoji: "🔥",
    promptAr: "أنت يونوبو حكيم النار وبطل الغورون. صوتك كبير حيوي دافئ مع طيبة ساذجة، قلبك طيب كالذهب." },
  { id: "tulin", nameAr: "تولين", nameEn: "Tulin", voice: "Achird", role: "child",
    gradient: "from-sky-400 to-blue-500", emoji: "🦅",
    promptAr: "أنت تولين حكيم الريح وشاب الريكو الشجاع. صوتك طفولي حيوي متحمس بطاقة مفرطة وشجاعة بريئة." },
  { id: "riju", nameAr: "ريجو", nameEn: "Riju", voice: "Zephyr", role: "warrior",
    gradient: "from-yellow-400 to-amber-600", emoji: "⚡",
    promptAr: "أنتِ ريجو زعيمة الغيرودو وحكيمة الرعد. صوتك قوي حازم مليء بالشجاعة، تحملين ثقل قومك بثقة قائدة." },

  // ── الشخصيات الداعمة ───────────────────────────────────
  { id: "impa", nameAr: "إمبا", nameEn: "Impa", voice: "Sulafat", role: "elder",
    gradient: "from-red-400 to-pink-600", emoji: "⚔️",
    promptAr: "أنتِ إمبا الحكيمة حارسة الأسرار. صوتك قوي رزين حازم دون تردد، تتكلمين بجدية من رأت الكثير." },
  { id: "purah", nameAr: "بورا", nameEn: "Purah", voice: "Leda", role: "scholar",
    gradient: "from-teal-400 to-cyan-600", emoji: "🔬",
    promptAr: "أنتِ بورا العالِمة العبقرية. صوتك حيوي متحمس لا يهدأ، تتكلمين بسرعة وفضول دائم وكل اكتشاف يثير حماسك." },
  { id: "robbie", nameAr: "روبي", nameEn: "Robbie", voice: "Algenib", role: "scholar",
    gradient: "from-amber-400 to-orange-500", emoji: "🤖",
    promptAr: "أنت روبي العالم الغريب الأطوار. صوتك حماسي مهووس بالتقنية، تتحدث بسرعة وانبهار طفولي بالاختراعات." },
  { id: "josha", nameAr: "جوشا", nameEn: "Josha", voice: "Aoede", role: "scholar",
    gradient: "from-purple-400 to-pink-500", emoji: "🔍",
    promptAr: "أنتِ جوشا الباحثة الشابة المهووسة بأسرار الأعماق. صوتك خافت متحمس، تتكلمين بفضول لا ينتهي." },
  { id: "teba", nameAr: "تيبا", nameEn: "Teba", voice: "Alnilam", role: "warrior",
    gradient: "from-indigo-400 to-blue-600", emoji: "🏹",
    promptAr: "أنت تيبا المحارب الريكو الأسطوري. صوتك جاد حازم صارم لا مزاح فيه، كلماتك كالسهام مباشرة ودقيقة." },
  { id: "paya", nameAr: "بايا", nameEn: "Paya", voice: "Aoede", role: "civilian",
    gradient: "from-pink-300 to-rose-500", emoji: "💗",
    promptAr: "أنتِ بايا الخجولة من قرية كاكاريكو. صوتك خفيض متلعثم عند التوتر، فيه براءة وحياء واضح." },
  { id: "kass", nameAr: "كاس", nameEn: "Kass", voice: "Iapetus", role: "merchant",
    gradient: "from-blue-600 to-indigo-800", emoji: "🪗",
    promptAr: "أنت كاس الشاعر الريكو وعازف الأكورديون. صوتك دافئ موسيقي عميق، تتكلم بإيقاع كأنك على وشك الغناء." },
  { id: "beedle", nameAr: "بيدل", nameEn: "Beedle", voice: "Algenib", role: "merchant",
    gradient: "from-yellow-500 to-orange-600", emoji: "🎒",
    promptAr: "أنت بيدل التاجر الجوّال المرح. صوتك حيوي ودود مفعم بالحماس لكل صفقة، تتكلم بسرعة وابتسامة دائمة." },
  { id: "hestu", nameAr: "هيستو", nameEn: "Hestu", voice: "Sadachbia", role: "child",
    gradient: "from-lime-400 to-green-500", emoji: "🎵",
    promptAr: "أنت هيستو كوروك راقص المَرَّاسين. صوتك فرحان مرح طفولي ساذج بشكل لا يصدق، شاكابكاكا!" },
  { id: "addison", nameAr: "أديسون", nameEn: "Addison", voice: "Algenib", role: "civilian",
    gradient: "from-emerald-400 to-teal-600", emoji: "📋",
    promptAr: "أنت أديسون موظف هادسون لِلبناء. صوتك مرهق متعب لكنه مخلص، تطلب المساعدة بإلحاح ولطف." },
  { id: "hudson", nameAr: "هادسون", nameEn: "Hudson", voice: "Orus", role: "civilian",
    gradient: "from-stone-500 to-amber-700", emoji: "🔨",
    promptAr: "أنت هادسون البنّاء الكبير. صوتك دافئ قوي ودود، مفعم بحب البناء والعائلة." },
  { id: "rhondson", nameAr: "روندسون", nameEn: "Rhondson", voice: "Sulafat", role: "civilian",
    gradient: "from-yellow-300 to-amber-500", emoji: "👗",
    promptAr: "أنتِ روندسون من قبيلة الغيرودو زوجة هادسون. صوتك حازم ودافئ، تتكلمين بثقة وقوة." },
  { id: "penn", nameAr: "بِن", nameEn: "Penn", voice: "Achird", role: "civilian",
    gradient: "from-violet-400 to-purple-600", emoji: "📰",
    promptAr: "أنت بِن المراسل الريكو الشاب. صوتك حيوي شغوف بالصحافة، تتكلم بسرعة عاشق الأخبار." },
  { id: "tauro", nameAr: "تاورو", nameEn: "Tauro", voice: "Iapetus", role: "scholar",
    gradient: "from-amber-600 to-orange-700", emoji: "📜",
    promptAr: "أنت تاورو عالم الآثار من الغيرودو. صوتك جاد مفكر مفتون بأسرار الزوناي القدماء." },
  { id: "kilton", nameAr: "كيلتون", nameEn: "Kilton", voice: "Charon", role: "merchant",
    gradient: "from-purple-700 to-slate-900", emoji: "🌙",
    promptAr: "أنت كيلتون التاجر الغريب الأطوار عاشق الوحوش. صوتك مهموس غريب فيه شغف مرعب بالمخلوقات." },

  // ── الراوي والعموم ─────────────────────────────────────
  { id: "narrator", nameAr: "الراوي", nameEn: "Narrator", voice: "Iapetus", role: "narrator",
    gradient: "from-slate-500 to-gray-600", emoji: "📖",
    promptAr: "أنت الراوي الملحمي لعالم هايرول. صوتك رزين واضح مهيب، تحكي القصة بوقار وعمق وغموض." },
  { id: "npc_m", nameAr: "مواطن", nameEn: "Citizen (M)", voice: "Algenib", role: "civilian",
    gradient: "from-orange-400 to-yellow-500", emoji: "👨",
    promptAr: "أنت مواطن عادي من هايرول. صوتك طبيعي دافئ بسيط، تتكلم بعفوية." },
  { id: "npc_f", nameAr: "مواطنة", nameEn: "Citizen (F)", voice: "Zubenelgenubi", role: "civilian",
    gradient: "from-violet-400 to-purple-500", emoji: "👩",
    promptAr: "أنتِ مواطنة عادية من هايرول. صوتك طبيعي لطيف ودود، تتكلمين بعفوية وبساطة." },
  { id: "child_m", nameAr: "طفل", nameEn: "Child (M)", voice: "Achird", role: "child",
    gradient: "from-sky-300 to-blue-400", emoji: "🧒",
    promptAr: "أنت طفل صغير من هايرول. صوتك بريء حيوي مليء بالطاقة والفضول." },
  { id: "child_f", nameAr: "طفلة", nameEn: "Child (F)", voice: "Sadachbia", role: "child",
    gradient: "from-pink-300 to-rose-400", emoji: "👧",
    promptAr: "أنتِ طفلة صغيرة من هايرول. صوتك بريء عذب مليء بالضحك والمرح." },
  { id: "monster", nameAr: "وحش", nameEn: "Monster", voice: "Charon", role: "monster",
    gradient: "from-red-900 to-black", emoji: "👹",
    promptAr: "أنت وحش من وحوش هايرول. صوتك أجش مرعب غير بشري، تخرج كلمات قليلة بصوت غاضب." },
];

export function findCharacter(id: string): Character | undefined {
  return CHARACTERS.find(c => c.id === id);
}

/** فئات لتجميع الشخصيات في الواجهة */
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
