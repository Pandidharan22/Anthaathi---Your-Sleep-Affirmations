import * as Crypto from 'expo-crypto';

import { getDatabase } from '@/lib/db';
import { enqueue } from '@/lib/syncQueue';

export type LocalFolder = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
};

/** Writes the folder locally (always succeeds offline) and queues the Postgres upsert. */
export async function createLocalFolder(userId: string, name: string): Promise<LocalFolder> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const folder: LocalFolder = {
    id: Crypto.randomUUID(),
    user_id: userId,
    name,
    created_at: now,
    updated_at: now,
    synced_at: null,
  };

  await database.runAsync(
    `INSERT INTO folders (id, user_id, name, created_at, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [folder.id, folder.user_id, folder.name, folder.created_at, folder.updated_at, folder.synced_at],
  );

  await enqueue('folders', 'upsert', folder.id, {
    id: folder.id,
    user_id: folder.user_id,
    name: folder.name,
    created_at: folder.created_at,
  });

  return folder;
}

export async function listLocalFolders(userId: string): Promise<LocalFolder[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalFolder>(
    `SELECT * FROM folders WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
  );
}

export async function getLocalFolder(id: string): Promise<LocalFolder | null> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<LocalFolder>(`SELECT * FROM folders WHERE id = ? LIMIT 1`, [
    id,
  ]);
  return rows[0] ?? null;
}

export async function renameLocalFolder(id: string, name: string): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.runAsync(`UPDATE folders SET name = ?, updated_at = ? WHERE id = ?`, [
    name,
    now,
    id,
  ]);

  await enqueue('folders', 'update', id, { name });
}

/**
 * Deletes the folder and un-files any of its affirmations locally (folder_id -> null),
 * mirroring the remote schema's `ON DELETE SET NULL` FK. Local SQLite has no FK cascade
 * of its own, so this has to be done explicitly; the remote delete's own cascade handles
 * affirmations that hadn't synced their folder assignment yet — sync is strictly FIFO,
 * so this folder's delete is always queued after anything that referenced it.
 */
export async function deleteLocalFolder(id: string): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.runAsync(
    `UPDATE affirmations SET folder_id = NULL, updated_at = ? WHERE folder_id = ?`,
    [now, id],
  );
  await database.runAsync(`DELETE FROM folders WHERE id = ?`, [id]);

  await enqueue('folders', 'delete', id);
}
