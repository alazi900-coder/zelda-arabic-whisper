// ============================================================
// Zelda Arabic Voice Dubbing Studio · v2
// Rich tones · Scene timeline · ZIP+SRT export
// ============================================================
import { useState, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mic, ArrowRight, Play, Pause, Download, Trash2,
  Plus, Loader2, Wand2, Music, FlaskConical, Layers,
  Upload, X, Sparkles, Star, Film, FileAudio, Package,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import {
  CHARACTERS, ROLE_LABELS, findCharacter, getTonesForCharacter,
  type Character, type Tone, type CharacterRole,
} from "@/lib/dubbing/character-catalog";
import { resolveElevenVoiceId, intensityToSettings } from "@/lib/dubbing/elevenlabs-voices";
import { mixScene, buildSrt, type SceneClip } from "@/lib/dubbing/scene-mixer";

// ── Types ────────────────────────────────────────────────────
interface Take { id: string; charId: string; charName: string; text: string; url: string; toneId: string; toneLabel: string; }
interface ScriptLine { id: string; charId: string; toneId: string; text: string; url?: string; busy?: boolean; gapMs?: number; }

const ENGINE_LABEL = "ElevenLabs · multilingual v2";

// ── WAV builder ──────────────────────────────────────────────
// ── ElevenLabs TTS call via edge function ────────────────────
async function callElevenTTS(text: string, voiceId: string, settings: ReturnType<typeof intensityToSettings>, speed: number): Promise<string> {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts-dubbing`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        text,
        voiceId,
        stability: settings.stability,
        similarity: settings.similarity_boost,
        style: settings.style,
        speed,
      }),
    }
  );
  if (!resp.ok) {
    let msg = `فشل التوليد: ${resp.status}`;
    try { const j = await resp.json(); msg = j?.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
}

const ROOMS = [
  { id: "temple",  label: "معبد",        icon: "🏛️" },
  { id: "cave",    label: "كهف",         icon: "🪨" },
  { id: "open",    label: "خارجي",       icon: "🌿" },
  { id: "throne",  label: "قاعة العرش",  icon: "⚔️" },
];

// ── Component ────────────────────────────────────────────────
export default function Dubbing() {
  // ElevenLabs يعمل على الخادم — لا حاجة لمفتاح من المستخدم
  const [charId, setCharId]   = useState("zelda");
  const [toneId, setToneId]   = useState("neutral");
  const [roleFilter, setRoleFilter] = useState<CharacterRole | "all">("all");
  const [text, setText]       = useState("يا لينك، الوقت ينفد. يجب أن تجد الجواهر الثلاث قبل أن يستيقظ غانوندورف.");
  const [intensity, setIntensity] = useState([70]);
  const [speed, setSpeed]     = useState([100]); // %
  const [takes, setTakes]     = useState<Take[]>([]);
  const [playId, setPlayId]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [script, setScript]   = useState<ScriptLine[]>([
    { id: "s1", charId: "zelda", toneId: "lament_link", text: "لينك… الخطر يقترب من قصر هايرول، يجب أن نتحرك الآن." },
    { id: "s2", charId: "link",  toneId: "heroic",      text: "أنا جاهز. سأحمي هايرول بكل قوتي." },
    { id: "s3", charId: "ganon", toneId: "menacing",    text: "لا فائدة من المقاومة، الظلام قادم لا محالة." },
    { id: "s4", charId: "rauru", toneId: "prophetic",   text: "الشجرة الإلهية ستمنحك قوة لا تُقهر إن صدق عزمك." },
  ]);
  const [scriptBusy, setScriptBusy] = useState(false);
  const [mixUrl, setMixUrl] = useState<string | null>(null);
  const [mixing, setMixing] = useState(false);

  const [labFile,     setLabFile]     = useState<File | null>(null);
  const [labResult,   setLabResult]   = useState("");
  const [labBusy,     setLabBusy]     = useState(false);
  const [mixerRoom,   setMixerRoom]   = useState("temple");
  const [reverb,      setReverb]      = useState([35]);
  const [echo,        setEcho]        = useState([20]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeChar = useMemo<Character>(() => findCharacter(charId) ?? CHARACTERS[0], [charId]);
  const tonesForActive = useMemo<Tone[]>(() => getTonesForCharacter(activeChar), [activeChar]);
  const activeTone = useMemo<Tone>(
    () => tonesForActive.find(t => t.id === toneId) ?? tonesForActive[0],
    [tonesForActive, toneId]
  );

  // عند تغيير الشخصية، إذا لم تعد النبرة موجودة نعود إلى أول نبرة متاحة
  const onCharChange = (id: string) => {
    setCharId(id);
    const newChar = findCharacter(id);
    if (!newChar) return;
    const tones = getTonesForCharacter(newChar);
    if (!tones.some(t => t.id === toneId)) setToneId(tones[0]?.id ?? "neutral");
  };

  const filteredCharacters = useMemo<Character[]>(() => {
    if (roleFilter === "all") return CHARACTERS;
    return CHARACTERS.filter(c => c.role === roleFilter);
  }, [roleFilter]);

  const availableRoles = useMemo<CharacterRole[]>(() => {
    const set = new Set<CharacterRole>();
    CHARACTERS.forEach(c => set.add(c.role));
    return Array.from(set);
  }, []);

  // ── core TTS call (يدعم نبرة وسرعة وكثافة) عبر ElevenLabs ───
  const tts = useCallback(async (cId: string, t: string, tId: string, controls?: { speedPct?: number; intensityPct?: number }): Promise<string> => {
    const char = findCharacter(cId) ?? CHARACTERS[0];
    const tones = getTonesForCharacter(char);
    const tone  = tones.find(x => x.id === tId) ?? tones[0];
    const inten = controls?.intensityPct ?? 70;
    const sp    = controls?.speedPct ?? 100;
    // ElevenLabs ينطق النص حرفياً، لذا نضيف مقدمة عربية موجزة للنبرة فقط
    const promptText = `${tone.prefix}${t}`.trim();
    const voiceId = resolveElevenVoiceId(cId);
    const settings = intensityToSettings(inten);
    // سرعة ElevenLabs بين 0.7 و 1.2
    const speed = Math.max(0.7, Math.min(1.2, sp / 100));
    return callElevenTTS(promptText, voiceId, settings, speed);
  }, []);

  // ── Studio generate ───────────────────────────────────────
  const onGenerate = async () => {
    if (!text.trim()) { toast({ title: "أدخل نصاً", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const url  = await tts(charId, text, toneId, { intensityPct: intensity[0], speedPct: speed[0] });
      const take: Take = {
        id: crypto.randomUUID(), charId, charName: activeChar.nameAr, text, url,
        toneId: activeTone.id, toneLabel: activeTone.labelAr,
      };
      setTakes(prev => [take, ...prev].slice(0, 30));
      setPlayId(take.id);
      if (audioRef.current) { audioRef.current.src = url; audioRef.current.play().catch(() => {}); }
      toast({ title: `✅ ${activeChar.nameAr} ${activeChar.emoji} · ${activeTone.labelAr}` });
    } catch (e) {
      toast({ title: "❌ خطأ", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setLoading(false); }
  };

  // ── Script generate all ──────────────────────────────────
  const onGenerateScript = async () => {
    setScriptBusy(true);
    setMixUrl(null);
    let ok = 0;
    for (const line of script) {
      if (!line.text.trim()) continue;
      setScript(p => p.map(l => l.id === line.id ? { ...l, busy: true } : l));
      try {
        const url = await tts(line.charId, line.text, line.toneId);
        setScript(p => p.map(l => l.id === line.id ? { ...l, url, busy: false } : l));
        ok++;
      } catch {
        setScript(p => p.map(l => l.id === line.id ? { ...l, busy: false } : l));
      }
    }
    setScriptBusy(false);
    toast({ title: `✅ تم توليد ${ok} سطر` });
  };

  // ── Build clips for mixing ───────────────────────────────
  const buildClips = useCallback((): SceneClip[] => {
    return script
      .filter(l => l.url && l.text.trim())
      .map(l => {
        const ch = findCharacter(l.charId);
        return { url: l.url!, charName: ch?.nameAr ?? "?", text: l.text, gapMs: l.gapMs ?? 350 };
      });
  }, [script]);

  // ── Mix and play scene ───────────────────────────────────
  const onPlayScene = async () => {
    const clips = buildClips();
    if (clips.length === 0) { toast({ title: "ولّد الأسطر أولاً", variant: "destructive" }); return; }
    setMixing(true);
    try {
      const result = await mixScene(clips);
      if (mixUrl) URL.revokeObjectURL(mixUrl);
      setMixUrl(result.url);
      if (audioRef.current) { audioRef.current.src = result.url; audioRef.current.play().catch(() => {}); }
      toast({ title: `🎬 المشهد جاهز (${(result.durationMs / 1000).toFixed(1)}ث)` });
    } catch (e) {
      toast({ title: "❌ فشل الدمج", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setMixing(false); }
  };

  // ── Export ZIP + SRT ─────────────────────────────────────
  const onExportZip = async () => {
    const clips = buildClips();
    if (clips.length === 0) { toast({ title: "ولّد الأسطر أولاً", variant: "destructive" }); return; }
    setMixing(true);
    try {
      const result = await mixScene(clips);
      const srt = buildSrt(clips, result.starts, result.ends);
      const zip = new JSZip();
      zip.file("scene.wav", result.blob);
      zip.file("scene.srt", srt);
      zip.file("script.txt", clips.map((c, i) => `${i + 1}. ${c.charName}: ${c.text}`).join("\n"));
      // الأسطر الفردية
      for (let i = 0; i < clips.length; i++) {
        const res = await fetch(clips[i].url);
        const buf = await res.arrayBuffer();
        const num = String(i + 1).padStart(3, "0");
        zip.file(`lines/${num}_${clips[i].charName}.wav`, buf);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `scene_${Date.now()}.zip`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast({ title: "📦 تم التصدير" });
    } catch (e) {
      toast({ title: "❌ فشل التصدير", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setMixing(false); }
  };

  // ── Sound Lab analyze ─ via edge function (ElevenLabs Scribe + AI) ─
  const onAnalyze = async () => {
    if (!labFile) return;
    setLabBusy(true);
    try {
      const buf = await labFile.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const b64 = btoa(bin);
      const { data, error } = await supabase.functions.invoke("analyze-audio", {
        body: { audioBase64: b64, mimeType: labFile.type || "audio/wav" },
      });
      if (error) throw new Error(error.message || "فشل التحليل");
      if (!data?.analysis) throw new Error(data?.error || "تحليل فارغ");
      const a = data.analysis;
      const summary = [
        `النص: ${a.transcript || "—"}`,
        `اللغة: ${a.sourceLanguage || "—"}`,
        `العاطفة: ${a.emotion || "—"} (${a.intensity ?? "—"}/10)`,
        `النبرة: ${a.tone || "—"}`,
        `الجنس/العمر: ${a.gender || "—"} / ${a.ageGroup || "—"}`,
        `طبقة الصوت/السرعة: ${a.pitch || "—"} / ${a.speed || "—"}`,
        `الصوت المقترح من Zelda: ${a.suggestedZeldaVoice || "—"}`,
        `\nالترجمة العربية:\n${a.arabicTranslation || "—"}`,
        `\nتوجيه المخرج:\n${a.dubbingDirection || "—"}`,
      ].join("\n");
      setLabResult(summary);
    } catch (e) {
      toast({ title: "❌ خطأ", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setLabBusy(false); }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-amber-50" dir="rtl">
      {/* glow bg */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(212,175,55,0.08) 0%, transparent 70%)" }} />

      <audio ref={audioRef} onEnded={() => setPlayId(null)} className="hidden" />

      <div className="relative container max-w-4xl mx-auto px-3 sm:px-4 py-5 space-y-4">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Link to="/"><Button variant="ghost" size="sm" className="text-amber-500 hover:text-amber-300 hover:bg-amber-400/10"><ArrowRight className="w-4 h-4 ml-1" />العودة</Button></Link>
          <motion.div className="text-center" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-xl md:text-2xl font-bold text-amber-400 flex items-center gap-2 justify-center">
              <Mic className="w-6 h-6" /> استوديو الدبلجة
            </h1>
            <p className="text-[11px] text-amber-700 mt-0.5">{CHARACTERS.length} شخصية · نبرات متعددة لكل شخصية</p>
          </motion.div>
          <div className="w-20" />
        </div>

        {/* ── Engine badge ──────────────────────────────────── */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-4 py-2.5 flex gap-3 items-center justify-center">
          <Star className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-300">المحرك الصوتي: <b className="text-amber-400">{ENGINE_LABEL}</b> · بدون مفتاح من المستخدم</span>
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>

        {/* ── Tabs ──────────────────────────────────────────── */}
        <Tabs defaultValue="studio" className="space-y-4">
          <TabsList className="bg-black/40 border border-amber-500/20 w-full grid grid-cols-4 h-10 sticky top-0 z-20">
            {[
              { v: "studio",  label: "الاستوديو",   Icon: Mic },
              { v: "script",  label: "المشهد",       Icon: Film },
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

            {/* Role filter */}
            <div className="flex flex-wrap gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 touch-pan-x">
              <button onClick={() => setRoleFilter("all")}
                className={`px-2.5 py-1 rounded-full text-[10px] border whitespace-nowrap shrink-0 ${
                  roleFilter === "all" ? "bg-amber-500 text-black border-amber-500 font-bold" : "border-amber-500/20 text-amber-500 hover:border-amber-500/50"
                }`}>الكل ({CHARACTERS.length})</button>
              {availableRoles.map(r => (
                <button key={r} onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded-full text-[10px] border whitespace-nowrap shrink-0 ${
                    roleFilter === r ? "bg-amber-500 text-black border-amber-500 font-bold" : "border-amber-500/20 text-amber-500 hover:border-amber-500/50"
                  }`}>{ROLE_LABELS[r]}</button>
              ))}
            </div>

            {/* Character grid */}
            <div>
              <p className="text-[11px] text-amber-600 mb-2 font-medium">الشخصية ({filteredCharacters.length})</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-[40vh] sm:max-h-none overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] touch-pan-y">
                {filteredCharacters.map(c => (
                  <motion.button key={c.id} onClick={() => onCharChange(c.id)} whileTap={{ scale: 0.93 }}
                    className={`relative rounded-xl p-2 text-center transition-all border ${
                      charId === c.id ? "border-amber-400 bg-amber-400/10" : "border-white/5 bg-white/3 hover:border-amber-500/30"
                    }`}>
                    {charId === c.id && (
                      <motion.div layoutId="hl" className={`absolute inset-0 rounded-xl bg-gradient-to-br ${c.gradient} opacity-20`} />
                    )}
                    <div className="text-lg mb-0.5">{c.emoji}</div>
                    <div className="text-[9px] text-amber-300 font-medium leading-tight">{c.nameAr}</div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Tone selector — pills + drawer-friendly scroll */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-amber-600 font-medium">النبرة لـ {activeChar.nameAr} ({tonesForActive.length})</p>
                <span className="text-[10px] text-amber-700">{activeTone.labelAr}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-[28vh] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] touch-pan-y rounded-xl border border-amber-500/10 bg-black/20 p-2">
                {tonesForActive.map(t => {
                  const palette =
                    t.category === "intense"  ? "border-red-500/40 text-red-300 hover:border-red-400" :
                    t.category === "negative" ? "border-blue-500/40 text-blue-300 hover:border-blue-400" :
                    t.category === "positive" ? "border-emerald-500/40 text-emerald-300 hover:border-emerald-400" :
                    t.category === "subtle"   ? "border-purple-500/40 text-purple-300 hover:border-purple-400" :
                                                "border-amber-500/30 text-amber-400 hover:border-amber-400";
                  const active = toneId === t.id;
                  return (
                    <button key={t.id} onClick={() => setToneId(t.id)}
                      className={`px-3 py-1.5 rounded-full text-[11px] transition-all border ${
                        active ? "bg-amber-500 text-black border-amber-500 font-bold" : palette
                      }`}>{t.labelAr}</button>
                  );
                })}
              </div>
            </div>

            {/* Text */}
            <div>
              <p className="text-[11px] text-amber-600 mb-1.5 font-medium">النص <span className="text-amber-700">({text.length}/4000)</span></p>
              <Textarea value={text} onChange={e => setText(e.target.value)} maxLength={4000} rows={4} dir="rtl"
                placeholder="اكتب الحوار هنا..."
                className="bg-black/30 border-amber-500/20 text-amber-100 placeholder:text-amber-800 resize-none text-sm focus:border-amber-400" />
            </div>

            {/* Intensity + Speed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] text-amber-600">
                  <span>كثافة الأداء</span>
                  <span className="text-amber-400 font-medium">{intensity[0]}%</span>
                </div>
                <Slider value={intensity} onValueChange={setIntensity} min={10} max={100} step={5}
                  className="[&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-amber-400" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] text-amber-600">
                  <span>السرعة</span>
                  <span className="text-amber-400 font-medium">{speed[0]}%</span>
                </div>
                <Slider value={speed} onValueChange={setSpeed} min={70} max={130} step={5}
                  className="[&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-amber-400" />
              </div>
            </div>

            {/* Demo presets — أمثلة جاهزة بصوت مميز */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-3 space-y-2">
              <p className="text-[11px] text-amber-500 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> أمثلة سريعة — اضغط لتوليد فوري
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { c: "zelda",    tn: "zelda_bloodmoon",  txt: "عندما يسطع ضوء القمر الأحمر على الأرض، يستيقظ الشر مرة أخرى… كن حذراً يا لينك، الكائنات الشريرة تعود إلى الحياة.", label: "👸 زيلدا · القمر الأحمر", grad: "from-purple-600/30 to-blue-600/30 border-purple-500/40" },
                  { c: "ganon",    tn: "ganon_demon_king", txt: "هذا العالم… سيخضع لإرادتي. لا أحد، ولا حتى أنت أيها البطل الصغير، يستطيع إيقافي.",                                              label: "💀 غانون · شرير",       grad: "from-red-700/30 to-orange-900/30 border-red-500/40" },
                  { c: "narrator", tn: "narrator_epic",    txt: "في أرض هايرول القديمة، حيث تتلاقى السماء بالأرض، بدأت أسطورة جديدة تُكتب بحبر النور والظلام.",                                  label: "🎭 الراوي · ملحمي",   grad: "from-amber-600/30 to-yellow-800/30 border-amber-500/40" },
                ].map(p => (
                  <button key={p.c + p.tn}
                    disabled={loading}
                    onClick={async () => {
                      onCharChange(p.c); setToneId(p.tn); setText(p.txt);
                      setLoading(true);
                      try {
                        const url = await tts(p.c, p.txt, p.tn, { intensityPct: 85, speedPct: 95 });
                        const ch = findCharacter(p.c)!;
                        const tones = getTonesForCharacter(ch);
                        const tn = tones.find(x => x.id === p.tn) ?? tones[0];
                        const take: Take = { id: crypto.randomUUID(), charId: p.c, charName: ch.nameAr, text: p.txt, url, toneId: tn.id, toneLabel: tn.labelAr };
                        setTakes(prev => [take, ...prev].slice(0, 30));
                        setPlayId(take.id);
                        if (audioRef.current) { audioRef.current.src = url; audioRef.current.play().catch(() => {}); }
                        toast({ title: `🎬 ${ch.nameAr} · ${tn.labelAr}` });
                      } catch (e) {
                        toast({ title: "❌ خطأ", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
                      } finally { setLoading(false); }
                    }}
                    className={`rounded-lg p-2.5 text-[10px] text-amber-100 border bg-gradient-to-br hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-right leading-tight ${p.grad}`}>
                    <div className="font-bold mb-1">{p.label}</div>
                    <div className="text-[9px] text-amber-200/70 line-clamp-2">{p.txt}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate */}
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button onClick={onGenerate} disabled={loading} size="lg"
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-bold text-base h-12">
                {loading
                  ? <><Loader2 className="w-5 h-5 ml-2 animate-spin" />جارٍ التوليد...</>
                  : <><Wand2 className="w-5 h-5 ml-2" />توليد {activeChar.nameAr} {activeChar.emoji} · {activeTone.labelAr}</>
                }
              </Button>
            </motion.div>

            {/* Takes */}
            {takes.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-amber-600 font-medium">التسجيلات ({takes.length})</p>
                <AnimatePresence initial={false}>
                  {takes.map(t => {
                    const ch = findCharacter(t.charId);
                    return (
                      <motion.div key={t.id}
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/10 bg-amber-950/20">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{ch?.emoji} {t.charName}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300">{t.toneLabel}</span>
                          </div>
                          <p className="text-xs text-amber-200 truncate">{t.text}</p>
                        </div>
                        <button onClick={() => {
                          if (!audioRef.current) return;
                          if (playId === t.id) { audioRef.current.pause(); setPlayId(null); return; }
                          audioRef.current.src = t.url; audioRef.current.play(); setPlayId(t.id);
                        }} className="p-2 rounded-lg hover:bg-amber-400/10 text-amber-400 shrink-0 h-9 w-9">
                          {playId === t.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <a href={t.url} download={`${t.charName}_${t.toneLabel}.wav`}
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

          {/* ══════════════ SCENE TIMELINE ═══════════════════ */}
          <TabsContent value="script" className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-semibold text-amber-300 flex items-center gap-2"><Film className="w-4 h-4" /> محرّر المشهد</p>
              <Button size="sm" variant="outline"
                onClick={() => setScript(p => [...p, { id: crypto.randomUUID(), charId: "narrator", toneId: "neutral", text: "" }])}
                className="border-amber-500/30 text-amber-400 hover:bg-amber-400/10 h-9 gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" /> سطر جديد
              </Button>
            </div>

            <div className="space-y-2 max-h-[55vh] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] touch-pan-y pr-1">
              <AnimatePresence>
                {script.map((line, idx) => {
                  const ch = findCharacter(line.charId) ?? CHARACTERS[0];
                  const lineTones = getTonesForCharacter(ch);
                  // ضمان نبرة صالحة
                  const safeToneId = lineTones.some(t => t.id === line.toneId) ? line.toneId : lineTones[0]?.id ?? "neutral";
                  return (
                    <motion.div key={line.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }}
                      className="rounded-xl border border-amber-500/10 bg-amber-950/20 p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-amber-700 w-5 shrink-0 text-center">{idx + 1}</span>
                        <select value={line.charId}
                          onChange={e => {
                            const newCh = findCharacter(e.target.value);
                            const newTones = newCh ? getTonesForCharacter(newCh) : [];
                            const keep = newTones.some(t => t.id === line.toneId) ? line.toneId : (newTones[0]?.id ?? "neutral");
                            setScript(p => p.map(l => l.id === line.id ? { ...l, charId: e.target.value, toneId: keep } : l));
                          }}
                          className="text-[11px] bg-black/30 border border-amber-500/20 rounded-lg px-2 py-1.5 text-amber-300 flex-1 min-w-[120px] h-9">
                          {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nameAr}</option>)}
                        </select>
                        <select value={safeToneId}
                          onChange={e => setScript(p => p.map(l => l.id === line.id ? { ...l, toneId: e.target.value } : l))}
                          className="text-[11px] bg-black/30 border border-purple-500/30 rounded-lg px-2 py-1.5 text-purple-300 flex-1 min-w-[100px] h-9">
                          {lineTones.map(t => <option key={t.id} value={t.id}>{t.labelAr}</option>)}
                        </select>
                        {line.busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                        {line.url && !line.busy && (
                          <button onClick={() => { if (audioRef.current) { audioRef.current.src = line.url!; audioRef.current.play(); } }}
                            className="p-1.5 text-emerald-400 hover:text-emerald-300 h-9 w-9"><Play className="w-3.5 h-3.5" /></button>
                        )}
                        {line.url && !line.busy && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                        <button onClick={() => setScript(p => p.filter(l => l.id !== line.id))}
                          className="p-1.5 text-red-400/50 hover:text-red-400 h-9 w-9"><X className="w-3.5 h-3.5" /></button>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sticky bottom-2">
              <Button onClick={onGenerateScript} disabled={scriptBusy || script.length === 0}
                className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-bold h-11">
                {scriptBusy
                  ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />توليد...</>
                  : <><Sparkles className="w-4 h-4 ml-2" />توليد ({script.length})</>}
              </Button>
              <Button onClick={onPlayScene} disabled={mixing}
                className="bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold h-11">
                {mixing ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <FileAudio className="w-4 h-4 ml-2" />}
                تشغيل المشهد
              </Button>
              <Button onClick={onExportZip} disabled={mixing}
                className="bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-bold h-11">
                <Package className="w-4 h-4 ml-2" />تصدير ZIP+SRT
              </Button>
            </div>
            {mixUrl && (
              <a href={mixUrl} download={`scene_${Date.now()}.wav`}
                className="block text-center text-xs text-amber-400 underline pt-1">⬇ تنزيل المشهد المدموج (WAV)</a>
            )}
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
              <Button onClick={onAnalyze} disabled={!labFile || labBusy}
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
              {takes.length === 0 ? (
                <p className="text-center text-xs text-amber-800 py-3">ولّد أصواتاً من تبويب الاستوديو أولاً</p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-amber-600 font-medium">المسارات</p>
                  {takes.slice(0, 8).map(t => {
                    const ch = findCharacter(t.charId);
                    return (
                      <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg border border-amber-500/10 bg-black/20">
                        <span className="text-sm shrink-0">{ch?.emoji}</span>
                        <span className="text-[11px] text-amber-300 flex-1 truncate">{t.charName}: {t.text.slice(0, 40)}{t.text.length > 40 ? "…" : ""}</span>
                        <a href={t.url} download={`mix_${t.charName}.wav`}
                          className="p-1.5 rounded hover:bg-amber-400/10 text-amber-500 shrink-0">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-amber-800 text-center pt-1">Reverb/Echo حقيقي قادم عبر Web Audio API</p>
            </div>
          </TabsContent>
        </Tabs>

        <p className="text-[10px] text-center text-amber-800 pb-2">
          {ENGINE_LABEL} · جميع الميزات تعمل عبر ElevenLabs بدون إعدادات إضافية
        </p>
      </div>
    </div>
  );
}
