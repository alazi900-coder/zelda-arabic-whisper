// Analyze an audio clip:
//   1) ElevenLabs Scribe (speech-to-text)  — uses ELEVENLABS_API_KEY
//   2) Lovable AI Gateway (Gemini) for emotion/tone/translation JSON — uses LOVABLE_API_KEY
// No client-side keys required.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ELEVEN_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!ELEVEN_KEY)  return json({ error: "ELEVENLABS_API_KEY غير مهيّأ" }, 500);
    if (!LOVABLE_KEY) return json({ error: "LOVABLE_API_KEY غير مهيّأ" }, 500);

    const { audioBase64, mimeType } = await req.json();
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return json({ error: "audioBase64 مطلوب" }, 400);
    }

    // 1) Speech-to-text via ElevenLabs Scribe
    const bytes = b64ToBytes(audioBase64);
    const fd = new FormData();
    fd.append("file", new Blob([bytes], { type: mimeType || "audio/wav" }), "audio");
    fd.append("model_id", "scribe_v2");
    fd.append("tag_audio_events", "true");
    fd.append("diarize", "false");

    const sttResp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": ELEVEN_KEY },
      body: fd,
    });
    if (!sttResp.ok) {
      const detail = await sttResp.text();
      console.error("Scribe error", sttResp.status, detail);
      return json({ error: `فشل التفريغ: ${sttResp.status}`, detail: detail.slice(0, 500) }, 500);
    }
    const sttData = await sttResp.json();
    const transcript: string = sttData?.text || "";
    const sourceLang: string = sttData?.language_code || sttData?.language || "unknown";

    // 2) Gemini (via Lovable AI Gateway) — emotion + translation JSON
    const prompt = `أنت مخرج دبلجة عربية. النص التالي مفرّغ من مقطع صوتي بلغة "${sourceLang}":
"""${transcript}"""

أعد JSON خام فقط بهذا الشكل بدون أي شرح أو علامات markdown:
{
 "transcript": "${transcript.replace(/"/g, '\\"')}",
 "sourceLanguage": "اسم اللغة بالعربية",
 "emotion": "العاطفة الأساسية (غاضب/حزين/خائف/هامس/بطولي/مرح/جاد/رثاء/شرير/محايد)",
 "tone": "وصف موجز للنبرة",
 "gender": "male أو female أو unknown",
 "ageGroup": "child / young / adult / elder",
 "pitch": "low / medium / high",
 "speed": "slow / normal / fast",
 "intensity": 1-10,
 "arabicTranslation": "ترجمة عربية فصيحة طبيعية للدبلجة بنفس الطول الزمني تقريباً",
 "suggestedZeldaVoice": "أحد: link, zelda, ganon, impa, purah, king, sidon, npc_male, npc_female, narrator",
 "dubbingDirection": "تعليمة مخرج موجزة بالعربية للممثل"
}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiResp.ok) {
      const detail = await aiResp.text();
      console.error("AI gateway error", aiResp.status, detail);
      const status = aiResp.status === 429 || aiResp.status === 402 ? aiResp.status : 500;
      return json({ error: `فشل التحليل: ${aiResp.status}`, detail: detail.slice(0, 500) }, status);
    }
    const aiData = await aiResp.json();
    const text: string = aiData?.choices?.[0]?.message?.content || "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return json({ error: "JSON غير صالح من المحلل" }, 500);
      parsed = JSON.parse(m[0]);
    }

    return json({ analysis: parsed });
  } catch (e) {
    console.error("analyze-audio fatal", e);
    return json({ error: e instanceof Error ? e.message : "خطأ غير معروف" }, 500);
  }

  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
