import { NativeModule, requireNativeModule } from 'expo';

import type { AnthaathiVoice } from './AnthaathiTts.types';

declare class AnthaathiTtsModule extends NativeModule<{}> {
  /** Lists the voices the device's on-device TTS engine currently reports. */
  listVoices(): Promise<AnthaathiVoice[]>;

  /**
   * Synthesizes `text` with `voiceId` (an `identifier` from `listVoices()`) and writes it to
   * `outputPath` (an absolute file path the caller controls -- this module has no path policy
   * of its own). Resolves with `outputPath` on success. Only one request may be in flight at a
   * time; rejects if `voiceId` doesn't match any voice `listVoices()` currently reports.
   * `rate` and `pitch` are Android's TextToSpeech values (1.0 = engine default; lower = slower /
   * deeper).
   */
  synthesizeToFile(
    text: string,
    outputPath: string,
    voiceId: string,
    rate: number,
    pitch: number,
  ): Promise<string>;
}

export default requireNativeModule<AnthaathiTtsModule>('AnthaathiTts');
