// Arabic dubbing TTS via Lovable AI Gateway (Gemini TTS)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Gemini prebuilt voices suitable for Zelda-style characters
// https://ai.google.dev/gemini-api/docs/speech-generation
const VOICE_MAP: Record<string, string> = {
  link: "Puck",          // young hero, energetic
  zelda: "Kore",         // royal, soft, warm
  ganon: "Charon",       // dark, deep
  impa: "Sulafat",       // wise elder female
  purah: "Leda",         // cheerful scientist
  king: "Orus",          // regal authoritative
  sidon: "Fenrir",       // friendly heroic
  npc_male: "Algenib",   // generic male
  npc_female: "Aoede",   // generic female
  narrator: "Iapetus",   // narrator
};

// Build a 44-byte WAV header for 16-bit PCM mono
function wavHeader(pcmBytes: number, sampleRate = 24000): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcmBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);            // PCM
  view.setUint16(22, 1, true);            // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);            // block align
  view.setUint16(34, 16, true);           // bits per sample
  writeStr(36, "data");
  view.setUint32(40, pcmBytes, true);
  return new Uint8Array(header);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, voice = "link", style = "" } = await req.json();
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

    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const voiceName = VOICE_MAP[voice] ?? "Puck";
    const stylePrefix = style ? `${style}: ` : "";

    // Lovable AI Gateway proxies Gemini's generateContent for TTS models
    const resp = await fetch("https://ai.gateway.lovable.dev/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: stylePrefix + text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("TTS gateway error", resp.status, errText);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز الحد، أعد المحاولة بعد قليل" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "نفذت أرصدة Lovable AI، أضف رصيداً من إعدادات الورشة" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `TTS فشل: ${resp.status}`, detail: errText.slice(0, 500) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const part = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
    const b64 = part?.inlineData?.data;
    if (!b64) {
      console.error("No audio in response", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "لم يُولَّد صوت" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pcm = b64ToBytes(b64);
    const header = wavHeader(pcm.length, 24000);
    const wav = new Uint8Array(header.length + pcm.length);
    wav.set(header, 0);
    wav.set(pcm, header.length);

    return new Response(wav, {
      headers: { ...corsHeaders, "Content-Type": "audio/wav" },
    });
  } catch (e) {
    console.error("dubbing error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير معروف" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
