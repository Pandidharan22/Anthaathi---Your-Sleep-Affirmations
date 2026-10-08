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
 * Marks a short pause where the script has no punctuation: "My strength / is permanent."
 * The system-voice path reads it as a comma so it is never spoken as "slash".
 */
export const PAUSE_MARK = '/';
const PAUSE_MARK_PATTERN = /\s*\/\s*/g;

function splitSentences(script: string): string[] {
  return script
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Splits a script into sentences so each can be synthesized on its own and joined with a
 * pause. Splits on newlines and after . ! ? (keeping the punctuation); drops empty pieces.
 * Pause marks become commas (the system TTS engine gives those a short pause of its own).
 */
export function splitIntoSentences(script: string): string[] {
  return splitSentences(script)
    .map((s) =>
      s
        .replace(PAUSE_MARK_PATTERN, ', ')
        .replace(/,\s*([.!?])$/, '$1')
        .trim(),
    )
    .filter((s) => s.length > 0);
}

export type Phrase = { text: string; pauseAfterMs: number };

/**
 * Splits a script into phrases for therapeutic pacing: a sentence ending gets
 * `sentencePauseMs`; a comma or pause mark inside a sentence gets `phrasePauseMs`; the last
 * phrase gets none. A phrase cut at a comma or mark is spoken ending in a comma, so the voice
 * carries on ("continuing tone") instead of sounding like the end of a statement — judged
 * better by ear than the bare fragment. A comma with no following space ("1,000") is not a
 * split point.
 */
export function splitIntoPhrases(
  script: string,
  { sentencePauseMs, phrasePauseMs }: { sentencePauseMs: number; phrasePauseMs: number },
): Phrase[] {
  const phrases: Phrase[] = [];
  for (const sentence of splitSentences(script)) {
    // [text, separator, text, separator, ..., text]
    const pieces = sentence.split(/\s*(\/|,(?=\s|$))\s*/);
    const chunks: string[] = [];
    for (let i = 0; i < pieces.length; i += 2) {
      const text = pieces[i].trim();
      if (!text) continue;
      chunks.push(pieces[i + 1] ? `${text},` : text);
    }
    chunks.forEach((text, j) =>
      phrases.push({ text, pauseAfterMs: j < chunks.length - 1 ? phrasePauseMs : sentencePauseMs }),
    );
  }
  if (phrases.length > 0) phrases[phrases.length - 1].pauseAfterMs = 0;
  return phrases;
}
