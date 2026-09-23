import * as Crypto from 'expo-crypto';

import { getDatabase } from '@/lib/db';
import { enqueue } from '@/lib/syncQueue';

export type LocalPlaybackSession = {
  id: string;
  user_id: string;
  played_at: string;
  duration_ms: number;
  synced_at: string | null;
};

/**
 * Logs a completed nightly playback session (FR-601) — always succeeds
 * offline, since this is written the moment a session ends, most likely
 * while the device has no connectivity. `playedAt` should be when the
 * session *started*, not when it ended: a session spanning midnight
 * belongs to the night it started, not the calendar day it happened to
 * finish on.
 */
export async function logLocalPlaybackSession(
  userId: string,
  playedAt: string,
  durationMs: number,
): Promise<LocalPlaybackSession> {
  const database = await getDatabase();
  const session: LocalPlaybackSession = {
    id: Crypto.randomUUID(),
    user_id: userId,
    played_at: playedAt,
    duration_ms: durationMs,
    synced_at: null,
  };

  await database.runAsync(
    `INSERT INTO playback_sessions (id, user_id, played_at, duration_ms, synced_at) VALUES (?, ?, ?, ?, ?)`,
    [session.id, session.user_id, session.played_at, session.duration_ms, session.synced_at],
  );

  await enqueue('playback_sessions', 'upsert', session.id, {
    id: session.id,
    user_id: session.user_id,
    played_at: session.played_at,
    duration_ms: session.duration_ms,
  });

  return session;
}

export async function listLocalPlaybackSessions(userId: string): Promise<LocalPlaybackSession[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalPlaybackSession>(
    `SELECT * FROM playback_sessions WHERE user_id = ? ORDER BY played_at DESC`,
    [userId],
  );
}
