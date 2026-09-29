const mockSynthesizeToFile = jest.fn();
jest.mock('@/modules/anthaathi-tts', () => ({
  __esModule: true,
  default: { synthesizeToFile: (...args: unknown[]) => mockSynthesizeToFile(...args) },
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

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ uri: 'file:///doc/ai-affirmation-fixed-uuid.wav' })),
  Paths: { document: 'file:///doc' },
}));

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'fixed-uuid') }));

import { synthesizeAffirmationAudio, VOICE_OPTIONS } from './aiVoice';

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
    );
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

  it('rejects and cleans up if the player never finishes loading', async () => {
    jest.useFakeTimers();
    mockSynthesizeToFile.mockResolvedValue('file:///doc/ai-affirmation-fixed-uuid.wav');

    const resultPromise = synthesizeAffirmationAudio('I am calm.', 'voice-1');
    const assertion = expect(resultPromise).rejects.toThrow(/timed out/i);
    await jest.runAllTimersAsync();
    await assertion;

    expect(mockSubscriptionRemove).toHaveBeenCalled();
    expect(mockPlayerRemove).toHaveBeenCalled();
    jest.useRealTimers();
  });
});

describe('VOICE_OPTIONS', () => {
  it('FR-512: offers at least one male and one female voice', () => {
    expect(VOICE_OPTIONS.some((v) => v.gender === 'male')).toBe(true);
    expect(VOICE_OPTIONS.some((v) => v.gender === 'female')).toBe(true);
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
