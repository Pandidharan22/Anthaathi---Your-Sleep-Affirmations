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

  const folderRows = await database.getAllAsync<{ id: string }>(
    `SELECT id FROM folders WHERE user_id = ?`,
    [userId],
  );
  const affirmationRows = await database.getAllAsync<{ id: string; local_uri: string }>(
    `SELECT id, local_uri FROM affirmations WHERE user_id = ?`,
    [userId],
  );

  for (const affirmation of affirmationRows) {
    try {
      new File(affirmation.local_uri).delete();
    } catch {
      // Best-effort cleanup; a stray file isn't a correctness issue.
    }
  }

  await database.runAsync(`DELETE FROM affirmations WHERE user_id = ?`, [userId]);
  await database.runAsync(`DELETE FROM folders WHERE user_id = ?`, [userId]);

  const orphanedIds = [...folderRows.map((f) => f.id), ...affirmationRows.map((a) => a.id)];
  if (orphanedIds.length > 0) {
    const placeholders = orphanedIds.map(() => '?').join(',');
    await database.runAsync(`DELETE FROM sync_queue WHERE row_id IN (${placeholders})`, orphanedIds);
  }

  await supabase.auth.signOut();
}
