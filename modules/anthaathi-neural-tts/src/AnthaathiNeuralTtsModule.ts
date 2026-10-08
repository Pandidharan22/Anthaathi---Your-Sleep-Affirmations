import { NativeModule, requireNativeModule } from 'expo';

export type NeuralLoadResult = { loadMs: number; sampleRate: number; numSpeakers: number };
export type NeuralSynthesisResult = { outputPath: string; durationMs: number; synthMs: number };

declare class AnthaathiNeuralTtsModule extends NativeModule<{}> {
  /** Extracts a .tar.bz2 into `destDir`; resolves with the number of files written. */
  extractTarBz2(archivePath: string, destDir: string): Promise<number>;
  /** Loads the Kokoro model from an extracted model directory (replacing any loaded model). */
  load(modelDir: string, numThreads: number): Promise<NeuralLoadResult>;
  /** Synthesizes `text` with Kokoro speaker `speakerId` to a WAV file at `outputPath`. */
  synthesizeToFile(
    text: string,
    outputPath: string,
    speakerId: number,
    speed: number,
  ): Promise<NeuralSynthesisResult>;
  /** Frees the native model (several hundred MB of RAM). */
  unload(): Promise<void>;
}

export default requireNativeModule<AnthaathiNeuralTtsModule>('AnthaathiNeuralTts');
