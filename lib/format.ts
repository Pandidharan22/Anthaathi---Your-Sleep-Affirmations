import type { LocalAffirmation } from '@/lib/affirmations.local';

/** Formats a millisecond duration as m:ss. Negative input (e.g. clock-skew edge cases) clamps to 0:00. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** The recording's actual playable length — the trimmed span when trimmed, otherwise the full duration. */
export function getEffectiveDurationMs(affirmation: LocalAffirmation): number {
  if (affirmation.trim_start_ms !== null && affirmation.trim_end_ms !== null) {
    return affirmation.trim_end_ms - affirmation.trim_start_ms;
  }
  return affirmation.duration_ms;
}
