// Arabic dubbing TTS via ElevenLabs (multilingual v2)
// Uses ELEVENLABS_API_KEY secret — no client-side key required.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_VOICE = "CwhRBWXzGAHq8TQ4Fs17"; // Roger (narrator fallback)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY غير مهيّأ في الخادم" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const text: string = body?.text;
    const voiceId: string = body?.voiceId || DEFAULT_VOICE;
    const stability: number = typeof body?.stability === "number" ? body.stability : 0.4;
    const similarity: number = typeof body?.similarity === "number" ? body.similarity : 0.85;
    const style: number = typeof body?.style === "number" ? body.style : 0.45;
    const speed: number = typeof body?.speed === "number" ? body.speed : 1.0;

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "النص مطلوب" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > 4000) {
      return new Response(JSON.stringify({ error: "الحد الأقصى 4000 حرف" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability,
          similarity_boost: similarity,
          style,
          use_speaker_boost: true,
          speed,
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("ElevenLabs TTS error", resp.status, errText);
      const status = resp.status === 429 ? 429 : resp.status === 401 ? 401 : 500;
      const msg = resp.status === 429
        ? "تم تجاوز حد الطلبات، أعد المحاولة بعد قليل"
        : resp.status === 401
          ? "مفتاح ElevenLabs غير صالح"
          : `فشل التوليد: ${resp.status}`;
      return new Response(JSON.stringify({ error: msg, detail: errText.slice(0, 500) }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audio = await resp.arrayBuffer();
    return new Response(audio, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
    });
  } catch (e) {
    console.error("tts-dubbing fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير معروف" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
