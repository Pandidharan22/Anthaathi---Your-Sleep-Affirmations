import AsyncStorage from '@react-native-async-storage/async-storage';

import { getBed } from '@/lib/beds';

const STORAGE_KEY = 'anthaathi.bedPrefs';

export type BedPreference = {
  /** `null` means no bed. */
  bedId: string | null;
  /**
   * One slider balancing the voice against the bed, 0..1: 0 is the bed alone, 1 the voice
   * alone, 0.5 both at full level. See mixGains.
   */
  mix: number;
};

/** Voice at full and the bed at 35%: the balance tuned by ear in step 4.2. */
export const DEFAULT_MIX = 0.825;

const DEFAULT_PREFERENCE: BedPreference = { bedId: null, mix: DEFAULT_MIX };

/**
 * Turns the mix slider into the two volumes. From the middle, moving right fades the bed and
 * moving left fades the voice, so neither ever plays louder than its own full level. With no
 * bed the voice always plays at full.
 */
export function mixGains(mix: number, hasBed: boolean): { voice: number; bed: number } {
  const m = Math.min(1, Math.max(0, mix));
  return {
    voice: hasBed ? Math.min(1, 2 * m) : 1,
    bed: Math.min(1, 2 * (1 - m)),
  };
}

const isUnit = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value <= 1;

// Device-local only (no Postgres table): like the daily reminder, this is a per-device
// listening preference, and the beds themselves are bundled with the app.

export async function getBedPreference(): Promise<BedPreference> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCE };
    const parsed = JSON.parse(raw) as { bedId?: unknown; mix?: unknown; balance?: unknown };
    // Step 4.2 stored `balance`, the bed's volume with the voice always at full; the same
    // sound on the new slider is 1 - balance / 2.
    const mix = isUnit(parsed.mix)
      ? parsed.mix
      : isUnit(parsed.balance)
        ? 1 - parsed.balance / 2
        : DEFAULT_MIX;
    // A stored id for a bed that no longer ships falls back to "no bed".
    const bedId = typeof parsed.bedId === 'string' && getBed(parsed.bedId) ? parsed.bedId : null;
    return { bedId, mix };
  } catch {
    return { ...DEFAULT_PREFERENCE };
  }
}

export async function setBedPreference(pref: BedPreference): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
}
