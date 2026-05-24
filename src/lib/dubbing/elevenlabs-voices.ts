// ============================================================
// ElevenLabs Voice Mapping for Zelda Characters
// Uses ElevenLabs `eleven_multilingual_v2` (supports Arabic)
// ============================================================

import { findCharacter } from "./character-catalog";

// Curated ElevenLabs voice IDs (multilingual v2)
export const ELEVEN_VOICES = {
  Roger:   "CwhRBWXzGAHq8TQ4Fs17", // mature male narrator
  Sarah:   "EXAVITQu4vr4xnSDxMaL", // young female warm
  Laura:   "FGY2WhTYpPnrIDTdsKH5", // bright female
  Charlie: "IKne3meq5aSn9XLyUdCD", // young male
  George:  "JBFqnCBsd6RMkjVDRZzb", // mature british male
  Callum:  "N2lVS1w4EtoT3dr4eOWO", // intense male
  Liam:    "TX3LPaxmHKxFdv7VOQHJ", // young heroic male
  Alice:   "Xb7hH8MSUJpSbSDYk0k2", // soft female
  Matilda: "XrExE9yKIg1WjnnlVkGX", // mature female
  Will:    "bIHbv24MWmeRgasZH58o", // smooth male
  Jessica: "cgSgspJ2msm6clMCkdW9", // playful female
  Eric:    "cjVigY5qzO86Huf0OWal", // friendly male
  Chris:   "iP95p4xoKVk53GoZ742B", // casual male
  Brian:   "nPczCjzI2devNBz1zQrb", // deep villain male
  Daniel:  "onwK4e9ZLuTAKqWW03F9", // authoritative elder
  Lily:    "pFZP5JQG7iQjIQuC4Bku", // child / light female
  Bill:    "pqHfZKP75CvOlQylNhV4", // very deep male
} as const;

// Map by Zelda character id (Dubbing.tsx CHARACTERS)
const CHAR_TO_ELEVEN: Record<string, string> = {
  link: ELEVEN_VOICES.Liam,
  zelda: ELEVEN_VOICES.Sarah,
  ganon: ELEVEN_VOICES.Brian,
  rauru: ELEVEN_VOICES.George,
  sonia: ELEVEN_VOICES.Matilda,
  king_dorephan: ELEVEN_VOICES.Bill,
  mineru: ELEVEN_VOICES.Alice,
  deku_tree: ELEVEN_VOICES.Daniel,
  hylia: ELEVEN_VOICES.Lily,
  kohga: ELEVEN_VOICES.Chris,
  phantom_ganon: ELEVEN_VOICES.Bill,
  yiga_soldier: ELEVEN_VOICES.Callum,
  // AudioDub aliases
  impa: ELEVEN_VOICES.Matilda,
  purah: ELEVEN_VOICES.Jessica,
  king: ELEVEN_VOICES.George,
  sidon: ELEVEN_VOICES.Liam,
  npc_male: ELEVEN_VOICES.Chris,
  npc_female: ELEVEN_VOICES.Lily,
  narrator: ELEVEN_VOICES.Roger,
};

/** Resolve a Zelda character id (or AudioDub voice key) to an ElevenLabs voice ID. */
export function resolveElevenVoiceId(charId: string): string {
  if (CHAR_TO_ELEVEN[charId]) return CHAR_TO_ELEVEN[charId];
  const ch = findCharacter(charId);
  if (ch?.gender === "female") return ELEVEN_VOICES.Sarah;
  if (ch?.gender === "male")   return ELEVEN_VOICES.Brian;
  return ELEVEN_VOICES.Roger;
}

/** Map intensity (0–100) to ElevenLabs voice_settings. */
export function intensityToSettings(intensityPct = 70) {
  // higher intensity → lower stability (more expressive)
  const stability = Math.max(0.1, Math.min(0.9, 1 - intensityPct / 130));
  const style = Math.max(0, Math.min(0.9, intensityPct / 130));
  return {
    stability,
    similarity_boost: 0.85,
    style,
    use_speaker_boost: true,
  };
}
