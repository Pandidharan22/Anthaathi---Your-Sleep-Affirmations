import { registerWebModule, NativeModule } from 'expo';

// No web implementation exists or is planned; fail loudly rather than pretend to work.
class AnthaathiNeuralTtsModule extends NativeModule<{}> {
  extractTarBz2(): Promise<number> {
    throw new Error('AnthaathiNeuralTts is not supported on web.');
  }
  load(): Promise<never> {
    throw new Error('AnthaathiNeuralTts is not supported on web.');
  }
  synthesizeToFile(): Promise<never> {
    throw new Error('AnthaathiNeuralTts is not supported on web.');
  }
  unload(): Promise<void> {
    throw new Error('AnthaathiNeuralTts is not supported on web.');
  }
}

export default registerWebModule(AnthaathiNeuralTtsModule, 'AnthaathiNeuralTtsModule');
