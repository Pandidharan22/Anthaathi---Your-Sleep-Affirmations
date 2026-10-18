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

/**
 * Quiet is judged against each recording's own levels, not a fixed loudness: a room's
 * background hum can sit well above -42 dBFS, which made a fixed threshold read the
 * whole take as speech (found on the user's phone). The threshold sits 30% of the way
 * from the recording's quiet level (10th percentile) to its voice level (90th), and
 * never below this floor.
 */
const SILENCE_FLOOR = 0.15;
const THRESHOLD_FRACTION = 0.3;
/** Less contrast than this between quiet and voice: no clear silence to find. */
const MIN_CONTRAST = 0.12;
/** Room kept around the speech, so a cut never clips a soft first or last syllable. */
const SILENCE_PAD_MS = 300;
/** Below this, there's nothing worth trimming. */
const MIN_TRIM_MS = 300;

export type SilenceTrim = { startMs: number; endMs: number };

function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

/**
 * Where the speech starts and ends in a recording, for "Trim silence": the first and
 * last levels above the recording's quiet threshold, padded by SILENCE_PAD_MS. Levels
 * are spread evenly over `durationMs` (the file's real length). Returns null when
 * there's no waveform, no clear quiet, or less than MIN_TRIM_MS of quiet to remove.
 */
export function findSilenceTrim(levels: number[], durationMs: number): SilenceTrim | null {
  if (levels.length === 0 || durationMs <= 0) return null;
  const sorted = [...levels].sort((a, b) => a - b);
  const quiet = percentile(sorted, 0.1);
  const voice = percentile(sorted, 0.9);
  if (voice - quiet < MIN_CONTRAST) return null;
  const threshold = Math.max(SILENCE_FLOOR, quiet + THRESHOLD_FRACTION * (voice - quiet));

  const first = levels.findIndex((level) => level > threshold);
  if (first === -1) return null;
  let last = levels.length - 1;
  while (levels[last] <= threshold) last--;

  const msPerLevel = durationMs / levels.length;
  const startMs = Math.max(0, Math.round(first * msPerLevel - SILENCE_PAD_MS));
  const endMs = Math.min(durationMs, Math.round((last + 1) * msPerLevel + SILENCE_PAD_MS));
  if (startMs + (durationMs - endMs) < MIN_TRIM_MS) return null;
  return { startMs, endMs };
}
