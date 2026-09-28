import { NativeModule, requireNativeModule } from 'expo';

declare class AnthaathiTtsModule extends NativeModule<{}> {
  /**
   * Synthesizes `text` with the device's on-device TTS engine and writes it to `outputPath`
   * (an absolute file path the caller controls -- this module has no path policy of its own).
   * Resolves with `outputPath` on success. Only one request may be in flight at a time.
   */
  synthesizeToFile(text: string, outputPath: string): Promise<string>;
}

export default requireNativeModule<AnthaathiTtsModule>('AnthaathiTts');
