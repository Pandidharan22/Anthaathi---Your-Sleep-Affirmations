import * as Crypto from 'expo-crypto';
import { createAudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

import AnthaathiTts from '@/modules/anthaathi-tts';

export type VoiceGender = 'male' | 'female';

export type VoiceOption = {
  /** Matches an AnthaathiVoice.identifier the native module reports (modules/anthaathi-tts). */
  id: string;
  gender: VoiceGender;
  label: string;
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
  { id: 'en-gb-x-gbd-local', gender: 'male', label: 'Male' },
  { id: 'en-us-x-tpc-local', gender: 'female', label: 'Female' },
];

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

/**
 * Synthesizes `scriptText` with `voiceId` to a new on-device file and measures its duration.
 * Pure synthesis -- doesn't touch the affirmations table; see affirmations.local.ts's
 * createAiGuidedAffirmation/updateAiGuidedAffirmationScript for that (FR-514).
 */
export async function synthesizeAffirmationAudio(
  scriptText: string,
  voiceId: string,
): Promise<{ localUri: string; durationMs: number }> {
  const outputFile = new File(Paths.document, `ai-affirmation-${Crypto.randomUUID()}.wav`);
  const localUri = await AnthaathiTts.synthesizeToFile(scriptText, outputFile.uri, voiceId);
  const durationMs = await measureDurationMs(localUri);
  return { localUri, durationMs };
}
