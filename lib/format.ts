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

/**
 * Formats an ISO timestamp as a short local date, e.g. "Sep 23, 2026".
 * Locale is pinned to 'en-US' rather than left to the device default — the
 * device's own locale still governs Intl formatting elsewhere in the OS, but
 * pinning here keeps this specific format (and its test) deterministic
 * rather than silently varying by device (e.g. "23 Sept 2026" elsewhere).
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * A spoken-style length for summaries, e.g. "32s" or "6m 24s" (the Library mockup's
 * folder cards). Whole seconds; under a minute drops the minutes.
 */
export function formatLength(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

/**
 * How long ago something was recorded, in the app's bedtime voice: "Today",
 * "Last night", "3 nights ago", "Last week", "2 weeks ago", then the date. Counts local
 * calendar days, so a recording from 11 pm yesterday is "Last night" at 1 am.
 */
export function formatNightsAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Last night';
  if (days < 7) return `${days} nights ago`;
  if (days < 14) return 'Last week';
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return formatDate(iso);
}
