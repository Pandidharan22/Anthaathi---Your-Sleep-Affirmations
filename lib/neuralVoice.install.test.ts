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

const mockNetFetch = jest.fn();
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: () => mockNetFetch() },
  NetInfoStateType: { none: 'none', wifi: 'wifi', ethernet: 'ethernet', cellular: 'cellular' },
}));

let mockFreeBytes = 5_000_000_000;

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
  return {
    File,
    Directory: MockEntry,
    Paths: {
      document: 'doc',
      get availableDiskSpace() {
        return mockFreeBytes;
      },
    },
  };
});

jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));

import {
  checkInstall,
  deleteModel,
  getNeuralVoiceStatus,
  installModel,
  MODEL_SHA256,
  startInstall,
  subscribeNeuralVoiceStatus,
} from '@/lib/neuralVoice';

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
  mockFreeBytes = 5_000_000_000;
  mockNetFetch.mockResolvedValue({ isConnected: true, type: 'wifi' });
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

    await expect(installModel(() => {})).rejects.toThrow(/damaged or incomplete/);

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

describe('install preconditions', () => {
  it('refuses to start when offline, with a clear message, without downloading', async () => {
    mockNetFetch.mockResolvedValue({ isConnected: false, type: 'none' });
    await expect(installModel(() => {})).rejects.toThrow(/offline/);
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it('refuses to start without ~800 MB free, saying how much is needed and free', async () => {
    mockFreeBytes = 500_000_000;
    await expect(installModel(() => {})).rejects.toThrow(/about 800 MB while installing, and you have 500 MB/);
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it('reports the network kind so the UI can confirm before using mobile data', async () => {
    mockNetFetch.mockResolvedValue({ isConnected: true, type: 'cellular' });
    expect(await checkInstall()).toEqual({ ok: true, network: 'cellular' });
    mockNetFetch.mockResolvedValue({ isConnected: true, type: 'ethernet' });
    expect(await checkInstall()).toEqual({ ok: true, network: 'wifi' });
  });

  it('removes a half-extracted model when extraction fails', async () => {
    mockSha256.mockResolvedValue(MODEL_SHA256);
    mockExtract.mockImplementation(async () => {
      mockExisting.add(MODEL); // partly written before failing
      throw new Error('disk full');
    });

    await expect(installModel(() => {})).rejects.toThrow('disk full');

    expect(mockDeleted).toContain(MODEL);
    expect(mockDeleted).toContain(ARCHIVE);
  });
});

describe('install status store', () => {
  it('moves through installing (with progress) to installed, notifying subscribers', async () => {
    mockSha256.mockResolvedValue(MODEL_SHA256);
    const seen: string[] = [];
    const unsubscribe = subscribeNeuralVoiceStatus(() => {
      const st = getNeuralVoiceStatus();
      seen.push(
        st.state === 'installing' ? `installing:${st.progress?.stage ?? 'start'}` : st.state,
      );
    });

    await startInstall();
    unsubscribe();

    expect(seen).toEqual([
      'installing:start',
      'installing:verifying',
      'installing:extracting',
      'installed',
    ]);
  });

  it('joins an install already in flight instead of starting a second download', async () => {
    mockSha256.mockResolvedValue(MODEL_SHA256);
    const a = startInstall();
    const b = startInstall();
    expect(b).toBe(a);
    await a;
    expect(mockDownload).toHaveBeenCalledTimes(1);
  });

  it('ends in a failed status with our own message for a known failure', async () => {
    mockSha256.mockResolvedValue('0'.repeat(64));
    await startInstall();
    expect(getNeuralVoiceStatus()).toEqual({
      state: 'failed',
      message: 'The download was damaged or incomplete. Please try again.',
    });
  });

  it('shows a friendly generic message instead of a raw technical error', async () => {
    mockDownload.mockRejectedValue(new Error('java.net.SocketTimeoutException: timeout'));
    await startInstall();
    const st = getNeuralVoiceStatus();
    expect(st.state).toBe('failed');
    expect(st.state === 'failed' && st.message).toMatch(/couldn't be installed/);
    expect(st.state === 'failed' && st.message).not.toMatch(/java/);
  });

  it('deleting the model sets the status back to not installed', async () => {
    markExtracted();
    mockExisting.add(ROOT);
    await deleteModel();
    expect(getNeuralVoiceStatus()).toEqual({ state: 'not_installed' });
    expect(mockDeleted).toContain(ROOT);
  });
});
