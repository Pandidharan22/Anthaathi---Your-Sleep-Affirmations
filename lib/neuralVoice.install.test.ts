// Install path of lib/neuralVoice.ts: download -> verify SHA-256 -> extract -> clean up.
const mockSha256 = jest.fn();
const mockExtract = jest.fn();
jest.mock('@/modules/anthaathi-neural-tts', () => ({
  __esModule: true,
  default: {
    sha256: (...args: unknown[]) => mockSha256(...args),
    extractTarBz2: (...args: unknown[]) => mockExtract(...args),
  },
}));

// A tiny in-memory filesystem: paths that "exist".
const mockExisting = new Set<string>();
const mockDeleted: string[] = [];
const mockDownload = jest.fn();

function mockPathOf(parts: unknown[]): string {
  return parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
}

jest.mock('expo-file-system', () => {
  class MockEntry {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = mockPathOf(parts);
    }
    get exists() {
      return mockExisting.has(this.uri);
    }
    delete() {
      mockDeleted.push(this.uri);
      mockExisting.delete(this.uri);
    }
    create() {
      mockExisting.add(this.uri);
    }
  }
  class File extends MockEntry {
    static createDownloadTask = (_url: string, dest: MockEntry) => ({
      downloadAsync: async () => {
        await mockDownload();
        mockExisting.add(dest.uri);
        return dest;
      },
    });
  }
  return { File, Directory: MockEntry, Paths: { document: 'doc' } };
});

jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));

import { installModel, MODEL_SHA256 } from '@/lib/neuralVoice';

const ROOT = 'doc/neural-voice';
const ARCHIVE = `${ROOT}/kokoro-multi-lang-v1_0.tar.bz2`;
const MODEL = `${ROOT}/kokoro-multi-lang-v1_0`;

function markExtracted() {
  for (const f of [
    'model.onnx',
    'voices.bin',
    'tokens.txt',
    'lexicon-us-en.txt',
    'espeak-ng-data',
  ]) {
    mockExisting.add(`${MODEL}/${f}`);
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExisting.clear();
  mockDeleted.length = 0;
  mockDownload.mockResolvedValue(undefined);
  mockExtract.mockImplementation(async () => {
    markExtracted();
    return 1;
  });
});

describe('installModel', () => {
  it('verifies the checksum before extracting, then removes the archive', async () => {
    mockSha256.mockResolvedValue(MODEL_SHA256);
    const stages: string[] = [];

    await installModel((p) => stages.push(p.stage));

    expect(mockSha256).toHaveBeenCalledWith(ARCHIVE);
    expect(mockExtract).toHaveBeenCalledWith(ARCHIVE, ROOT);
    expect(stages).toEqual(['verifying', 'extracting']);
    expect(mockDeleted).toContain(ARCHIVE);
  });

  it('rejects a download whose checksum does not match, without extracting it', async () => {
    mockSha256.mockResolvedValue('0'.repeat(64));

    await expect(installModel(() => {})).rejects.toThrow(/damaged or unexpected/);

    expect(mockExtract).not.toHaveBeenCalled();
    expect(mockDeleted).toContain(ARCHIVE);
  });

  it('removes the partial archive when the download itself fails', async () => {
    mockDownload.mockImplementation(async () => {
      mockExisting.add(ARCHIVE); // Android streams into the destination as it goes
      throw new Error('network down');
    });

    await expect(installModel(() => {})).rejects.toThrow('network down');

    expect(mockSha256).not.toHaveBeenCalled();
    expect(mockDeleted).toContain(ARCHIVE);
  });

  it('does nothing when the model is already installed', async () => {
    markExtracted();
    await installModel(() => {});
    expect(mockDownload).not.toHaveBeenCalled();
  });
});
