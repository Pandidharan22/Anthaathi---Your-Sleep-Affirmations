import { registerWebModule, NativeModule } from 'expo';

// No web implementation exists (or is planned -- ADR-0007) for on-device TTS-to-file
// synthesis. Throwing here, rather than a silent no-op, so an accidental call on web
// fails loudly instead of pretending to succeed.
class AnthaathiTtsModule extends NativeModule<{}> {
  synthesizeToFile(): Promise<string> {
    throw new Error('AnthaathiTts.synthesizeToFile is not supported on web.');
  }
}

export default registerWebModule(AnthaathiTtsModule, 'AnthaathiTtsModule');
