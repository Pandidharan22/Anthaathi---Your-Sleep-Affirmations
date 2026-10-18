/**
 * Waveforms from real loudness (step R.5). While recording, the recorder's metering
 * (peak dBFS since the last poll) is sampled every METER_INTERVAL_MS and turned into a
 * 0–1 level; screens draw bars from those levels and "Trim silence" reads them.
 */

/** How often loudness is sampled while recording. */
export const METER_INTERVAL_MS = 100;

/** Anything this quiet or quieter draws as silence. Speech peaks sit around -25…-5 dBFS. */
const FLOOR_DB = -50;

/** A metering reading (dBFS, ≤ 0; Android reports -160 for silence) as a 0–1 level. */
export function levelFromDb(db: number | undefined): number {
  if (db === undefined || !Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB));
}

/**
 * Down-samples levels to `bars` values (the loudest in each slice), for drawing. Fewer
 * levels than bars are spread out rather than padded, so short clips still fill the
 * width. Returns [] when there's nothing to draw.
 */
export function bucketLevels(levels: number[], bars: number): number[] {
  if (levels.length === 0 || bars <= 0) return [];
  return Array.from({ length: bars }, (_, i) => {
    const start = Math.floor((i * levels.length) / bars);
    const end = Math.max(start + 1, Math.floor(((i + 1) * levels.length) / bars));
    let peak = 0;
    for (let j = start; j < end && j < levels.length; j++) peak = Math.max(peak, levels[j]);
    return peak;
  });
}
