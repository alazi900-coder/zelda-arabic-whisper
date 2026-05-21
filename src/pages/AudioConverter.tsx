import { useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, FileAudio, Download, Loader2, Music2, Play, Pause, AlertCircle, CheckCircle2, Upload, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { decodeBwavToPcm, parseBwav, type BwavInfo } from "@/lib/audio/bwav";
import { encodeWav } from "@/lib/audio/wav-encoder";

interface ConvertedFile {
  name: string;
  originalSize: number;
  wavBlob: Blob;
  wavUrl: string;
  info: BwavInfo;
  durationSec: number;
}

const codecLabel = (c: string) => ({
  pcm16: "PCM16 (غير مضغوط)",
  dsp: "DSP-ADPCM (Switch/Wii)",
  opus: "NXOpus (TotK/BotW)",
  unknown: "غير معروف",
}[c] || c);

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const AudioConverter = () => {
  const [files, setFiles] = useState<ConvertedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const processFiles = useCallback(async (incoming: File[]) => {
    if (incoming.length === 0) return;
    setBusy(true);
    setProgress(0);
    const out: ConvertedFile[] = [];
    let errCount = 0;
    for (let i = 0; i < incoming.length; i++) {
      const f = incoming[i];
      try {
        const buf = new Uint8Array(await f.arrayBuffer());
        // quick header check for nicer error message
        try { parseBwav(buf); } catch (e) {
          throw new Error(`${f.name}: ${(e as Error).message}`);
        }
        const { samples, sampleRate, channels, info } = await decodeBwavToPcm(buf);
        const wav = encodeWav(samples, channels, sampleRate);
        const blob = new Blob([new Uint8Array(wav)], { type: "audio/wav" });
        out.push({
          name: f.name.replace(/\.bwav$/i, "") + ".wav",
          originalSize: f.size,
          wavBlob: blob,
          wavUrl: URL.createObjectURL(blob),
          info,
          durationSec: (samples.length / channels) / sampleRate,
        });
      } catch (e) {
        errCount++;
        toast({ title: "فشل تحويل ملف", description: (e as Error).message, variant: "destructive" });
      }
      setProgress(Math.round(((i + 1) / incoming.length) * 100));
    }
    setFiles(prev => [...out, ...prev]);
    setBusy(false);
    if (out.length > 0) {
      toast({
        title: `تم تحويل ${out.length} ملف`,
        description: errCount > 0 ? `فشل ${errCount} ملف` : "كل الملفات جاهزة للتحميل",
      });
    }
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files));
  };

  const downloadOne = (f: ConvertedFile) => {
    const a = document.createElement("a");
    a.href = f.wavUrl;
    a.download = f.name;
    a.click();
  };

  const downloadAll = async () => {
    if (files.length === 1) return downloadOne(files[0]);
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const f of files) zip.file(f.name, f.wavBlob);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bwav-converted-${files.length}-files.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const togglePlay = (idx: number) => {
    if (playingIdx === idx) {
      audioRef.current?.pause();
      setPlayingIdx(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(files[idx].wavUrl);
    audio.onended = () => setPlayingIdx(null);
    audio.play().catch(err => {
      toast({ title: "تعذّر التشغيل", description: err.message, variant: "destructive" });
      setPlayingIdx(null);
    });
    audioRef.current = audio;
    setPlayingIdx(idx);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <Badge variant="outline" className="border-primary/40 text-primary">
            <Music2 className="w-3 h-3 ml-1" />
            محوّل أصوات
          </Badge>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/10 border border-primary/30 mb-4">
            <FileAudio className="w-8 h-8 text-primary drop-shadow-[0_0_12px_hsl(var(--primary))]" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-display font-black mb-2">
            محوّل أصوات{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-secondary to-primary">زيلدا</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            حوّل ملفات BWAV (TotK/BotW) إلى WAV قياسي يعمل في أي مشغّل — يدعم PCM16، DSP-ADPCM، و NXOpus
          </p>
        </motion.div>

        {/* Upload zone */}
        <Card
          className={`relative p-6 sm:p-10 border-2 border-dashed transition-all ${
            dragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-7 h-7 text-primary" />
            </div>
            <h2 className="font-display font-bold text-lg sm:text-xl">
              اسحب ملفات .bwav هنا أو اضغط للاختيار
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
              يمكنك رفع عدة ملفات دفعة واحدة. المعالجة كلّها في متصفّحك — لا يُرفع شيء للخادم.
            </p>
            <label className="mt-2">
              <input
                type="file"
                accept=".bwav,application/octet-stream"
                multiple
                onChange={onInputChange}
                className="hidden"
                disabled={busy}
              />
              <Button asChild size="lg" disabled={busy} className="font-display">
                <span>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <FileAudio className="w-4 h-4 ml-2" />}
                  {busy ? "جارٍ التحويل..." : "اختر ملفات BWAV"}
                </span>
              </Button>
            </label>
          </div>

          {busy && (
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>جارٍ المعالجة</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </Card>

        {/* Notice about WAV → BWAV */}
        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-secondary/10 border border-secondary/30 text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-foreground">ملاحظة:</strong> التحويل العكسي (WAV → BWAV) قيد التطوير — مكتبة vgmstream الرسمية تدعم القراءة فقط. سيُضاف لاحقًا عبر أداة منفصلة للترميز.
          </p>
        </div>

        {/* Results */}
        {files.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                ملفات جاهزة ({files.length})
              </h2>
              {files.length > 1 && (
                <Button onClick={downloadAll} size="sm" className="font-display">
                  <Download className="w-4 h-4 ml-1" />
                  تحميل الكل (ZIP)
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {files.map((f, idx) => (
                <motion.div
                  key={`${f.name}-${idx}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Card className="p-3 sm:p-4 hover:border-primary/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => togglePlay(idx)}
                        className="shrink-0 w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/30 flex items-center justify-center transition-colors"
                        title="تشغيل المعاينة"
                      >
                        {playingIdx === idx ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 text-primary mr-[-2px]" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate" title={f.name}>{f.name}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <Badge variant="secondary" className="text-[10px] h-5">{codecLabel(f.info.codec)}</Badge>
                          <Badge variant="outline" className="text-[10px] h-5">{f.info.sampleRate} Hz</Badge>
                          <Badge variant="outline" className="text-[10px] h-5">{f.info.channels === 1 ? "Mono" : f.info.channels === 2 ? "Stereo" : `${f.info.channels} ch`}</Badge>
                          <Badge variant="outline" className="text-[10px] h-5"><Volume2 className="w-2.5 h-2.5 ml-0.5" />{formatTime(f.durationSec)}</Badge>
                          <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">{formatBytes(f.originalSize)} → {formatBytes(f.wavBlob.size)}</Badge>
                        </div>
                      </div>
                      <Button onClick={() => downloadOne(f)} size="sm" variant="outline" className="shrink-0">
                        <Download className="w-4 h-4 ml-1" />
                        تحميل
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Features grid */}
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {[
            { label: "PCM16", desc: "غير مضغوط" },
            { label: "DSP-ADPCM", desc: "Switch / Wii" },
            { label: "NXOpus", desc: "TotK / BotW" },
            { label: "متعدد القنوات", desc: "Mono / Stereo+" },
          ].map((it) => (
            <div key={it.label} className="p-3 rounded-lg bg-card/60 border border-border">
              <div className="text-sm font-display font-bold text-primary">{it.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{it.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AudioConverter;
