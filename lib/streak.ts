/**
 * Streak derivation (FR-601-FR-602). Computed fresh from the playback-session
 * log every time, never stored as a mutable counter — see SYSTEM_DESIGN.md §4
 * for why (avoids double-increment/timezone drift bugs a stored counter invites).
 */

/** Local calendar-day key (not UTC — a "day" here means the user's own day). */
function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Counts consecutive calendar days (local time) with at least one played
 * session, walking backward from today. If today has no session yet but
 * yesterday does, the streak is still "alive" (not reset to 0) — it simply
 * doesn't count today until tonight's session is logged. It only resets once
 * a full calendar day is skipped entirely.
 */
export function computeStreak(playedAtTimestamps: string[], now: Date = new Date()): number {
  const playedDays = new Set(playedAtTimestamps.map((iso) => toLocalDateKey(new Date(iso))));

  let cursor = now;
  if (!playedDays.has(toLocalDateKey(cursor))) {
    cursor = addDays(cursor, -1);
    if (!playedDays.has(toLocalDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (playedDays.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** A simple visual growth metaphor (FR-602) — no streak, a fresh seedling; longer streaks grow further. */
export function getStreakEmoji(streak: number): string {
  if (streak >= 7) return '🌳';
  if (streak >= 3) return '🌿';
  return '🌱';
}
