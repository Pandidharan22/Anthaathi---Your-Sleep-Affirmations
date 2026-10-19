import { File } from 'expo-file-system';

import { getDatabase } from '@/lib/db';
import { wavLevels } from '@/lib/wav';
import { METER_INTERVAL_MS } from '@/lib/waveform';

export type Waveform = { intervalMs: number; levels: number[] };

/** Saves (or replaces) a recording's loudness levels. Device-only; never synced. */
export async function saveWaveform(affirmationId: string, waveform: Waveform): Promise<void> {
  const database = await getDatabase();
  // Two decimals is plenty for drawing and silence detection, and keeps the row small.
  const levels = JSON.stringify(waveform.levels.map((l) => Math.round(l * 100) / 100));
  await database.runAsync(
    `INSERT OR REPLACE INTO affirmation_waveforms (affirmation_id, interval_ms, levels) VALUES (?, ?, ?)`,
    [affirmationId, waveform.intervalMs, levels],
  );
}

/** A recording's levels, or null for recordings made before waveforms were captured. */
export async function getWaveform(affirmationId: string): Promise<Waveform | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ interval_ms: number; levels: string }>(
    `SELECT interval_ms, levels FROM affirmation_waveforms WHERE affirmation_id = ?`,
    [affirmationId],
  );
  if (!row) return null;
  try {
    return { intervalMs: row.interval_ms, levels: JSON.parse(row.levels) as number[] };
  } catch {
    return null;
  }
}

/**
 * A recording's levels, building them from the audio file the first time when it's a WAV:
 * AI Guided audio, which has no recorder metering. Older self-recorded m4a files can't be
 * decoded in JS, so they stay null (a flat line). Never throws: a waveform is decoration.
 */
export async function getOrBuildWaveform(affirmation: {
  id: string;
  local_uri: string;
}): Promise<Waveform | null> {
  try {
    const stored = await getWaveform(affirmation.id);
    if (stored || !affirmation.local_uri.toLowerCase().endsWith('.wav')) return stored;
    const bytes = await new File(affirmation.local_uri).bytes();
    const waveform = { intervalMs: METER_INTERVAL_MS, levels: wavLevels(bytes, METER_INTERVAL_MS) };
    if (waveform.levels.length === 0) return null;
    await saveWaveform(affirmation.id, waveform);
    return waveform;
  } catch {
    return null;
  }
}
