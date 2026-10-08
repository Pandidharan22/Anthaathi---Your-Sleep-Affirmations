import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import { splitIntoPhrases } from '@/lib/voiceStyle';
import { joinWavSegments, parseWav } from '@/lib/wav';
import AnthaathiNeuralTts, { type NeuralLoadResult } from '@/modules/anthaathi-neural-tts';

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

/**
 * Free space needed to install: the archive (~350 MB) and the extracted model (~370 MB) both
 * exist until the archive is deleted, plus headroom so the phone isn't left completely full.
 */
export const INSTALL_SPACE_BYTES = 800_000_000;

/**
 * How long the model stays in memory after the last generation. Several affirmations made in a
 * row reuse it (a load takes ~2 s); after that the several hundred MB it holds are released.
 */
export const IDLE_UNLOAD_MS = 60_000;

/** The natural voices were asked for but the model isn't installed (deleted, or a new device). */
export class NeuralModelMissingError extends Error {
  constructor() {
    super('The natural voices are not installed. Download them in Settings.');
    this.name = 'NeuralModelMissingError';
  }
}

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

export type InstallCheck =
  // `cellular`: allowed, but the UI should confirm before spending ~350 MB of mobile data.
  | { ok: true; network: 'wifi' | 'cellular' | 'other' }
  | { ok: false; reason: 'offline' }
  | { ok: false; reason: 'insufficient_space'; availableBytes: number; requiredBytes: number };

/** Hard and soft preconditions for installModel, for the UI to check (and explain) first. */
export async function checkInstall(): Promise<InstallCheck> {
  const availableBytes = Paths.availableDiskSpace;
  if (availableBytes < INSTALL_SPACE_BYTES) {
    return {
      ok: false,
      reason: 'insufficient_space',
      availableBytes,
      requiredBytes: INSTALL_SPACE_BYTES,
    };
  }
  const net = await NetInfo.fetch();
  if (net.isConnected === false || net.type === NetInfoStateType.none) {
    return { ok: false, reason: 'offline' };
  }
  const network =
    net.type === NetInfoStateType.wifi || net.type === NetInfoStateType.ethernet
      ? 'wifi'
      : net.type === NetInfoStateType.cellular
        ? 'cellular'
        : 'other';
  return { ok: true, network };
}

function describeBlocker(check: Exclude<InstallCheck, { ok: true }>): string {
  if (check.reason === 'offline') {
    return "You're offline. Connect to the internet to download the natural voices.";
  }
  const mb = (bytes: number) => Math.round(bytes / 1_000_000);
  return `Not enough free space. The natural voices need about ${mb(check.requiredBytes)} MB while installing; ${mb(check.availableBytes)} MB is free.`;
}

export type InstallProgress =
  | { stage: 'downloading'; bytesWritten: number; totalBytes: number }
  | { stage: 'verifying' }
  | { stage: 'extracting' };

/**
 * Downloads (~350 MB), verifies and extracts the model, then deletes the archive. Idempotent.
 * Refuses up front when offline or short of space (checkInstall); whatever fails later, no
 * partial archive or half-extracted model is left behind.
 */
export async function installModel(onProgress: (p: InstallProgress) => void): Promise<void> {
  if (isModelInstalled()) return;
  const check = await checkInstall();
  if (!check.ok) throw new Error(describeBlocker(check));
  const root = modelsRoot();
  if (!root.exists) root.create({ intermediates: true });
  const archive = new File(root, ARCHIVE_NAME);
  let extractionStarted = false;
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
    extractionStarted = true;
    await AnthaathiNeuralTts.extractTarBz2(archive.uri, root.uri);
    if (!isModelInstalled())
      throw new Error('The model archive did not contain the expected files.');
  } catch (err) {
    if (extractionStarted) {
      const partial = modelDir();
      if (partial.exists) partial.delete();
    }
    throw err;
  } finally {
    if (archive.exists) archive.delete();
  }
}

/** Unloads the model from memory, then removes it from disk. */
export async function deleteModel(): Promise<void> {
  await unloadModel();
  const root = modelsRoot();
  if (root.exists) root.delete();
}

// In-memory model lifecycle. `loading` is shared, so concurrent callers trigger one load.
let loading: Promise<NeuralLoadResult> | null = null;
let activeUses = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function clearIdleTimer() {
  if (idleTimer !== null) clearTimeout(idleTimer);
  idleTimer = null;
}

/** Loads the model if it isn't already (resolves with the load's timing/info). */
export function loadModel(): Promise<NeuralLoadResult> {
  if (!isModelInstalled()) return Promise.reject(new NeuralModelMissingError());
  if (!loading) {
    loading = AnthaathiNeuralTts.load(modelDir().uri, NUM_THREADS).catch((err) => {
      loading = null; // let the next attempt retry instead of caching the failure
      throw err;
    });
  }
  return loading;
}

export async function unloadModel(): Promise<void> {
  clearIdleTimer();
  if (!loading) return;
  loading = null;
  await AnthaathiNeuralTts.unload();
}

/** Runs `fn` with the model loaded; unloads it after IDLE_UNLOAD_MS with no further use. */
async function withModel<T>(fn: () => Promise<T>): Promise<T> {
  clearIdleTimer();
  activeUses++;
  try {
    await loadModel();
    return await fn();
  } finally {
    activeUses--;
    if (activeUses === 0) {
      idleTimer = setTimeout(() => {
        idleTimer = null;
        void unloadModel();
      }, IDLE_UNLOAD_MS);
    }
  }
}

export type NeuralSynthesis = { localUri: string; durationMs: number; synthMs: number };

/**
 * Synthesizes a script phrase by phrase (splitIntoPhrases) and joins the pieces with exact
 * pauses: each phrase's own edge silence is trimmed so a 0.5 s pause really is 0.5 s. Loads the
 * model on demand; rejects with NeuralModelMissingError if it isn't installed.
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

  return withModel(async () => {
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
  });
}
