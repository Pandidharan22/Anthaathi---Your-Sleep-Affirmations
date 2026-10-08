const mockSynthesizeToFile = jest.fn();
jest.mock('@/modules/anthaathi-tts', () => ({
  __esModule: true,
  default: { synthesizeToFile: (...args: unknown[]) => mockSynthesizeToFile(...args) },
}));

// The natural-voice engine is tested in lib/neuralVoice.test.ts; here only the routing to it.
const mockSynthesizeNeural = jest.fn();
jest.mock('@/lib/neuralVoice', () => ({
  NEURAL_VOICES: [
    { name: 'af_bella', label: 'Bella', speakerId: 2, speed: 0.8 },
    { name: 'af_nicole', label: 'Nicole', speakerId: 6, speed: 1 },
    { name: 'am_echo', label: 'Echo', speakerId: 12, speed: 1 },
    { name: 'am_michael', label: 'Michael', speakerId: 16, speed: 1 },
  ],
  synthesizeNeural: (...args: unknown[]) => mockSynthesizeNeural(...args),
}));

type StatusListener = (status: { isLoaded: boolean; duration: number }) => void;
let statusListener: StatusListener | null = null;
const mockSubscriptionRemove = jest.fn();
const mockPlayerRemove = jest.fn();
const mockCreateAudioPlayer = jest.fn((_uri: string) => ({
  addListener: (_event: string, cb: StatusListener) => {
    statusListener = cb;
    return { remove: mockSubscriptionRemove };
  },
  remove: mockPlayerRemove,
}));
jest.mock('expo-audio', () => ({
  createAudioPlayer: (uri: string) => mockCreateAudioPlayer(uri),
}));

const mockFileDelete = jest.fn();
const mockFileCreate = jest.fn();
const mockFileWrite = jest.fn();
const mockFileBytes = jest.fn();
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((_dir: string, name: string) => ({
    uri: `file:///doc/${name}`,
    delete: () => mockFileDelete(name),
    create: (...args: unknown[]) => mockFileCreate(name, ...args),
    write: (...args: unknown[]) => mockFileWrite(name, ...args),
    bytes: () => mockFileBytes(name),
  })),
  Paths: { document: 'file:///doc' },
}));

const mockJoinWav = jest.fn();
jest.mock('@/lib/wav', () => ({
  joinWavWithSilence: (...args: unknown[]) => mockJoinWav(...args),
}));

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'fixed-uuid') }));

import { DEFAULT_VOICE_STYLE } from '@/lib/voiceStyle';

import {
  getDefaultVoiceId,
  getVoiceStyle,
  NATURAL_VOICE_OPTIONS,
  SYSTEM_VOICE_OPTIONS,
  synthesizeAffirmationAudio,
  VOICE_OPTIONS,
} from './aiVoice';

beforeEach(() => {
  jest.clearAllMocks();
  statusListener = null;
});

describe('synthesizeAffirmationAudio', () => {
  it('synthesizes via the native module, then measures duration from the resulting file', async () => {
    mockSynthesizeToFile.mockResolvedValue('file:///doc/ai-affirmation-fixed-uuid.wav');

    const resultPromise = synthesizeAffirmationAudio('I am calm.', 'voice-1');
    while (!statusListener) {
      await Promise.resolve();
    }
    statusListener({ isLoaded: true, duration: 4.2 });

    await expect(resultPromise).resolves.toEqual({
      localUri: 'file:///doc/ai-affirmation-fixed-uuid.wav',
      durationMs: 4200,
    });
    expect(mockSynthesizeToFile).toHaveBeenCalledWith(
      'I am calm.',
      'file:///doc/ai-affirmation-fixed-uuid.wav',
      'voice-1',
      DEFAULT_VOICE_STYLE.rate,
      DEFAULT_VOICE_STYLE.pitch,
    );
    // One sentence: no pieces to join.
    expect(mockJoinWav).not.toHaveBeenCalled();
    expect(mockSubscriptionRemove).toHaveBeenCalled();
    expect(mockPlayerRemove).toHaveBeenCalled();
  });

  it('ignores status updates that are not loaded yet or report zero duration', async () => {
    mockSynthesizeToFile.mockResolvedValue('file:///doc/ai-affirmation-fixed-uuid.wav');

    const resultPromise = synthesizeAffirmationAudio('I am calm.', 'voice-1');
    while (!statusListener) {
      await Promise.resolve();
    }
    statusListener({ isLoaded: false, duration: 0 });
    statusListener({ isLoaded: true, duration: 0 });
    statusListener({ isLoaded: true, duration: 2.5 });

    await expect(resultPromise).resolves.toEqual({
      localUri: 'file:///doc/ai-affirmation-fixed-uuid.wav',
      durationMs: 2500,
    });
  });

  it('rejects, cleans up the player, and deletes the orphaned file if the player never finishes loading', async () => {
    jest.useFakeTimers();
    mockSynthesizeToFile.mockResolvedValue('file:///doc/ai-affirmation-fixed-uuid.wav');

    const resultPromise = synthesizeAffirmationAudio('I am calm.', 'voice-1');
    const assertion = expect(resultPromise).rejects.toThrow(/timed out/i);
    await jest.runAllTimersAsync();
    await assertion;

    expect(mockSubscriptionRemove).toHaveBeenCalled();
    expect(mockPlayerRemove).toHaveBeenCalled();
    // FR-516: synthesis itself succeeded and wrote a real file -- since duration measurement
    // failed, the caller never gets a usable result, so the orphaned file must not be left behind.
    expect(mockFileDelete).toHaveBeenCalledWith('ai-affirmation-fixed-uuid.wav');
    jest.useRealTimers();
  });

  it("uses the voice's own tuned style by default, not the fallback", async () => {
    const male = SYSTEM_VOICE_OPTIONS.find((v) => v.gender === 'male')!;
    mockSynthesizeToFile.mockResolvedValue('ok');
    const resultPromise = synthesizeAffirmationAudio('I am calm.', male.id);
    while (!statusListener) await Promise.resolve();
    statusListener({ isLoaded: true, duration: 1 });
    await resultPromise;
    expect(mockSynthesizeToFile.mock.calls[0].slice(3)).toEqual([male.style.rate, male.style.pitch]);
    expect(getVoiceStyle(male.id)).toBe(male.style);
    expect(getVoiceStyle('unknown-voice')).toBe(DEFAULT_VOICE_STYLE);
  });

  it('routes a natural voice to the neural engine, never to Android TTS', async () => {
    mockSynthesizeNeural.mockResolvedValue({ localUri: 'file:///n.wav', durationMs: 9000, synthMs: 5 });

    await expect(synthesizeAffirmationAudio('I am calm.', 'kokoro:am_michael')).resolves.toEqual({
      localUri: 'file:///n.wav',
      durationMs: 9000,
    });
    expect(mockSynthesizeNeural).toHaveBeenCalledWith(
      'I am calm.',
      expect.objectContaining({ name: 'am_michael', speakerId: 16 }),
    );
    expect(mockSynthesizeToFile).not.toHaveBeenCalled();
    expect(mockCreateAudioPlayer).not.toHaveBeenCalled(); // duration comes from the engine
  });

  it('passes a natural-voice failure (e.g. model missing) straight to the caller', async () => {
    mockSynthesizeNeural.mockRejectedValue(new Error('not installed'));
    await expect(synthesizeAffirmationAudio('I am calm.', 'kokoro:af_nicole')).rejects.toThrow(
      'not installed',
    );
  });

  it('passes a custom style through to the native module', async () => {
    mockSynthesizeToFile.mockResolvedValue('ok');
    const resultPromise = synthesizeAffirmationAudio('I am calm.', 'voice-1', {
      rate: 0.4,
      pitch: 0.8,
      sentencePauseMs: 1000,
    });
    while (!statusListener) await Promise.resolve();
    statusListener({ isLoaded: true, duration: 1 });
    await resultPromise;
    expect(mockSynthesizeToFile.mock.calls[0].slice(3)).toEqual([0.4, 0.8]);
  });

  describe('multi-sentence scripts', () => {
    const joinedBytes = new Uint8Array([1, 2, 3]);

    beforeEach(() => {
      mockSynthesizeToFile.mockResolvedValue('ok');
      mockFileBytes.mockImplementation(async (name: string) => new Uint8Array([name.length]));
      mockJoinWav.mockReturnValue(joinedBytes);
    });

    it('synthesizes each sentence separately, joins them with the sentence pause, and removes the pieces', async () => {
      const resultPromise = synthesizeAffirmationAudio('I am calm. I am safe.', 'voice-1', {
        rate: 0.5,
        pitch: 0.9,
        sentencePauseMs: 2400,
      });
      while (!statusListener) await Promise.resolve();
      statusListener({ isLoaded: true, duration: 9 });

      await expect(resultPromise).resolves.toEqual({
        localUri: 'file:///doc/ai-affirmation-fixed-uuid.wav',
        durationMs: 9000,
      });

      expect(mockSynthesizeToFile.mock.calls.map((c) => [c[0], c[1]])).toEqual([
        ['I am calm.', 'file:///doc/ai-affirmation-fixed-uuid-0.wav'],
        ['I am safe.', 'file:///doc/ai-affirmation-fixed-uuid-1.wav'],
      ]);
      expect(mockJoinWav).toHaveBeenCalledTimes(1);
      expect(mockJoinWav.mock.calls[0][0]).toHaveLength(2);
      expect(mockJoinWav.mock.calls[0][1]).toBe(2400);
      expect(mockFileWrite).toHaveBeenCalledWith('ai-affirmation-fixed-uuid.wav', joinedBytes);
      expect(mockFileDelete).toHaveBeenCalledWith('ai-affirmation-fixed-uuid-0.wav');
      expect(mockFileDelete).toHaveBeenCalledWith('ai-affirmation-fixed-uuid-1.wav');
      // The final file is kept.
      expect(mockFileDelete).not.toHaveBeenCalledWith('ai-affirmation-fixed-uuid.wav');
    });

    it('cleans up every piece and the output, and rejects, if a later sentence fails', async () => {
      mockSynthesizeToFile.mockResolvedValueOnce('ok').mockRejectedValueOnce(new Error('boom'));

      await expect(synthesizeAffirmationAudio('One. Two. Three.', 'voice-1')).rejects.toThrow('boom');

      expect(mockSynthesizeToFile).toHaveBeenCalledTimes(2); // stops at the failure
      expect(mockJoinWav).not.toHaveBeenCalled();
      for (const name of [
        'ai-affirmation-fixed-uuid-0.wav',
        'ai-affirmation-fixed-uuid-1.wav',
        'ai-affirmation-fixed-uuid-2.wav',
        'ai-affirmation-fixed-uuid.wav',
      ]) {
        expect(mockFileDelete).toHaveBeenCalledWith(name);
      }
    });

    it('rejects an empty script without calling the native module', async () => {
      await expect(synthesizeAffirmationAudio('   ', 'voice-1')).rejects.toThrow(/no text/i);
      expect(mockSynthesizeToFile).not.toHaveBeenCalled();
    });
  });
});

describe('VOICE_OPTIONS', () => {
  it('every basic voice has a sane style (slow enough for sleep, audible pause)', () => {
    for (const voice of SYSTEM_VOICE_OPTIONS) {
      expect(voice.style.rate).toBeGreaterThan(0);
      expect(voice.style.rate).toBeLessThanOrEqual(1);
      expect(voice.style.pitch).toBeGreaterThan(0);
      expect(voice.style.sentencePauseMs).toBeGreaterThanOrEqual(500);
    }
  });

  it('FR-512: each engine offers at least one male and one female voice', () => {
    for (const options of [NATURAL_VOICE_OPTIONS, SYSTEM_VOICE_OPTIONS]) {
      expect(options.some((v) => v.gender === 'male')).toBe(true);
      expect(options.some((v) => v.gender === 'female')).toBe(true);
    }
  });

  it("natural voices are the user's four picks, Nicole first, with stable stored ids", () => {
    expect(NATURAL_VOICE_OPTIONS.map((v) => [v.id, v.label, v.gender])).toEqual([
      ['kokoro:af_nicole', 'Nicole', 'female'],
      ['kokoro:af_bella', 'Bella', 'female'],
      ['kokoro:am_michael', 'Michael', 'male'],
      ['kokoro:am_echo', 'Echo', 'male'],
    ]);
  });

  it('defaults to Nicole when the natural voices are installed, else a basic voice', () => {
    expect(getDefaultVoiceId(true)).toBe('kokoro:af_nicole');
    expect(getDefaultVoiceId(false)).toBe(SYSTEM_VOICE_OPTIONS[0].id);
  });

  it('every option has a non-empty id and label', () => {
    for (const voice of VOICE_OPTIONS) {
      expect(voice.id.trim().length).toBeGreaterThan(0);
      expect(voice.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate ids', () => {
    const ids = VOICE_OPTIONS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
