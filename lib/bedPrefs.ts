import AsyncStorage from '@react-native-async-storage/async-storage';

import { getBed } from '@/lib/beds';

const STORAGE_KEY = 'anthaathi.bedPrefs';

export type BedPreference = {
  /** `null` means no bed. */
  bedId: string | null;
  /** Bed volume relative to the affirmation (which always plays at full volume), 0..1. */
  balance: number;
};

export const DEFAULT_BED_BALANCE = 0.35;

const DEFAULT_PREFERENCE: BedPreference = { bedId: null, balance: DEFAULT_BED_BALANCE };

// Device-local only (no Postgres table): like the daily reminder, this is a per-device
// listening preference, and the beds themselves are bundled with the app.

export async function getBedPreference(): Promise<BedPreference> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCE };
    const parsed = JSON.parse(raw) as Partial<BedPreference>;
    const balance =
      typeof parsed.balance === 'number' && parsed.balance >= 0 && parsed.balance <= 1
        ? parsed.balance
        : DEFAULT_BED_BALANCE;
    // A stored id for a bed that no longer ships falls back to "no bed".
    const bedId = typeof parsed.bedId === 'string' && getBed(parsed.bedId) ? parsed.bedId : null;
    return { bedId, balance };
  } catch {
    return { ...DEFAULT_PREFERENCE };
  }
}

export async function setBedPreference(pref: BedPreference): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
}
