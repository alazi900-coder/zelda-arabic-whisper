// Analyze an audio clip with Gemini multimodal:
// returns transcript + emotion/tone analysis + Arabic translation + suggested Zelda voice.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { audioBase64, mimeType, apiKey } = await req.json();
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return new Response(JSON.stringify({ error: "audioBase64 مطلوب" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!apiKey || typeof apiKey !== "string") {
      return new Response(JSON.stringify({ error: "مفتاح Gemini API مطلوب" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mt = mimeType || "audio/wav";
    const prompt = `أنت محلل صوتي خبير. حلّل المقطع الصوتي وأخرج JSON فقط بالحقول التالية:
{
 "transcript": "النص المنطوق بلغته الأصلية حرفياً",
 "sourceLanguage": "اسم اللغة بالعربية (مثل: إنجليزية، يابانية، فرنسية...)",
 "emotion": "العاطفة الأساسية (غاضب/حزين/خائف/هامس/بطولي/مرح/جاد/رثاء/شرير/محايد)",
 "tone": "وصف موجز للنبرة (مثل: نبرة آمرة عالية، همس متوتر، صراخ معركة...)",
 "gender": "male أو female أو unknown",
 "ageGroup": "child / young / adult / elder",
 "pitch": "low / medium / high",
 "speed": "slow / normal / fast",
 "intensity": 1-10,
 "arabicTranslation": "ترجمة عربية فصيحة مناسبة للدبلجة بنفس الطول الزمني تقريباً، تحافظ على العاطفة والنبرة",
 "suggestedZeldaVoice": "أحد: link, zelda, ganon, impa, purah, king, sidon, npc_male, npc_female, narrator",
 "dubbingDirection": "تعليمة عربية موجزة للممثل (مثل: «بصوت غاضب يصرخ بحدّة»)"
}
أعد JSON خام فقط دون أي شرح أو markdown.`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mt, data: audioBase64 } },
          ],
        }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("analyze-audio gateway error", resp.status, errText);
      const status = resp.status === 429 || resp.status === 402 ? resp.status : 500;
      const msg = resp.status === 429
        ? "تم تجاوز الحد، أعد المحاولة بعد قليل"
        : resp.status === 402
          ? "نفذت أرصدة المفتاح"
          : `فشل التحليل: ${resp.status}`;
      return new Response(JSON.stringify({ error: msg, detail: errText.slice(0, 500) }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = data?.candidates?.[0]?.content?.parts?.find((p: any) => typeof p?.text === "string")?.text;
    if (!text) {
      return new Response(JSON.stringify({ error: "لم يُرجع المحلل أي نص" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // try to extract JSON block
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("استجابة JSON غير صالحة");
      parsed = JSON.parse(m[0]);
    }

    return new Response(JSON.stringify({ analysis: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-audio error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير معروف" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
