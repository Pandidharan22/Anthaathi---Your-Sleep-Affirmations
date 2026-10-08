const mockSynthesizeToFile = jest.fn();
jest.mock('@/modules/anthaathi-neural-tts', () => ({
  __esModule: true,
  default: { synthesizeToFile: (...args: unknown[]) => mockSynthesizeToFile(...args) },
}));

const mockDelete = jest.fn();
const mockWrite = jest.fn();
const mockBytes = jest.fn();
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((_dir: unknown, name: string) => ({
    uri: `file:///doc/${name}`,
    exists: true,
    delete: () => mockDelete(name),
    create: jest.fn(),
    write: (bytes: Uint8Array) => mockWrite(name, bytes),
    bytes: () => mockBytes(name),
  })),
  Directory: jest.fn(),
  Paths: { document: 'file:///doc' },
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));

const mockJoin = jest.fn();
jest.mock('@/lib/wav', () => ({
  joinWavSegments: (...args: unknown[]) => mockJoin(...args),
  // 24 kHz mono 16-bit: 48 000 bytes = 1 s.
  parseWav: () => ({
    format: { sampleRate: 24000, channels: 1, bitsPerSample: 16 },
    pcm: new Uint8Array(48000),
  }),
}));

import { NEURAL_VOICES, synthesizeNeural } from '@/lib/neuralVoice';

const bella = NEURAL_VOICES.find((v) => v.name === 'af_bella')!;
const echo = NEURAL_VOICES.find((v) => v.name === 'am_echo')!;

beforeEach(() => {
  jest.clearAllMocks();
  mockBytes.mockResolvedValue(new Uint8Array([1]));
  mockJoin.mockReturnValue(new Uint8Array([9]));
});

describe('synthesizeNeural', () => {
  it("synthesizes phrase by phrase at the voice's speed, joins with trimmed exact pauses, and cleans up", async () => {
    mockSynthesizeToFile.mockResolvedValue({ outputPath: 'x', durationMs: 1000, synthMs: 700 });

    const result = await synthesizeNeural('My strength / is permanent. I am calm.', bella);

    expect(mockSynthesizeToFile.mock.calls).toEqual([
      ['My strength,', 'file:///doc/neural-af_bella-uuid-0.wav', 2, 0.8],
      ['is permanent.', 'file:///doc/neural-af_bella-uuid-1.wav', 2, 0.8],
      ['I am calm.', 'file:///doc/neural-af_bella-uuid-2.wav', 2, 0.8],
    ]);
    expect(mockJoin.mock.calls[0][1]).toEqual([500, 1800, 0]);
    expect(mockJoin.mock.calls[0][2]).toEqual({ trimEdges: true });
    expect(mockWrite).toHaveBeenCalledWith('neural-af_bella-uuid.wav', new Uint8Array([9]));
    for (const i of [0, 1, 2])
      expect(mockDelete).toHaveBeenCalledWith(`neural-af_bella-uuid-${i}.wav`);
    expect(mockDelete).not.toHaveBeenCalledWith('neural-af_bella-uuid.wav');
    expect(result).toEqual({
      localUri: 'file:///doc/neural-af_bella-uuid.wav',
      durationMs: 1000, // from the joined WAV's own format, not assumed
      synthMs: 2100,
    });
  });

  it("uses each voice's own speed (Echo is at 1.0, unlike Bella)", async () => {
    mockSynthesizeToFile.mockResolvedValue({ outputPath: 'x', durationMs: 1, synthMs: 1 });
    await synthesizeNeural('I am calm.', echo);
    expect(mockSynthesizeToFile.mock.calls[0].slice(2)).toEqual([12, 1]);
  });

  it('removes every piece and the output if a sentence fails', async () => {
    mockSynthesizeToFile
      .mockResolvedValueOnce({ outputPath: 'x', durationMs: 1, synthMs: 1 })
      .mockRejectedValueOnce(new Error('boom'));

    await expect(synthesizeNeural('One. Two.', bella)).rejects.toThrow('boom');

    expect(mockJoin).not.toHaveBeenCalled();
    for (const name of [
      'neural-af_bella-uuid-0.wav',
      'neural-af_bella-uuid-1.wav',
      'neural-af_bella-uuid.wav',
    ]) {
      expect(mockDelete).toHaveBeenCalledWith(name);
    }
  });

  it('rejects an empty script without touching the engine', async () => {
    await expect(synthesizeNeural('   ', bella)).rejects.toThrow(/no text/i);
    expect(mockSynthesizeToFile).not.toHaveBeenCalled();
  });
});

describe('NEURAL_VOICES', () => {
  it("are the user's four picks with the model's speaker ids and tuned speeds", () => {
    expect(NEURAL_VOICES.map((v) => [v.name, v.speakerId, v.speed])).toEqual([
      ['af_bella', 2, 0.8],
      ['af_nicole', 6, 1],
      ['am_echo', 12, 1],
      ['am_michael', 16, 1],
    ]);
  });
});
