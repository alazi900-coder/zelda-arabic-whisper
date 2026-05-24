// ============================================================
// AudioDub — صفحة دبلجة آلية: تحلّل المقطع الأصلي وتولّد دبلجة عربية
// مع نبرة مقاربة وتحميل WAV + SRT أو حزمة ZIP كاملة.
// ============================================================
import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Upload, Loader2, Wand2, Download, Package, Volume2,
  Mic, Sparkles, AlertCircle, Play, Pause,
} from "lucide-react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { decodeBwavToPcm } from "@/lib/audio/bwav";
import { encodeWav } from "@/lib/audio/wav-encoder";

interface Analysis {
  transcript: string;
  sourceLanguage: string;
  emotion: string;
  tone: string;
  gender: "male" | "female" | "unknown";
  ageGroup: string;
  pitch: string;
  speed: string;
  intensity: number;
  arabicTranslation: string;
  suggestedZeldaVoice: string;
  dubbingDirection: string;
}

type Stage = "idle" | "decoding" | "analyzing" | "ready" | "dubbing" | "done";

const VOICE_LABELS: Record<string, string> = {
  link: "Link — بطولي شاب",
  zelda: "Zelda — أنثى ملكية",
  ganon: "Ganon — شرير عميق",
  impa: "Impa — حكيمة",
  purah: "Purah — مرحة",
  king: "King — مهيب",
  sidon: "Sidon — ودود حماسي",
  npc_male: "NPC ذكر",
  npc_female: "NPC أنثى",
  narrator: "الراوي",
};

function fileToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const mm = Math.floor(ms % 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(mm, 3)}`;
}

async function getAudioDurationMs(blob: Blob): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
  const ctx: AudioContext = new Ctx();
  try {
    const arr = await blob.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr.slice(0));
    return (buf.length / buf.sampleRate) * 1000;
  } finally {
    if (ctx.state !== "closed") ctx.close().catch(() => {});
  }
}

// توليد WAV صامت بطول معيّن (للوضع التجريبي)
function makeSilentWav(durationSec: number, sampleRate = 22050): Blob {
  const samples = new Int16Array(Math.max(1, Math.floor(durationSec * sampleRate)));
  const wav = encodeWav(samples, 1, sampleRate);
  return new Blob([new Uint8Array(wav).buffer as ArrayBuffer], { type: "audio/wav" });
}

// معاينة صوتية عبر Web Speech API
function previewTTS(text: string) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ar-SA";
  u.rate = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const ar = voices.find((v) => v.lang?.toLowerCase().startsWith("ar"));
  if (ar) u.voice = ar;
  window.speechSynthesis.speak(u);
  return true;
}

export default function AudioDub() {
  const { toast } = useToast();
  const [demoMode, setDemoMode] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("gemini_api_key") || "");
  const [file, setFile] = useState<File | null>(null);
  const [origUrl, setOrigUrl] = useState<string | null>(null);
  const [origMime, setOrigMime] = useState<string>("audio/wav");
  const [origBase64, setOrigBase64] = useState<string>("");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [editedText, setEditedText] = useState("");
  const [manualText, setManualText] = useState("");
  const [voiceOverride, setVoiceOverride] = useState<string>("");
  const [dubUrl, setDubUrl] = useState<string | null>(null);
  const [dubBlob, setDubBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const origAudioRef = useRef<HTMLAudioElement | null>(null);
  const dubAudioRef = useRef<HTMLAudioElement | null>(null);
  const [origPlaying, setOrigPlaying] = useState(false);
  const [dubPlaying, setDubPlaying] = useState(false);

  const finalVoice = voiceOverride || analysis?.suggestedZeldaVoice || "narrator";

  const reset = useCallback(() => {
    if (origUrl) URL.revokeObjectURL(origUrl);
    if (dubUrl) URL.revokeObjectURL(dubUrl);
    setFile(null); setOrigUrl(null); setOrigBase64(""); setOrigMime("audio/wav");
    setAnalysis(null); setEditedText(""); setVoiceOverride("");
    setDubUrl(null); setDubBlob(null);
    setStage("idle"); setProgress(0); setError(null);
  }, [origUrl, dubUrl]);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    if (origUrl) URL.revokeObjectURL(origUrl);
    if (dubUrl) URL.revokeObjectURL(dubUrl);
    setFile(f); setAnalysis(null); setDubUrl(null); setDubBlob(null); setEditedText("");
    setStage("decoding"); setProgress(15);
    try {
      let bytes: ArrayBuffer;
      let mime = f.type || "audio/wav";
      const name = f.name.toLowerCase();

      if (name.endsWith(".bwav")) {
        // فك BWAV إلى WAV قياسي
        const buf = new Uint8Array(await f.arrayBuffer());
        const { samples, sampleRate, channels } = await decodeBwavToPcm(buf);
        const wav = encodeWav(samples, channels, sampleRate);
        bytes = wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer;
        mime = "audio/wav";
      } else {
        bytes = await f.arrayBuffer();
        if (!mime || mime === "application/octet-stream") {
          if (name.endsWith(".mp3")) mime = "audio/mpeg";
          else if (name.endsWith(".m4a")) mime = "audio/mp4";
          else if (name.endsWith(".ogg")) mime = "audio/ogg";
          else if (name.endsWith(".flac")) mime = "audio/flac";
          else mime = "audio/wav";
        }
      }
      const blob = new Blob([bytes], { type: mime });
      setOrigUrl(URL.createObjectURL(blob));
      setOrigMime(mime);
      setOrigBase64(fileToBase64(bytes));
      setStage("idle"); setProgress(0);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "فشل قراءة الملف");
      setStage("idle"); setProgress(0);
    }
  }, [origUrl, dubUrl]);

  const onAnalyze = useCallback(async () => {
    if (!origBase64) return;
    setStage("analyzing"); setProgress(40); setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("analyze-audio", {
        body: { audioBase64: origBase64, mimeType: origMime },
      });
      if (invokeErr) throw new Error(invokeErr.message || "فشل التحليل");
      if (!data?.analysis) throw new Error(data?.error || "تحليل فارغ");
      const a = data.analysis as Analysis;
      setAnalysis(a);
      setEditedText(a.arabicTranslation || "");
      setStage("ready"); setProgress(100);
      toast({ title: "تم التحليل ✓", description: `${a.emotion} — ${a.sourceLanguage}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل غير معروف";
      setError(msg); setStage("idle"); setProgress(0);
      toast({ title: "فشل التحليل", description: msg, variant: "destructive" });
    }
  }, [origBase64, origMime, toast]);

  const onGenerateDub = useCallback(async () => {
    if (!editedText.trim() || !analysis) return;
    setStage("dubbing"); setProgress(40); setError(null);
    if (dubUrl) URL.revokeObjectURL(dubUrl);
    setDubUrl(null); setDubBlob(null);
    try {
      const { resolveElevenVoiceId } = await import("@/lib/dubbing/elevenlabs-voices");
      const voiceId = resolveElevenVoiceId(finalVoice);
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts-dubbing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: editedText, voiceId }),
        },
      );
      if (!resp.ok) {
        let msg = `فشل التوليد: ${resp.status}`;
        try { const j = await resp.json(); msg = j?.error || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const blob = await resp.blob();
      setDubBlob(blob);
      setDubUrl(URL.createObjectURL(blob));
      setStage("done"); setProgress(100);
      toast({ title: "تمّت الدبلجة ✓" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل التوليد";
      setError(msg); setStage("ready"); setProgress(0);
      toast({ title: "فشل التوليد", description: msg, variant: "destructive" });
    }
  }, [editedText, analysis, finalVoice, dubUrl, toast]);

  const onGenerateDemo = useCallback(() => {
    const text = manualText.trim();
    if (!text) { toast({ title: "اكتب النص العربي أولاً", variant: "destructive" }); return; }
    setStage("dubbing"); setProgress(60); setError(null);
    if (dubUrl) URL.revokeObjectURL(dubUrl);
    // تقدير المدة: ~12 حرف/ثانية للعربية المنطوقة
    const durSec = Math.max(1.5, Math.min(120, text.length / 12));
    const blob = makeSilentWav(durSec);
    setDubBlob(blob);
    setDubUrl(URL.createObjectURL(blob));
    setEditedText(text);
    setStage("done"); setProgress(100);
    toast({
      title: "تم توليد ملف تجريبي ✓",
      description: "WAV صامت بطول مقدّر + SRT. استخدم زر المعاينة لسماع TTS المتصفح.",
    });
  }, [manualText, dubUrl, toast]);

  const downloadDubAndSrt = useCallback(async () => {

    if (!dubBlob) return;
    const baseName = file?.name.replace(/\.[^.]+$/, "") || "dub";
    // download wav
    const a = document.createElement("a");
    a.href = URL.createObjectURL(dubBlob);
    a.download = `${baseName}_ar.wav`;
    a.click();
    URL.revokeObjectURL(a.href);
    // build SRT
    const dur = await getAudioDurationMs(dubBlob);
    const srt = `1\n${msToSrtTime(0)} --> ${msToSrtTime(dur)}\n${editedText}\n`;
    const srtBlob = new Blob([srt], { type: "application/x-subrip;charset=utf-8" });
    const b = document.createElement("a");
    b.href = URL.createObjectURL(srtBlob);
    b.download = `${baseName}_ar.srt`;
    b.click();
    URL.revokeObjectURL(b.href);
  }, [dubBlob, editedText, file]);

  const downloadZip = useCallback(async () => {
    if (!dubBlob || !file || !analysis) return;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "dub";
    const zip = new JSZip();
    // ملف عربي مدبلج
    zip.file(`${baseName}_ar.wav`, dubBlob);
    // النص الأصلي
    zip.file(`${baseName}_original.txt`, analysis.transcript || "");
    // الترجمة
    zip.file(`${baseName}_arabic.txt`, editedText);
    // التحليل JSON
    zip.file(`${baseName}_analysis.json`, JSON.stringify(analysis, null, 2));
    // SRT
    const dur = await getAudioDurationMs(dubBlob);
    const srt = `1\n${msToSrtTime(0)} --> ${msToSrtTime(dur)}\n${editedText}\n`;
    zip.file(`${baseName}_ar.srt`, srt);
    // الملف الأصلي بصيغة WAV
    if (origUrl) {
      const origBlob = await (await fetch(origUrl)).blob();
      zip.file(`${baseName}_source.${origMime.includes("mpeg") ? "mp3" : "wav"}`, origBlob);
    }
    const out = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(out);
    a.download = `${baseName}_dub_bundle.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [dubBlob, file, analysis, editedText, origUrl, origMime]);

  const togglePlay = useCallback((which: "orig" | "dub") => {
    const ref = which === "orig" ? origAudioRef.current : dubAudioRef.current;
    const playing = which === "orig" ? origPlaying : dubPlaying;
    const setPlaying = which === "orig" ? setOrigPlaying : setDubPlaying;
    if (!ref) return;
    if (playing) { ref.pause(); setPlaying(false); }
    else { ref.play(); setPlaying(true); }
  }, [origPlaying, dubPlaying]);

  const busy = stage === "decoding" || stage === "analyzing" || stage === "dubbing";

  const intensityBar = useMemo(() => {
    if (!analysis) return 0;
    return Math.max(0, Math.min(100, (Number(analysis.intensity) || 5) * 10));
  }, [analysis]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] via-background to-[#0a0e1a] text-foreground" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowRight className="w-4 h-4" /> الرئيسية
          </Link>
          <Badge variant="outline" className="border-secondary/40 text-secondary">جديد · بالذكاء الاصطناعي</Badge>
        </div>

        <header className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full bg-secondary/10 border border-secondary/30">
            <Mic className="w-4 h-4 text-secondary" />
            <span className="text-xs font-display font-semibold text-secondary">دبلجة آلية ذكية</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-black mb-2">
            دبلجة صوت تلقائية للعربية
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            ارفع مقطع صوت من اللعبة (BWAV/WAV/MP3)، سنحلّل النص والنبرة والعاطفة، ثم نولّد دبلجة عربية بصوت مقارب.
          </p>
        </header>

        {/* Engine badge */}
        <Card className="p-3 mb-4 border-emerald-500/30 bg-emerald-500/5 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs text-emerald-300">المحرك: <b>ElevenLabs multilingual v2</b> — لا حاجة لمفتاح من المستخدم</span>
          <div className="w-2 h-2 rounded-full bg-emerald-400 ml-auto" />
        </Card>

        {/* Mode toggle */}
        <Card className="p-3 mb-4 border-border/60 bg-card/80 backdrop-blur flex items-center gap-2">
          <Button size="sm" variant={!demoMode ? "default" : "outline"} onClick={() => setDemoMode(false)} className="flex-1">
            <Sparkles className="w-3.5 h-3.5 ml-1" /> دبلجة بالذكاء (ElevenLabs)
          </Button>
          <Button size="sm" variant={demoMode ? "default" : "outline"} onClick={() => setDemoMode(true)} className="flex-1">
            <Mic className="w-3.5 h-3.5 ml-1" /> وضع تجريبي (نص يدوي)
          </Button>
        </Card>

        {/* Demo mode panel */}
        {demoMode && (
          <Card className="p-5 mb-4 border-amber-500/40 bg-amber-500/5">
            <h2 className="text-base font-display font-bold mb-2 flex items-center gap-2 text-amber-400">
              <Mic className="w-4 h-4" /> وضع تجريبي — كتابة يدوية
            </h2>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              اكتب النص العربي بنفسك. سيتم توليد ملف WAV بطول مقدَّر + ملف SRT متزامن. يمكن سماع معاينة عبر TTS المتصفح.
            </p>
            <Label htmlFor="manual" className="text-xs text-muted-foreground mb-1.5 block">النص العربي</Label>
            <Textarea id="manual" value={manualText} onChange={(e) => setManualText(e.target.value)}
              placeholder="اكتب جملة الدبلجة العربية هنا..." rows={4} className="text-sm mb-3" dir="rtl" />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => {
                if (!previewTTS(manualText)) toast({ title: "TTS المتصفح غير متوفر", variant: "destructive" });
              }} variant="outline" disabled={!manualText.trim()}>
                <Play className="w-4 h-4 ml-2" /> معاينة صوتية
              </Button>
              <Button onClick={onGenerateDemo} disabled={!manualText.trim()}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-background font-bold">
                <Wand2 className="w-4 h-4 ml-2" /> توليد WAV + SRT
              </Button>
            </div>
          </Card>
        )}

        {/* Upload (AI mode only) */}
        {!demoMode && (
        <Card className="p-5 mb-4 border-secondary/30 bg-gradient-to-br from-secondary/5 to-card">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <label className="flex-1 cursor-pointer">
              <input type="file" accept=".bwav,.wav,.mp3,.m4a,.ogg,.flac,audio/*"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden" disabled={busy} />
              <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-secondary/40 hover:border-secondary/70 hover:bg-secondary/5 transition-all">
                <Upload className="w-5 h-5 text-secondary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {file ? file.name : "اختر ملف صوتي (BWAV / WAV / MP3...)"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : "BWAV من TotK/BotW أو أي صيغة قياسية"}
                  </div>
                </div>
              </div>
            </label>

            {file && (
              <Button variant="outline" size="sm" onClick={reset} disabled={busy}>
                إعادة تعيين
              </Button>
            )}
          </div>

          {origUrl && (
            <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-background/40 border border-border/40">
              <Button size="icon" variant="ghost" onClick={() => togglePlay("orig")}>
                {origPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground flex-1">المقطع الأصلي</span>
              <audio ref={origAudioRef} src={origUrl} onEnded={() => setOrigPlaying(false)} />
            </div>
          )}
        </Card>
        )}

        {/* Stage progress */}
        {busy && (
          <Card className="p-4 mb-4 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm font-semibold">
                {stage === "decoding" && "جارٍ فكّ ترميز الصوت..."}
                {stage === "analyzing" && "جارٍ تحليل النبرة والعاطفة بالذكاء الاصطناعي..."}
                {stage === "dubbing" && "جارٍ توليد الدبلجة العربية..."}
              </span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="p-3 mb-4 border-destructive/40 bg-destructive/10 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <span className="text-sm text-destructive">{error}</span>
          </Card>
        )}

        {/* Analyze button */}
        {origBase64 && !analysis && !busy && (
          <Button onClick={onAnalyze} size="lg"
            className="w-full mb-4 bg-gradient-to-r from-secondary to-primary text-background font-bold">
            <Wand2 className="w-5 h-5 ml-2" />
            تحليل الصوت بالذكاء الاصطناعي
          </Button>
        )}

        {/* Analysis result */}
        {analysis && (
          <Card className="p-5 mb-4 border-primary/30 bg-gradient-to-br from-primary/5 to-card">
            <h2 className="text-lg font-display font-bold mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              نتائج التحليل
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <InfoTile label="اللغة" value={analysis.sourceLanguage} />
              <InfoTile label="العاطفة" value={analysis.emotion} />
              <InfoTile label="الجنس" value={analysis.gender === "male" ? "ذكر" : analysis.gender === "female" ? "أنثى" : "غير محدد"} />
              <InfoTile label="السرعة" value={analysis.speed} />
            </div>

            <div className="mb-4">
              <Label className="text-xs text-muted-foreground mb-1.5 block">الشدّة العاطفية</Label>
              <Progress value={intensityBar} className="h-2" />
            </div>

            <div className="mb-4 p-3 rounded-lg bg-background/40 border border-border/30">
              <div className="text-xs text-muted-foreground mb-1">النبرة المكتشفة</div>
              <div className="text-sm">{analysis.tone}</div>
              <div className="text-xs text-secondary mt-2">{analysis.dubbingDirection}</div>
            </div>

            <div className="mb-4">
              <Label className="text-xs text-muted-foreground mb-1.5 block">النص الأصلي المنطوق</Label>
              <div className="p-3 rounded-lg bg-background/40 border border-border/30 text-sm font-mono ltr:text-left" dir="auto">
                {analysis.transcript}
              </div>
            </div>

            <div className="mb-4">
              <Label htmlFor="ar" className="text-xs text-muted-foreground mb-1.5 block">
                الترجمة العربية (قابلة للتعديل)
              </Label>
              <Textarea id="ar" value={editedText} onChange={(e) => setEditedText(e.target.value)}
                rows={4} className="text-sm" disabled={busy} />
            </div>

            <div className="mb-4">
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                صوت الدبلجة (الاقتراح: <span className="text-primary">{VOICE_LABELS[analysis.suggestedZeldaVoice] || analysis.suggestedZeldaVoice}</span>)
              </Label>
              <select value={voiceOverride || analysis.suggestedZeldaVoice}
                onChange={(e) => setVoiceOverride(e.target.value)}
                disabled={busy}
                className="w-full p-2 rounded-md bg-background border border-border text-sm">
                {Object.entries(VOICE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <Button onClick={onGenerateDub} disabled={busy || !editedText.trim()} size="lg"
              className="w-full bg-gradient-to-r from-primary to-secondary text-background font-bold">
              <Mic className="w-5 h-5 ml-2" />
              توليد الدبلجة العربية
            </Button>
          </Card>
        )}

        {/* Dubbed result */}
        {dubUrl && (
          <Card className="p-5 mb-4 border-emerald-500/40 bg-emerald-500/5">
            <h2 className="text-lg font-display font-bold mb-3 flex items-center gap-2 text-emerald-400">
              <Sparkles className="w-4 h-4" />
              الدبلجة جاهزة
            </h2>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/40 border border-border/40 mb-4">
              <Button size="icon" variant="ghost" onClick={() => togglePlay("dub")}>
                {dubPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-muted-foreground flex-1">الصوت العربي المُولَّد</span>
              <audio ref={dubAudioRef} src={dubUrl} onEnded={() => setDubPlaying(false)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={downloadDubAndSrt} variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                <Download className="w-4 h-4 ml-2" />
                ملف الصوت + SRT
              </Button>
              <Button onClick={downloadZip} variant="outline" className="border-emerald-500/40">
                <Package className="w-4 h-4 ml-2" />
                حزمة ZIP كاملة
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              حزمة ZIP تتضمّن: الصوت الأصلي + الصوت العربي + النص الأصلي + الترجمة + SRT + تحليل JSON.
            </p>
          </Card>
        )}

        <p className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed">
          المعالجة تتمّ عبر Gemini (تحليل + ترجمة + توليد صوت). استنساخ نبرة الصوت الأصلي بدقة أعلى ممكن لاحقاً عبر ElevenLabs.
        </p>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-lg bg-background/40 border border-border/30 text-center">
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className="text-xs font-semibold truncate">{value}</div>
    </div>
  );
}
