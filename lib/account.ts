import { File } from 'expo-file-system';

import { getDatabase } from '@/lib/db';
import { supabase } from '@/lib/supabase';

/**
 * Deletes the signed-in user's account and all their data (FR-104, NFR-205).
 * The remote RPC runs first — if it fails (offline, server error), local data
 * is left untouched so nothing is destroyed without the account actually
 * being deleted. `folders`/`affirmations` cascade-delete remotely via their
 * user_id FK once the auth.users row is gone (see the migration), so only
 * local cleanup is needed after that: SQLite rows, on-device audio files,
 * and any now-orphaned sync_queue entries for this user's rows.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;

  const database = await getDatabase();

  const [folderRows, affirmationRows] = await Promise.all([
    database.getAllAsync<{ id: string }>(`SELECT id FROM folders WHERE user_id = ?`, [userId]),
    database.getAllAsync<{ id: string; local_uri: string }>(
      `SELECT id, local_uri FROM affirmations WHERE user_id = ?`,
      [userId],
    ),
  ]);

  for (const affirmation of affirmationRows) {
    try {
      new File(affirmation.local_uri).delete();
    } catch {
      // Best-effort cleanup; a stray file isn't a correctness issue.
    }
  }

  await Promise.all([
    database.runAsync(`DELETE FROM affirmations WHERE user_id = ?`, [userId]),
    database.runAsync(`DELETE FROM folders WHERE user_id = ?`, [userId]),
  ]);

  // Queue entries for rows that still existed locally just now (above).
  const presentIds = [...folderRows.map((f) => f.id), ...affirmationRows.map((a) => a.id)];
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
