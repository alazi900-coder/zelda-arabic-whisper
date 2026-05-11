import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Play, Pause, Download, Mic, ArrowRight, Trash2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Character {
  id: string;
  name: string;
  description: string;
}

const CHARACTERS: Character[] = [
  { id: "link", name: "Link — البطل", description: "صوت شاب حماسي" },
  { id: "zelda", name: "Zelda — الأميرة", description: "صوت أنثوي ملكي دافئ" },
  { id: "ganon", name: "Ganondorf", description: "صوت عميق مظلم شرير" },
  { id: "impa", name: "Impa", description: "صوت حكيمة عجوز" },
  { id: "purah", name: "Purah", description: "صوت عالِمة مرحة" },
  { id: "king", name: "Rhoam — الملك", description: "صوت ملكي مهيب" },
  { id: "sidon", name: "Sidon", description: "صوت بطولي ودود" },
  { id: "narrator", name: "الراوي", description: "صوت سرد رزين" },
  { id: "npc_male", name: "NPC ذكر عام", description: "قروي/تاجر" },
  { id: "npc_female", name: "NPC أنثى عام", description: "قروية/تاجرة" },
];

const STYLE_PRESETS = [
  { id: "", label: "بدون أسلوب محدد" },
  { id: "قل بصوت هادئ ومتأمّل", label: "هادئ ومتأمل" },
  { id: "قل بحماس وانفعال", label: "حماسي" },
  { id: "قل بصوت غاضب", label: "غاضب" },
  { id: "قل بصوت حزين", label: "حزين" },
  { id: "قل بهيبة ووقار ملكي", label: "ملكي مهيب" },
  { id: "قل بصوت مخيف ومنخفض", label: "مخيف" },
  { id: "قل بهمس", label: "همس" },
  { id: "قل بسرعة وعجلة", label: "سريع/عاجل" },
];

interface Take {
  id: string;
  character: string;
  characterName: string;
  text: string;
  url: string;
  blob: Blob;
}

const Dubbing = () => {
  const [text, setText] = useState("مرحباً يا Link، تحتاج إلى استعادة قوّتك قبل مواجهة Ganon.");
  const [character, setCharacter] = useState("zelda");
  const [style, setStyle] = useState("");
  const [volume, setVolume] = useState([85]);
  const [loading, setLoading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [takes, setTakes] = useState<Take[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const charObj = CHARACTERS.find(c => c.id === character)!;

  const generate = async () => {
    if (!text.trim()) {
      toast({ title: "أدخل نصاً", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts-dubbing`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text, voice: character, style }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "خطأ" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      const blob = await resp.blob();
      const audioUrl = URL.createObjectURL(blob);
      setCurrentUrl(audioUrl);

      const take: Take = {
        id: crypto.randomUUID(),
        character,
        characterName: charObj.name,
        text,
        url: audioUrl,
        blob,
      };
      setTakes(prev => [take, ...prev].slice(0, 30));

      // Auto-play
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.volume = volume[0] / 100;
          audioRef.current.play().catch(() => {});
        }
      }, 100);

      toast({ title: "تم توليد الصوت ✓", description: charObj.name });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل التوليد";
      toast({ title: "خطأ", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const downloadTake = (take: Take) => {
    const a = document.createElement("a");
    a.href = take.url;
    a.download = `dub_${take.character}_${Date.now()}.wav`;
    a.click();
  };

  const playTake = (take: Take) => {
    if (audioRef.current) {
      audioRef.current.src = take.url;
      audioRef.current.volume = volume[0] / 100;
      audioRef.current.play();
      setPlayingId(take.id);
    }
  };

  const removeTake = (id: string) => {
    setTakes(prev => {
      const t = prev.find(x => x.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter(x => x.id !== id);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80" dir="rtl">
      <div className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowRight className="w-4 h-4 ml-1" />
              العودة
            </Button>
          </Link>
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2 justify-center">
              <Mic className="w-7 h-7 text-primary" />
              استوديو الدبلجة العربية
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              توليد أصوات شخصيات Zelda بالعربية — مجاني عبر Lovable AI
            </p>
          </div>
          <div className="w-20" />
        </div>

        {/* Studio */}
        <Card className="p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الشخصية</Label>
              <Select value={character} onValueChange={setCharacter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHARACTERS.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex flex-col items-end">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>أسلوب الأداء</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger><SelectValue placeholder="اختر أسلوباً" /></SelectTrigger>
                <SelectContent>
                  {STYLE_PRESETS.map(s => (
                    <SelectItem key={s.id || "none"} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>النص العربي ({text.length} / 4000)</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="اكتب الجملة التي تريد دبلجتها..."
              className="min-h-[120px] text-base leading-loose"
              maxLength={4000}
              dir="rtl"
            />
          </div>

          <div className="space-y-2">
            <Label>مستوى الصوت: {volume[0]}%</Label>
            <Slider value={volume} onValueChange={setVolume} max={100} step={1} />
          </div>

          <div className="flex gap-2">
            <Button onClick={generate} disabled={loading} className="flex-1" size="lg">
              {loading ? (
                <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جارٍ التوليد...</>
              ) : (
                <><Plus className="w-4 h-4 ml-2" /> توليد الصوت</>
              )}
            </Button>
          </div>

          {currentUrl && (
            <div className="pt-2 border-t border-border/60">
              <Label className="text-xs text-muted-foreground mb-2 block">آخر تسجيل</Label>
              <audio
                ref={audioRef}
                src={currentUrl}
                controls
                className="w-full"
                onEnded={() => setPlayingId(null)}
              />
            </div>
          )}
        </Card>

        {/* Takes history */}
        {takes.length > 0 && (
          <Card className="p-5">
            <h2 className="font-semibold mb-3">التسجيلات ({takes.length})</h2>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {takes.map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 p-3 rounded-lg border border-border/60 bg-card/40"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/15 text-primary">
                        {t.characterName}
                      </span>
                    </div>
                    <p className="text-sm mt-1 truncate">{t.text}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => playTake(t)}>
                    {playingId === t.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => downloadTake(t)}>
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeTake(t.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        <p className="text-xs text-center text-muted-foreground">
          الأصوات مولّدة بـ Gemini TTS. النتائج WAV بجودة 24kHz. يمكن استخدامها في الدبلجة الشخصية.
        </p>
      </div>
    </div>
  );
};

export default Dubbing;
