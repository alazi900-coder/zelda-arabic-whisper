// ============================================================
// Zelda Arabic Voice Dubbing Studio
// Gemini TTS · Client-side · No backend needed
// ============================================================
import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mic, ArrowRight, Play, Pause, Download, Trash2,
  Plus, Loader2, Wand2, Music, FlaskConical, Layers,
  Upload, X, Sparkles, Star,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { GoogleGenAI } from "@google/genai";

// ── Types ────────────────────────────────────────────────────
interface Character {
  id: string;
  nameAr: string;
  voice: string;
  gradient: string;
  emoji: string;
  promptAr: string;
}
interface StylePreset { id: string; labelAr: string; prefix: string; }
interface Take { id: string; charId: string; charName: string; text: string; url: string; styleId: string; }
interface ScriptLine { id: string; charId: string; text: string; url?: string; busy?: boolean; }

// ── Constants ────────────────────────────────────────────────
const MODEL = "gemini-3.1-flash-tts-preview";

const CHARACTERS: Character[] = [
  // ── الأبطال الرئيسيون ─────────────────────────────────────
  { id: "link",        nameAr: "لينك",             voice: "Puck",           gradient: "from-green-500 to-emerald-600",  emoji: "🗡️", promptAr: "أنت لينك بطل هايرول الصامت. صوتك شاب حازم هادئ. تتكلم بإيجاز شديد وتركيز كامل، كلماتك قليلة لكنها تحمل عزماً لا يُكسر." },
  { id: "zelda",       nameAr: "زيلدا",            voice: "Kore",           gradient: "from-blue-500 to-purple-600",    emoji: "🔮", promptAr: "أنتِ الأميرة زيلدا صاحبة الحكمة وراعية هايرول. صوتك ملكي دافئ وحازم. تتكلمين بوضوح تام وإحساس عميق بالمسؤولية، يظهر في صوتك قوة هادئة لا تتزعزع." },

  // ── الحكماء والأسلاف ──────────────────────────────────────
  { id: "rauru",       nameAr: "راورو",             voice: "Orus",           gradient: "from-amber-500 to-yellow-600",   emoji: "👑", promptAr: "أنت راورو الملك الأول لهايرول والحكيم الأبدي. صوتك قديم عميق هادئ جداً. تتكلم بثقة مطلقة وبساطة عميقة، كأن كل كلمة تحمل ثقل آلاف السنين." },
  { id: "sonia",       nameAr: "سونيا",             voice: "Aoede",          gradient: "from-rose-400 to-pink-500",      emoji: "🌸", promptAr: "أنتِ الملكة سونيا زوجة راورو وحاملة قوة الزمن. صوتك دافئ لطيف ملكي. تتكلمين بعناية وحكمة، وفي صوتك دفء أمومي يبعث على الطمأنينة." },
  { id: "mineru",      nameAr: "مينيرو",            voice: "Vindemiatrix",   gradient: "from-violet-500 to-purple-700",  emoji: "👻", promptAr: "أنتِ مينيرو حكيمة الروح وسليلة المعرفة الأبدية. صوتك قديم جداً هادئ وعميق. تتكلمين ببطء وعناية شديدة، كل كلمة مدروسة كأنها تُنحت في الحجارة، تحملين أسرار آلاف السنين." },

  // ── الأشرار ───────────────────────────────────────────────
  { id: "ganon",       nameAr: "غانوندورف",        voice: "Charon",         gradient: "from-red-700 to-orange-900",     emoji: "💀", promptAr: "أنت غانوندورف ملك الظلام والشر المطلق. صوتك عميق مهيب مخيف. تتكلم بطمأنينة مريبة وتهديد ضمني لا يُقاوَم، كأن كل كلمة تحمل لعنة أبدية." },
  { id: "kohga",       nameAr: "كوهغا",            voice: "Elspeth",        gradient: "from-gray-600 to-slate-800",     emoji: "🎭", promptAr: "أنت سيد كوهغا زعيم عصابة ياغا الغادر. صوتك درامي مسرحي مبالغ فيه يمزج بين التهديد والكوميديا السوداء. تتكلم بغطرسة وتفاخر وأنت تظن نفسك أكثر ذكاءً من الجميع." },

  // ── الحكماء الأربعة ───────────────────────────────────────
  { id: "sidon",       nameAr: "سيدون",            voice: "Fenrir",         gradient: "from-blue-400 to-teal-500",      emoji: "🐟", promptAr: "أنت الأمير سيدون حكيم الماء وأمير الزورا. صوتك بطولي ودود وقوي ومشرق. تتكلم بحماس وتشجيع دائم وثقة بالنفس لا تتزعزع، دائماً تنشر الأمل." },
  { id: "yunobo",      nameAr: "يونوبو",           voice: "Gacrux",         gradient: "from-orange-500 to-red-600",     emoji: "🔥", promptAr: "أنت يونوبو حكيم النار وبطل الغورون. صوتك كبير حيوي دافئ مع شيء من الطيبة الساذجة. تتكلم بحماس وقوة شاب يريد إثبات نفسه، قلبك طيب كالذهب." },
  { id: "tulin",       nameAr: "تولين",            voice: "Achird",         gradient: "from-sky-400 to-blue-500",       emoji: "🦅", promptAr: "أنت تولين حكيم الريح وشاب الريكو الشجاع. صوتك طفولي حيوي ومتحمس. تتكلم بطاقة مفرطة وشجاعة بريئة، تثبت دائماً أنك لست صغيراً كما يعتقدون." },
  { id: "riju",        nameAr: "ريجو",             voice: "Zephyr",         gradient: "from-yellow-400 to-amber-600",   emoji: "⚡", promptAr: "أنتِ ريجو زعيمة الغيرودو وحكيمة الرعد. صوتك قوي حازم مليء بالشجاعة والإصرار. تتكلمين بثقة قائدة شابة تحمل ثقل قومها، لا مجال للضعف في لهجتك." },

  // ── الشخصيات الداعمة الرئيسية ────────────────────────────
  { id: "impa",        nameAr: "إمبا",             voice: "Sulafat",        gradient: "from-red-400 to-pink-600",       emoji: "⚔️", promptAr: "أنتِ إمبا الحكيمة حارسة الأسرار. صوتك قوي رزين حازم دون تردد. تتكلمين بجدية ووضوح وثقة من رأت الكثير وعاشت الكثير." },
  { id: "purah",       nameAr: "بورا",             voice: "Leda",           gradient: "from-teal-400 to-cyan-600",      emoji: "🔬", promptAr: "أنتِ بورا العالِمة العبقرية مديرة مركز الأبحاث. صوتك حيوي ومتحمس لا يهدأ. تتكلمين بسرعة وفضول دائم، كل اكتشاف يثير حماسك." },
  { id: "teba",        nameAr: "تيبا",             voice: "Alnilam",        gradient: "from-indigo-400 to-blue-600",    emoji: "🏹", promptAr: "أنت تيبا المحارب الريكو الأسطوري ووالد تولين. صوتك جاد حازم صارم لا مزاح فيه. تتكلم بإيجاز وكلماتك كالسهام — مباشرة ودقيقة وتصيب الهدف." },
  { id: "king_dorephan", nameAr: "الملك دوريفان", voice: "Schedar",        gradient: "from-cyan-500 to-blue-700",      emoji: "🧊", promptAr: "أنت الملك دوريفان ملك الزورا العجوز الحكيم ووالد سيدون. صوتك عميق ثقيل من كبر السن مليء بالحكمة والتعب. تتكلم ببطء ووقار ملكي، كل كلمة توزنها بميزان التجربة الطويلة." },

  // ── شخصيات العالم ─────────────────────────────────────────
  { id: "deku_tree",   nameAr: "شجرة ديكو",        voice: "Rasalgheti",     gradient: "from-green-600 to-emerald-800",  emoji: "🌳", promptAr: "أنت شجرة ديكو العظيمة روح الغابة الأبدية وحارس أسرار العالم. صوتك عميق ثقيل جداً قديم جداً. تتكلم ببطء شديد جداً وحكمة مطلقة، كأنك تخاطب عبر آلاف السنين." },
  { id: "hestu",       nameAr: "هيستو",            voice: "Sadachbia",      gradient: "from-lime-400 to-green-500",     emoji: "🎵", promptAr: "أنت هيستو كوروك راقص المَرَّاسين الأسطوري. صوتك فرحان مرح طفولي ساذج بشكل لا يصدق. تتكلم بحماس وفرح غير طبيعيين وتعشق موسيقاك عشقاً لا حدود له، شاكابكاكا!" },

  // ── الراوي والعموم ─────────────────────────────────────────
  { id: "narrator",    nameAr: "الراوي",           voice: "Iapetus",        gradient: "from-slate-500 to-gray-600",     emoji: "📖", promptAr: "أنت الراوي الملحمي لعالم هايرول. صوتك رزين واضح مهيب. تحكي القصة بوقار وعمق وغموض، تفتح كل مشهد كأنك تكشف سراً من أسرار الأبدية." },
  { id: "npc_m",       nameAr: "مواطن",            voice: "Algenib",        gradient: "from-orange-400 to-yellow-500",  emoji: "👨", promptAr: "أنت مواطن عادي من هايرول. صوتك طبيعي ودافئ وبسيط. تتكلم بعفوية الناس العاديين." },
  { id: "npc_f",       nameAr: "مواطنة",           voice: "Zubenelgenubi",  gradient: "from-violet-400 to-purple-500",  emoji: "👩", promptAr: "أنتِ مواطنة عادية من هايرول. صوتك طبيعي لطيف وودود. تتكلمين بعفوية وبساطة." },
];

const STYLES: StylePreset[] = [
  { id: "normal",   labelAr: "عادي",           prefix: "" },
  { id: "calm",     labelAr: "هادئ متأمل",      prefix: "قل بصوت هادئ ومتأمل: " },
  { id: "excited",  labelAr: "حماسي",           prefix: "قل بحماس وانفعال: " },
  { id: "angry",    labelAr: "غاضب",            prefix: "قل بصوت غاضب شديد: " },
  { id: "sad",      labelAr: "حزين",            prefix: "قل بصوت حزين مؤثر: " },
  { id: "regal",    labelAr: "ملكي مهيب",       prefix: "قل بهيبة ووقار ملكي: " },
  { id: "scary",    labelAr: "مخيف",            prefix: "قل بصوت مخيف ومنخفض: " },
  { id: "whisper",  labelAr: "همس",             prefix: "قل بهمس خفيف سري: " },
];

const ROOMS = [
  { id: "temple",  label: "معبد",        icon: "🏛️" },
  { id: "cave",    label: "كهف",         icon: "🪨" },
  { id: "open",    label: "خارجي",       icon: "🌿" },
  { id: "throne",  label: "قاعة العرش",  icon: "⚔️" },
];

// ── WAV builder ──────────────────────────────────────────────
function b64ToWavUrl(b64: string, rate = 24000): string {
  const bin = atob(b64);
  const pcm = bin.length;
  const buf = new ArrayBuffer(44 + pcm);
  const v = new DataView(buf);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, 36 + pcm, true); ws(8, "WAVE");
  ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  ws(36, "data"); v.setUint32(40, pcm, true);
  for (let i = 0; i < pcm; i++) v.setUint8(44 + i, bin.charCodeAt(i));
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

// ── Component ────────────────────────────────────────────────
export default function Dubbing() {
  const [apiKey, setApiKey]   = useState(() => localStorage.getItem("gemini_api_key") || "");
  const [charId, setCharId]   = useState("zelda");
  const [styleId, setStyleId] = useState("normal");
  const [text, setText]       = useState("يا لينك، الوقت ينفد. يجب عليك أن تجد الجواهر الثلاثة قبل أن يستيقظ غانوندورف من سباته العميق.");
  const [intensity, setIntensity] = useState([70]);
  const [takes, setTakes]     = useState<Take[]>([]);
  const [playId, setPlayId]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [script, setScript]   = useState<ScriptLine[]>([
    { id: "s1", charId: "zelda", text: "لينك، الخطر يقترب من قصر هايرول، يجب أن نتحرك الآن." },
    { id: "s2", charId: "link",  text: "أنا جاهز. سأحمي هايرول بكل ما أملك من قوة." },
    { id: "s3", charId: "rauru", text: "الشجرة الإلهية ستمنحك قوة لا تُقهر إن صدقت في عزمك." },
  ]);
  const [scriptBusy, setScriptBusy] = useState(false);

  const [labFile,     setLabFile]     = useState<File | null>(null);
  const [labResult,   setLabResult]   = useState("");
  const [labBusy,     setLabBusy]     = useState(false);
  const [mixerRoom,   setMixerRoom]   = useState("temple");
  const [reverb,      setReverb]      = useState([35]);
  const [echo,        setEcho]        = useState([20]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getAI = useCallback(() => {
    if (!apiKey.trim()) throw new Error("أدخل مفتاح Google Gemini API أولاً");
    localStorage.setItem("gemini_api_key", apiKey);
    return new GoogleGenAI({ apiKey });
  }, [apiKey]);

  // ── core TTS call ─────────────────────────────────────────
  const tts = useCallback(async (cId: string, t: string, sId: string): Promise<string> => {
    const ai   = getAI();
    const char = CHARACTERS.find(c => c.id === cId)!;
    const sty  = STYLES.find(s => s.id === sId)!;
    const lvl  = intensity[0] > 80 ? "أداء درامي مبالغ فيه. " : intensity[0] > 50 ? "أداء معبّر طبيعي. " : "أداء هادئ متحفظ. ";
    const prompt = `${char.promptAr}\n${lvl}${sty.prefix}${t}`;
    const res = await (ai.models as any).generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: char.voice } } },
      },
    });
    const b64 = res?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) throw new Error("لم يُرجع الذكاء الاصطناعي بيانات صوتية");
    return b64ToWavUrl(b64);
  }, [getAI, intensity]);

  // ── Studio generate ───────────────────────────────────────
  const onGenerate = async () => {
    if (!text.trim()) { toast({ title: "أدخل نصاً", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const url  = await tts(charId, text, styleId);
      const char = CHARACTERS.find(c => c.id === charId)!;
      const take: Take = { id: crypto.randomUUID(), charId, charName: char.nameAr, text, url, styleId };
      setTakes(prev => [take, ...prev].slice(0, 25));
      setPlayId(take.id);
      if (audioRef.current) { audioRef.current.src = url; audioRef.current.play().catch(() => {}); }
      toast({ title: `✅ ${char.nameAr} ${char.emoji}` });
    } catch (e) {
      toast({ title: "❌ خطأ", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setLoading(false); }
  };

  // ── Script Room generate all ──────────────────────────────
  const onGenerateScript = async () => {
    setScriptBusy(true);
    let ok = 0;
    for (const line of script) {
      if (!line.text.trim()) continue;
      setScript(p => p.map(l => l.id === line.id ? { ...l, busy: true } : l));
      try {
        const url = await tts(line.charId, line.text, "normal");
        setScript(p => p.map(l => l.id === line.id ? { ...l, url, busy: false } : l));
        ok++;
      } catch {
        setScript(p => p.map(l => l.id === line.id ? { ...l, busy: false } : l));
      }
    }
    setScriptBusy(false);
    toast({ title: `✅ تم توليد ${ok} سطر` });
  };

  // ── Sound Lab analyze ─────────────────────────────────────
  const onAnalyze = async () => {
    if (!labFile) return;
    setLabBusy(true);
    try {
      const ai = getAI();
      const b64: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(labFile);
      });
      const resp = await (ai.models as any).generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts: [
          { text: "حلّل هذا الصوت. أخبرني: نبرة الصوت، الطاقة الدرامية، الإيقاع، والأسلوب الأنسب لتقليده لأداء دبلجة شخصية من عالم Zelda. قدّم توصيات عملية محددة لإعدادات الأداء وكيفية توجيه نموذج TTS لمحاكاة هذا الصوت." },
          { inlineData: { mimeType: labFile.type || "audio/wav", data: b64 } },
        ]}],
      });
      setLabResult(resp?.candidates?.[0]?.content?.parts?.[0]?.text || "لا يوجد تحليل");
    } catch (e) {
      toast({ title: "❌ خطأ", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setLabBusy(false); }
  };

  const activeChar  = CHARACTERS.find(c => c.id === charId)!;
  const activeStyle = STYLES.find(s => s.id === styleId)!;

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#07070f] text-amber-50" dir="rtl">
      {/* glow bg */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(212,160,23,0.07) 0%, transparent 70%)" }} />

      <audio ref={audioRef} onEnded={() => setPlayId(null)} className="hidden" />

      <div className="relative container max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Link to="/"><Button variant="ghost" size="sm" className="text-amber-500 hover:text-amber-300 hover:bg-amber-400/10"><ArrowRight className="w-4 h-4 ml-1" />العودة</Button></Link>
          <motion.div className="text-center" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-xl md:text-2xl font-bold text-amber-400 flex items-center gap-2 justify-center">
              <Mic className="w-6 h-6" /> استوديو الدبلجة
            </h1>
            <p className="text-[11px] text-amber-700 mt-0.5">Zelda: Tears of the Kingdom · Arabic Voice Studio</p>
          </motion.div>
          <div className="w-20" />
        </div>

        {/* ── API Key ───────────────────────────────────────── */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-4 py-3 flex gap-3 items-center">
          <Star className="w-4 h-4 text-amber-500 shrink-0" />
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="مفتاح Google Gemini API (AIza...)"
            className="flex-1 text-sm bg-transparent border-none outline-none text-amber-100 placeholder:text-amber-700"
          />
          <div className={`w-2 h-2 rounded-full shrink-0 ${apiKey ? "bg-emerald-400" : "bg-red-500/60"}`} />
        </div>

        {/* ── Tabs ──────────────────────────────────────────── */}
        <Tabs defaultValue="studio" className="space-y-4">
          <TabsList className="bg-black/40 border border-amber-500/20 w-full grid grid-cols-4 h-10">
            {[
              { v: "studio",  label: "الاستوديو",   Icon: Mic },
              { v: "script",  label: "السيناريو",   Icon: Layers },
              { v: "lab",     label: "المختبر",     Icon: FlaskConical },
              { v: "mixer",   label: "الميكساج",    Icon: Music },
            ].map(({ v, label, Icon }) => (
              <TabsTrigger key={v} value={v}
                className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-amber-500 text-[11px] sm:text-xs gap-1">
                <Icon className="w-3 h-3" />{label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ══════════════ STUDIO ══════════════════════════ */}
          <TabsContent value="studio" className="space-y-4">

            {/* Character grid */}
            <div>
              <p className="text-[11px] text-amber-600 mb-2 font-medium">الشخصية</p>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                {CHARACTERS.map(c => (
                  <motion.button key={c.id} onClick={() => setCharId(c.id)} whileTap={{ scale: 0.93 }}
                    className={`relative rounded-xl p-2 text-center transition-all border ${
                      charId === c.id ? "border-amber-400 bg-amber-400/10" : "border-white/5 bg-white/3 hover:border-amber-500/30"
                    }`}
                  >
                    {charId === c.id && (
                      <motion.div layoutId="hl" className={`absolute inset-0 rounded-xl bg-gradient-to-br ${c.gradient} opacity-20`} />
                    )}
                    <div className="text-lg mb-0.5">{c.emoji}</div>
                    <div className="text-[9px] text-amber-300 font-medium leading-tight">{c.nameAr}</div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Style presets */}
            <div>
              <p className="text-[11px] text-amber-600 mb-2 font-medium">أسلوب الأداء</p>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => setStyleId(s.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] transition-all border ${
                      styleId === s.id ? "bg-amber-500 text-black border-amber-500 font-bold" : "border-amber-500/20 text-amber-400 hover:border-amber-500/50"
                    }`}>
                    {s.labelAr}
                  </button>
                ))}
              </div>
            </div>

            {/* Text */}
            <div>
              <p className="text-[11px] text-amber-600 mb-1.5 font-medium">النص <span className="text-amber-700">({text.length}/4000)</span></p>
              <Textarea value={text} onChange={e => setText(e.target.value)} maxLength={4000} rows={4} dir="rtl"
                placeholder="اكتب الحوار هنا..."
                className="bg-black/30 border-amber-500/20 text-amber-100 placeholder:text-amber-800 resize-none text-sm focus:border-amber-400" />
            </div>

            {/* Intensity */}
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] text-amber-600">
                <span>كثافة الأداء الدرامي</span>
                <span className="text-amber-400 font-medium">{intensity[0]}%</span>
              </div>
              <Slider value={intensity} onValueChange={setIntensity} min={10} max={100} step={5}
                className="[&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-amber-400" />
            </div>

            {/* Generate */}
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button onClick={onGenerate} disabled={loading} size="lg"
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-bold text-base h-12">
                {loading
                  ? <><Loader2 className="w-5 h-5 ml-2 animate-spin" />جارٍ التوليد...</>
                  : <><Wand2 className="w-5 h-5 ml-2" />توليد صوت {activeChar.nameAr} {activeChar.emoji}</>
                }
              </Button>
            </motion.div>

            {/* Takes */}
            {takes.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-amber-600 font-medium">التسجيلات ({takes.length})</p>
                <AnimatePresence initial={false}>
                  {takes.map(t => {
                    const ch = CHARACTERS.find(c => c.id === t.charId)!;
                    const st = STYLES.find(s => s.id === t.styleId)!;
                    return (
                      <motion.div key={t.id}
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/10 bg-amber-950/20">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{ch.emoji} {ch.nameAr}</span>
                            <span className="text-[10px] text-amber-700">{st.labelAr}</span>
                          </div>
                          <p className="text-xs text-amber-200 truncate">{t.text}</p>
                        </div>
                        <button onClick={() => {
                          if (!audioRef.current) return;
                          if (playId === t.id) { audioRef.current.pause(); setPlayId(null); return; }
                          audioRef.current.src = t.url; audioRef.current.play(); setPlayId(t.id);
                        }} className="p-2 rounded-lg hover:bg-amber-400/10 text-amber-400 shrink-0">
                          {playId === t.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <a href={t.url} download={`${t.charName}_${Date.now()}.wav`}
                          className="p-2 rounded-lg hover:bg-amber-400/10 text-amber-400 shrink-0">
                          <Download className="w-4 h-4" />
                        </a>
                        <button onClick={() => { URL.revokeObjectURL(t.url); setTakes(p => p.filter(x => x.id !== t.id)); if (playId === t.id) setPlayId(null); }}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-red-400/70 hover:text-red-400 shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          {/* ══════════════ SCRIPT ROOM ══════════════════════ */}
          <TabsContent value="script" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-amber-300">غرفة السيناريو</p>
              <Button size="sm" variant="outline" onClick={() => setScript(p => [...p, { id: crypto.randomUUID(), charId: "zelda", text: "" }])}
                className="border-amber-500/30 text-amber-400 hover:bg-amber-400/10 h-8 gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" /> سطر جديد
              </Button>
            </div>

            <div className="space-y-2">
              <AnimatePresence>
                {script.map((line, idx) => {
                  const ch = CHARACTERS.find(c => c.id === line.charId)!;
                  return (
                    <motion.div key={line.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }}
                      className="rounded-xl border border-amber-500/10 bg-amber-950/20 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-amber-700 w-4 shrink-0 text-center">{idx + 1}</span>
                        <select value={line.charId}
                          onChange={e => setScript(p => p.map(l => l.id === line.id ? { ...l, charId: e.target.value } : l))}
                          className="text-[11px] bg-black/30 border border-amber-500/20 rounded-lg px-2 py-1 text-amber-300 max-w-[140px]">
                          {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nameAr}</option>)}
                        </select>
                        <div className="flex-1" />
                        {line.busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                        {line.url && !line.busy && (
                          <button onClick={() => { if (audioRef.current) { audioRef.current.src = line.url!; audioRef.current.play(); } }}
                            className="p-1 text-emerald-400 hover:text-emerald-300"><Play className="w-3.5 h-3.5" /></button>
                        )}
                        {line.url && !line.busy && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                        <button onClick={() => setScript(p => p.filter(l => l.id !== line.id))}
                          className="p-1 text-red-400/50 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                      </div>
                      <Textarea value={line.text}
                        onChange={e => setScript(p => p.map(l => l.id === line.id ? { ...l, text: e.target.value } : l))}
                        rows={2} dir="rtl" placeholder="الحوار..."
                        className="bg-transparent border-amber-500/10 text-amber-100 placeholder:text-amber-800 resize-none text-xs" />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <Button onClick={onGenerateScript} disabled={scriptBusy || script.length === 0}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-bold h-11">
              {scriptBusy
                ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />جارٍ التوليد...</>
                : <><Sparkles className="w-4 h-4 ml-2" />توليد جميع الأسطر ({script.length})</>}
            </Button>
          </TabsContent>

          {/* ══════════════ SOUND LAB ═════════════════════════ */}
          <TabsContent value="lab" className="space-y-4">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-950/15 p-5 space-y-4">
              <div className="text-center space-y-1">
                <FlaskConical className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-sm font-semibold text-amber-300">مختبر تحليل الصوت</p>
                <p className="text-[11px] text-amber-700">ارفع ملفاً صوتياً ليقوم Gemini بتحليله وإعطائك توصيات للأداء</p>
              </div>

              <label className="block cursor-pointer">
                <div className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${labFile ? "border-amber-500/50 bg-amber-500/5" : "border-amber-500/20 hover:border-amber-500/40"}`}>
                  {labFile ? (
                    <div className="space-y-1">
                      <div className="text-amber-300 text-sm font-medium">{labFile.name}</div>
                      <div className="text-amber-600 text-xs">{(labFile.size / 1024).toFixed(1)} KB</div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-6 h-6 text-amber-700 mx-auto" />
                      <div className="text-xs text-amber-700">اضغط لرفع WAV / MP3</div>
                    </div>
                  )}
                </div>
                <input type="file" accept="audio/*" className="hidden"
                  onChange={e => { setLabFile(e.target.files?.[0] || null); setLabResult(""); }} />
              </label>

              <Button onClick={onAnalyze} disabled={!labFile || labBusy || !apiKey.trim()}
                className="w-full bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-500 hover:to-cyan-600 text-white font-bold">
                {labBusy ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />جارٍ التحليل...</> : <><FlaskConical className="w-4 h-4 ml-2" />تحليل بـ Gemini</>}
              </Button>
            </div>

            <AnimatePresence>
              {labResult && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-teal-500/25 bg-teal-950/20 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold">
                    <Sparkles className="w-4 h-4" /> تحليل Gemini
                  </div>
                  <p className="text-sm text-amber-100 leading-relaxed whitespace-pre-wrap">{labResult}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ══════════════ MIXER ════════════════════════════ */}
          <TabsContent value="mixer" className="space-y-4">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-950/15 p-5 space-y-5">
              <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
                <Music className="w-4 h-4 text-amber-400" /> غرفة الميكساج
              </div>

              {/* Room */}
              <div>
                <p className="text-[11px] text-amber-600 mb-2 font-medium">بيئة الصوت</p>
                <div className="grid grid-cols-4 gap-2">
                  {ROOMS.map(r => (
                    <button key={r.id} onClick={() => setMixerRoom(r.id)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        mixerRoom === r.id ? "border-amber-400 bg-amber-400/10" : "border-amber-500/10 hover:border-amber-500/30"
                      }`}>
                      <div className="text-xl mb-1">{r.icon}</div>
                      <div className="text-[10px] text-amber-300">{r.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Effects */}
              {[
                { label: "الصدى (Reverb)", val: reverb, set: setReverb },
                { label: "الترجيع (Echo)",  val: echo,   set: setEcho },
              ].map(({ label, val, set }) => (
                <div key={label} className="space-y-2">
                  <div className="flex justify-between text-[11px] text-amber-600">
                    <span>{label}</span><span className="text-amber-400 font-medium">{val[0]}%</span>
                  </div>
                  <Slider value={val} onValueChange={set} min={0} max={100}
                    className="[&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-amber-400" />
                </div>
              ))}

              {/* Tracks */}
              {takes.length === 0 ? (
                <p className="text-center text-xs text-amber-800 py-3">ولّد أصواتاً من تبويب الاستوديو أولاً</p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-amber-600 font-medium">المسارات</p>
                  {takes.slice(0, 6).map(t => {
                    const ch = CHARACTERS.find(c => c.id === t.charId)!;
                    return (
                      <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg border border-amber-500/10 bg-black/20">
                        <span className="text-sm shrink-0">{ch.emoji}</span>
                        <span className="text-[11px] text-amber-300 flex-1 truncate">{ch.nameAr}: {t.text.slice(0, 35)}{t.text.length > 35 ? "…" : ""}</span>
                        <a href={t.url} download={`mix_${ch.nameAr}.wav`}
                          className="p-1.5 rounded hover:bg-amber-400/10 text-amber-500 shrink-0">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-amber-800 text-center pt-1">تطبيق تأثيرات Reverb/Echo الحقيقية قادم عبر Web Audio API</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <p className="text-[10px] text-center text-amber-800 pb-2">
          {MODEL} · احصل على مفتاحك المجاني من{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline text-amber-700 hover:text-amber-500">
            aistudio.google.com
          </a>
        </p>
      </div>
    </div>
  );
}
