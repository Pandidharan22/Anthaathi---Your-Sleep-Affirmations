import { File } from 'expo-file-system';

import { getDatabase } from '@/lib/db';
import { supabase } from '@/lib/supabase';

/**
 * Storage objects don't cascade-delete with the auth.users row the way
 * table rows do, so they're removed explicitly here, before the RPC call —
 * same ordering rationale as the RPC itself: if this fails (offline, error),
 * nothing has been destroyed yet, so the whole deleteAccount call throws
 * without touching the account or local data.
 */
async function deleteGoalImages(userId: string): Promise<void> {
  const { data, error } = await supabase.storage.from('goal-images').list(userId);
  if (error) throw error;
  if (!data || data.length === 0) return;

  const paths = data.map((entry) => `${userId}/${entry.name}`);
  const { error: removeError } = await supabase.storage.from('goal-images').remove(paths);
  if (removeError) throw removeError;
}

/**
 * Deletes the signed-in user's account and all their data (FR-104, NFR-205).
 * Remote work runs first, in an order where each step only proceeds once the
 * previous one has actually succeeded: goal images (no cascade for Storage
 * objects), then the RPC. If either fails (offline, server error), local
 * data is left untouched so nothing is destroyed without the account
 * actually being deleted. `folders`/`affirmations`/`goals`/`playback_sessions`/
 * `journal_entries` cascade-delete remotely via their user_id FK once the
 * auth.users row is gone (see the migrations), so only local cleanup is
 * needed after that: SQLite rows, on-device audio/image files, and any
 * now-orphaned sync_queue entries for this user's rows.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await deleteGoalImages(userId);

  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;

  const database = await getDatabase();

  const [folderRows, affirmationRows, goalRows, playbackSessionRows, journalEntryRows] = await Promise.all([
    database.getAllAsync<{ id: string }>(`SELECT id FROM folders WHERE user_id = ?`, [userId]),
    database.getAllAsync<{ id: string; local_uri: string }>(
      `SELECT id, local_uri FROM affirmations WHERE user_id = ?`,
      [userId],
    ),
    database.getAllAsync<{ id: string; image_local_uri: string | null }>(
      `SELECT id, image_local_uri FROM goals WHERE user_id = ?`,
      [userId],
    ),
    database.getAllAsync<{ id: string }>(`SELECT id FROM playback_sessions WHERE user_id = ?`, [userId]),
    database.getAllAsync<{ id: string }>(`SELECT id FROM journal_entries WHERE user_id = ?`, [userId]),
  ]);

  for (const affirmation of affirmationRows) {
    try {
      new File(affirmation.local_uri).delete();
    } catch {
      // Best-effort cleanup; a stray file isn't a correctness issue.
    }
  }

  for (const goal of goalRows) {
    if (!goal.image_local_uri) continue;
    try {
      new File(goal.image_local_uri).delete();
    } catch {
      // Best-effort cleanup; a stray file isn't a correctness issue.
    }
  }

  await Promise.all([
    database.runAsync(`DELETE FROM affirmations WHERE user_id = ?`, [userId]),
    database.runAsync(`DELETE FROM folders WHERE user_id = ?`, [userId]),
    database.runAsync(`DELETE FROM goals WHERE user_id = ?`, [userId]),
    database.runAsync(`DELETE FROM playback_sessions WHERE user_id = ?`, [userId]),
    database.runAsync(`DELETE FROM journal_entries WHERE user_id = ?`, [userId]),
  ]);

  // Queue entries for rows that still existed locally just now (above).
  const presentIds = [
    ...folderRows.map((f) => f.id),
    ...affirmationRows.map((a) => a.id),
    ...goalRows.map((g) => g.id),
    ...playbackSessionRows.map((p) => p.id),
    ...journalEntryRows.map((j) => j.id),
  ];
  if (presentIds.length > 0) {
    const placeholders = presentIds.map(() => '?').join(',');
    await database.runAsync(`DELETE FROM sync_queue WHERE row_id IN (${placeholders})`, presentIds);
  }

  // Queue entries for rows the user already deleted locally (via
  // deleteLocalFolder/deleteLocalAffirmation) before deleting their account —
  // gone from the tables above, so not caught by presentIds, but their
  // 'delete' payload still carries the user_id that created them.
  const deleteOpRows = await database.getAllAsync<{ queue_id: number; payload: string | null }>(
    `SELECT queue_id, payload FROM sync_queue WHERE operation = 'delete'`,
  );
  const staleIds = deleteOpRows
    .filter((row) => {
      if (!row.payload) return false;
      try {
        return JSON.parse(row.payload).user_id === userId;
      } catch {
        return false;
      }
    })
    .map((row) => row.queue_id);
  if (staleIds.length > 0) {
    const placeholders = staleIds.map(() => '?').join(',');
    await database.runAsync(`DELETE FROM sync_queue WHERE queue_id IN (${placeholders})`, staleIds);
  }

  await supabase.auth.signOut();
}
