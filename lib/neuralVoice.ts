import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import { splitIntoPhrases } from '@/lib/voiceStyle';
import { joinWavSegments, parseWav } from '@/lib/wav';
import AnthaathiNeuralTts from '@/modules/anthaathi-neural-tts';

// Execution Plan step 3.13 (spike): Kokoro v1.0 (full precision) via sherpa-onnx. Not wired into
// VOICE_OPTIONS or the real AI Guided flow yet; app/dev-neural-tts.tsx drives it so the voices
// can be judged on a real phone first.

// sherpa-onnx's own release of Kokoro v1.0 (~350 MB). Full precision by the user's choice:
// int8 risks quality loss, and an F16 conversion crashed ONNX Runtime's optimizer (see journal).
export const MODEL_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2';
// Pinned so a changed or corrupted file is rejected before extraction. Matches the digest
// GitHub itself publishes for this release asset.
export const MODEL_SHA256 = 'c5f7e2d2caf082bc1d20fb70334a61d99d20b484500aad32e7cf84c128ea3298';
const ARCHIVE_NAME = 'kokoro-multi-lang-v1_0.tar.bz2';
const MODEL_FOLDER = 'kokoro-multi-lang-v1_0';
const REQUIRED_FILES = ['model.onnx', 'voices.bin', 'tokens.txt', 'lexicon-us-en.txt'];

export type NeuralVoice = {
  name: string;
  label: string;
  speakerId: number;
  /** Kokoro speed (1.0 = model default, lower = slower), tuned by ear per voice. */
  speed: number;
};

// The user's picks from Kokoro v1.0. Speaker ids come from the model's own speaker2id metadata
// (verified on the desktop build of the same sherpa-onnx version). Speeds were picked by ear:
// Bella reads fast, so she is slowed to 0.8; Echo, Nicole and Michael sounded laggy below 1.0,
// so they stay at the model's default pace (the phrase pauses do the calming).
export const NEURAL_VOICES: NeuralVoice[] = [
  { name: 'af_bella', label: 'Bella (female)', speakerId: 2, speed: 0.8 },
  { name: 'af_nicole', label: 'Nicole (female)', speakerId: 6, speed: 1 },
  { name: 'am_echo', label: 'Echo (male)', speakerId: 12, speed: 1 },
  { name: 'am_michael', label: 'Michael (male)', speakerId: 16, speed: 1 },
];

/** Silence after a sentence ending, and after a comma or "/" mark inside a sentence. */
export const NEURAL_SENTENCE_PAUSE_MS = 1800;
export const NEURAL_PHRASE_PAUSE_MS = 500;
const NUM_THREADS = 4;

function modelsRoot(): Directory {
  return new Directory(Paths.document, 'neural-voice');
}

function modelDir(): Directory {
  return new Directory(modelsRoot(), MODEL_FOLDER);
}

export function isModelInstalled(): boolean {
  const dir = modelDir();
  return (
    REQUIRED_FILES.every((name) => new File(dir, name).exists) &&
    new Directory(dir, 'espeak-ng-data').exists
  );
}

export type InstallProgress =
  | { stage: 'downloading'; bytesWritten: number; totalBytes: number }
  | { stage: 'verifying' }
  | { stage: 'extracting' };

/** Downloads (~350 MB) and extracts the model, then deletes the archive. Idempotent. */
export async function installModel(onProgress: (p: InstallProgress) => void): Promise<void> {
  if (isModelInstalled()) return;
  const root = modelsRoot();
  if (!root.exists) root.create({ intermediates: true });
  const archive = new File(root, ARCHIVE_NAME);
  try {
    if (archive.exists) archive.delete(); // a previous attempt may have left a partial file
    const task = File.createDownloadTask(MODEL_URL, archive, {
      onProgress: ({ bytesWritten, totalBytes }) =>
        onProgress({ stage: 'downloading', bytesWritten, totalBytes }),
    });
    const downloaded = await task.downloadAsync();
    if (!downloaded) throw new Error('The model download was cancelled.');
    onProgress({ stage: 'verifying' });
    const actual = await AnthaathiNeuralTts.sha256(archive.uri);
    if (actual !== MODEL_SHA256) {
      throw new Error('The downloaded voice model is damaged or unexpected. Please try again.');
    }
    onProgress({ stage: 'extracting' });
    await AnthaathiNeuralTts.extractTarBz2(archive.uri, root.uri);
    if (!isModelInstalled())
      throw new Error('The model archive did not contain the expected files.');
  } finally {
    if (archive.exists) archive.delete();
  }
}

export function deleteModel(): void {
  const root = modelsRoot();
  if (root.exists) root.delete();
}

export async function loadModel() {
  return AnthaathiNeuralTts.load(modelDir().uri, NUM_THREADS);
}

export type NeuralSynthesis = { localUri: string; durationMs: number; synthMs: number };

/**
 * Synthesizes a script phrase by phrase (splitIntoPhrases) and joins the pieces with exact
 * pauses: each phrase's own edge silence is trimmed so a 0.5 s pause really is 0.5 s. The model
 * must already be loaded (loadModel).
 */
export async function synthesizeNeural(
  scriptText: string,
  voice: NeuralVoice,
  {
    sentencePauseMs = NEURAL_SENTENCE_PAUSE_MS,
    phrasePauseMs = NEURAL_PHRASE_PAUSE_MS,
  }: { sentencePauseMs?: number; phrasePauseMs?: number } = {},
): Promise<NeuralSynthesis> {
  const phrases = splitIntoPhrases(scriptText, { sentencePauseMs, phrasePauseMs });
  if (phrases.length === 0) throw new Error('The script has no text to synthesize.');

  const baseName = `neural-${voice.name}-${Crypto.randomUUID()}`;
  const output = new File(Paths.document, `${baseName}.wav`);
  const pieces = phrases.map((_, i) => new File(Paths.document, `${baseName}-${i}.wav`));
  const deleteQuietly = (f: File) => {
    try {
      if (f.exists) f.delete();
    } catch {
      // Best-effort cleanup.
    }
  };

  try {
    let synthMs = 0;
    for (let i = 0; i < phrases.length; i++) {
      const result = await AnthaathiNeuralTts.synthesizeToFile(
        phrases[i].text,
        pieces[i].uri,
        voice.speakerId,
        voice.speed,
      );
      synthMs += result.synthMs;
    }
    const joined = joinWavSegments(
      await Promise.all(pieces.map((p) => p.bytes())),
      phrases.map((p) => p.pauseAfterMs),
      { trimEdges: true },
    );
    output.create({ overwrite: true });
    output.write(joined);
    pieces.forEach(deleteQuietly);
    const { format, pcm } = parseWav(joined);
    const bytesPerSecond = (format.sampleRate * format.channels * format.bitsPerSample) / 8;
    const durationMs = Math.round((pcm.length / bytesPerSecond) * 1000);
    return { localUri: output.uri, durationMs, synthMs };
  } catch (err) {
    pieces.forEach(deleteQuietly);
    deleteQuietly(output);
    throw err;
  }
}
