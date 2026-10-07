import * as Crypto from 'expo-crypto';
import { createAudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

import { DEFAULT_VOICE_STYLE, splitIntoSentences, type VoiceStyle } from '@/lib/voiceStyle';
import { joinWavWithSilence } from '@/lib/wav';
import AnthaathiTts from '@/modules/anthaathi-tts';

export type VoiceGender = 'male' | 'female';

export type VoiceOption = {
  /** Matches an AnthaathiVoice.identifier the native module reports (modules/anthaathi-tts). */
  id: string;
  gender: VoiceGender;
  label: string;
  /** Pace/pitch/pause tuned by ear for this voice (they differ: the male voice reads faster). */
  style: VoiceStyle;
};

// FR-512: at least one male and one female voice for AI Guided sessions. Android's Voice API
// has no gender field (see modules/anthaathi-tts/src/AnthaathiTts.types.ts) -- there's no way
// to derive this programmatically, so these were picked by ear on a real device out of ~470
// installed voices (most other languages), narrowed to 8 promising English ones, then to these
// two. Both are offline-only (isNetworkConnectionRequired: false on the test device), matching
// ADR-0007's fully-offline design goal -- a `-network` pick would have quietly required
// connectivity for a feature explicitly meant to work without it.
//
// These identifiers were confirmed present on one real device; a different device/Android
// version/TTS engine isn't guaranteed to have them installed. Step 3.11 (FR-516) is where a
// missing/failed voice gets handled gracefully -- not this step's scope.
export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'en-gb-x-gbd-local',
    gender: 'male',
    label: 'Male',
    style: { rate: 0.8, pitch: 1, sentencePauseMs: 1800 },
  },
  {
    id: 'en-us-x-tpc-local',
    gender: 'female',
    label: 'Female',
    style: { rate: 0.6, pitch: 1, sentencePauseMs: 1800 },
  },
];

export function getVoiceStyle(voiceId: string): VoiceStyle {
  return VOICE_OPTIONS.find((v) => v.id === voiceId)?.style ?? DEFAULT_VOICE_STYLE;
}

const MEASURE_DURATION_TIMEOUT_MS = 10000;

/**
 * The native module reports success/failure of synthesis but not the resulting file's
 * duration (Android's TextToSpeech API doesn't expose that) -- so this loads the freshly
 * written file just far enough to read `duration` off it, then releases the player. Rejects
 * if the file doesn't finish loading within the timeout, rather than hanging forever.
 */
function measureDurationMs(uri: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const player = createAudioPlayer(uri);
    const timeoutId = setTimeout(() => {
      subscription.remove();
      player.remove();
      reject(new Error(`Timed out determining the duration of the synthesized audio at ${uri}`));
    }, MEASURE_DURATION_TIMEOUT_MS);

    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.isLoaded || status.duration <= 0) return;
      clearTimeout(timeoutId);
      subscription.remove();
      const durationMs = Math.round(status.duration * 1000);
      player.remove();
      resolve(durationMs);
    });
  });
}

function deleteQuietly(file: File) {
  try {
    file.delete();
  } catch {
    // Best-effort cleanup; a stray file isn't a correctness issue on its own.
  }
}

/**
 * Synthesizes `scriptText` with `voiceId` to a new on-device file and measures its duration.
 * Each sentence is synthesized on its own (the engine can't pause between sentences) and the
 * pieces are joined with `style.sentencePauseMs` of silence, so a multi-sentence script is
 * paced like separate affirmations instead of one run-on take. Pure synthesis -- doesn't touch
 * the affirmations table; see affirmations.local.ts's createAiGuidedAffirmation/
 * updateAiGuidedAffirmationScript for that (FR-514).
 */
export async function synthesizeAffirmationAudio(
  scriptText: string,
  voiceId: string,
  style: VoiceStyle = getVoiceStyle(voiceId),
): Promise<{ localUri: string; durationMs: number }> {
  const sentences = splitIntoSentences(scriptText);
  if (sentences.length === 0) throw new Error('The script has no text to synthesize.');

  const baseName = `ai-affirmation-${Crypto.randomUUID()}`;
  const outputFile = new File(Paths.document, `${baseName}.wav`);
  const pieceFiles = sentences.map((_, i) => new File(Paths.document, `${baseName}-${i}.wav`));
  // The native module handles one request at a time, so pieces are synthesized in order.
  const cleanupPieces = () => pieceFiles.forEach(deleteQuietly);

  try {
    if (sentences.length === 1) {
      await AnthaathiTts.synthesizeToFile(
        sentences[0],
        outputFile.uri,
        voiceId,
        style.rate,
        style.pitch,
      );
    } else {
      for (let i = 0; i < sentences.length; i++) {
        await AnthaathiTts.synthesizeToFile(
          sentences[i],
          pieceFiles[i].uri,
          voiceId,
          style.rate,
          style.pitch,
        );
      }
      const joined = joinWavWithSilence(
        await Promise.all(pieceFiles.map((f) => f.bytes())),
        style.sentencePauseMs,
      );
      outputFile.create({ overwrite: true });
      outputFile.write(joined);
    }
    cleanupPieces();
    const durationMs = await measureDurationMs(outputFile.uri);
    return { localUri: outputFile.uri, durationMs };
  } catch (err) {
    // Whatever stage failed, the caller gets no usable result -- don't leave orphaned pieces
    // or a half-built/unmeasured file behind for FR-514's caching logic (or account deletion)
    // to have to reason about later.
    cleanupPieces();
    deleteQuietly(outputFile);
    throw err;
  }
}
