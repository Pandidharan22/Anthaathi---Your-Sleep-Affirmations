import { getDatabase } from '@/lib/db';

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
