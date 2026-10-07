// Delivery of AI Guided affirmations. On-device TTS at its defaults reads at conversational
// speed with no pauses, which sits badly under a sleep bed. Values are tuned by ear on a real
// device via app/dev-tts-test.tsx; the per-voice styles live with the voices in aiVoice.ts.

export type VoiceStyle = {
  /** Android TextToSpeech speech rate; 1.0 is the engine default, lower is slower. */
  rate: number;
  /** Android TextToSpeech pitch; 1.0 is the engine default, lower is deeper. */
  pitch: number;
  /** Silence inserted between sentences of one script. */
  sentencePauseMs: number;
};

/** Fallback for a voice id that has no style of its own. */
export const DEFAULT_VOICE_STYLE: VoiceStyle = {
  rate: 0.6,
  pitch: 1,
  sentencePauseMs: 1800,
};

/** Silence between consecutive affirmations (tracks) in the Player, recorded or AI Guided. */
export const AFFIRMATION_GAP_MS = 2500;

/**
 * Splits a script into sentences so each can be synthesized on its own and joined with a
 * pause. Splits on newlines and after . ! ? (keeping the punctuation); drops empty pieces.
 */
export function splitIntoSentences(script: string): string[] {
  return script
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
