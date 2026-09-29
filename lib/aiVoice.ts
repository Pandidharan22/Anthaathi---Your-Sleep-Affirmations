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
