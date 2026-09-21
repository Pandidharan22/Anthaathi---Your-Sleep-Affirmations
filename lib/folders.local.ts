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
