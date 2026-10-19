import { splitIntoSentences, splitSentences } from '@/lib/voiceStyle';

/** The Script step's limit (the mockup's "108 / 300"): affirmations are a few short lines. */
export const SCRIPT_MAX_LENGTH = 300;

/** A calm reading pace, about 130 words a minute, close to how the voices are tuned. */
const MS_PER_WORD = 450;
/** The pauses the voices add (lib/voiceStyle.ts): after a sentence, and at a "/" mark. */
const SENTENCE_PAUSE_MS = 1800;
const MARK_PAUSE_MS = 500;
const TITLE_MAX_LENGTH = 40;

export function countSentences(script: string): number {
  return splitIntoSentences(script).length;
}

/** Roughly how long the script takes to read aloud, for "reads in ~14s". */
export function estimateReadMs(script: string): number {
  const sentences = countSentences(script);
  if (sentences === 0) return 0;
  const words = script
    .replace(/\//g, ' ')
    .split(/\s+/)
    .filter((w) => /\w/.test(w)).length;
  const marks = (script.match(/\//g) ?? []).length;
  return words * MS_PER_WORD + (sentences - 1) * SENTENCE_PAUSE_MS + marks * MARK_PAUSE_MS;
}

/** The first sentence as written, for voice previews ("" when there's nothing to read). */
export function firstSentence(script: string): string {
  return splitSentences(script)[0] ?? '';
}

/**
 * A title for a new AI Guided affirmation, from its first sentence: pause marks and the
 * closing punctuation removed, cut at a word near 40 characters. It can be renamed on the
 * recording's screen.
 */
export function titleFromScript(script: string): string {
  const sentence = firstSentence(script)
    .replace(/\s*\/\s*/g, ' ')
    .replace(/[.!?…]+$/, '')
    .trim();
  if (sentence.length <= TITLE_MAX_LENGTH) return sentence;
  const cut = sentence.slice(0, TITLE_MAX_LENGTH + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut.slice(0, TITLE_MAX_LENGTH)).replace(/[,;:]$/, '')}…`;
}

/**
 * Roughly how long generating takes, for the Generating step's "about 4 seconds". Natural
 * voices load the model (about 2 s) and synthesize at about 0.55x real time on the user's
 * phone (step 3.13a); the built-in voices are quicker. Only an estimate: phones differ.
 */
export function estimateGenerationMs(script: string, engine: 'natural' | 'system'): number {
  const readMs = estimateReadMs(script);
  return engine === 'natural' ? 2000 + 0.6 * readMs : 1000 + 0.35 * readMs;
}
