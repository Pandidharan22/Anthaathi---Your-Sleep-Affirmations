const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => mockStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockStorage.set(key, value);
    },
  },
}));

jest.mock('@/lib/beds', () => ({
  getBed: (id: string | null) => (id === 'rain' ? { id: 'rain' } : null),
}));

import { DEFAULT_MIX, getBedPreference, mixGains, setBedPreference } from '@/lib/bedPrefs';

const KEY = 'anthaathi.bedPrefs';

beforeEach(() => mockStorage.clear());

describe('mixGains', () => {
  it('plays both at full in the middle, the bed alone at 0 and the voice alone at 1', () => {
    expect(mixGains(0.5, true)).toEqual({ voice: 1, bed: 1 });
    expect(mixGains(0, true)).toEqual({ voice: 0, bed: 1 });
    expect(mixGains(1, true)).toEqual({ voice: 1, bed: 0 });
  });

  it('fades only the other track on each side of the middle', () => {
    expect(mixGains(0.75, true)).toEqual({ voice: 1, bed: 0.5 });
    expect(mixGains(0.25, true)).toEqual({ voice: 0.5, bed: 1 });
  });

  it('keeps the voice at full when there is no bed', () => {
    expect(mixGains(0, false).voice).toBe(1);
  });

  it('defaults to voice at full and the bed at 35%', () => {
    const gains = mixGains(DEFAULT_MIX, true);
    expect(gains.voice).toBe(1);
    expect(gains.bed).toBeCloseTo(0.35);
  });

  it('clamps out-of-range input', () => {
    expect(mixGains(-1, true)).toEqual({ voice: 0, bed: 1 });
    expect(mixGains(2, true)).toEqual({ voice: 1, bed: 0 });
  });
});

describe('getBedPreference', () => {
  it('defaults to no bed and the default mix', async () => {
    expect(await getBedPreference()).toEqual({ bedId: null, mix: DEFAULT_MIX });
  });

  it('round-trips a saved preference', async () => {
    await setBedPreference({ bedId: 'rain', mix: 0.3 });
    expect(await getBedPreference()).toEqual({ bedId: 'rain', mix: 0.3 });
  });

  it("converts step 4.2's saved balance to the same sound on the new slider", async () => {
    mockStorage.set(KEY, JSON.stringify({ bedId: 'rain', balance: 0.6 }));
    const pref = await getBedPreference();
    expect(pref.mix).toBeCloseTo(0.7);
    expect(mixGains(pref.mix, true)).toEqual({ voice: 1, bed: expect.closeTo(0.6) });
  });

  it('falls back for a removed bed, an invalid mix, or unreadable data', async () => {
    mockStorage.set(KEY, JSON.stringify({ bedId: 'gone', mix: 7 }));
    expect(await getBedPreference()).toEqual({ bedId: null, mix: DEFAULT_MIX });
    mockStorage.set(KEY, '{not json');
    expect(await getBedPreference()).toEqual({ bedId: null, mix: DEFAULT_MIX });
  });
});
