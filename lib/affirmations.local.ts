import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

import { getDatabase } from '@/lib/db';
import { enqueue } from '@/lib/syncQueue';

export type AffirmationSource = 'recorded' | 'ai_generated';

export type LocalAffirmation = {
  id: string;
  user_id: string;
  folder_id: string | null;
  title: string;
  local_uri: string;
  storage_path: string | null;
  duration_ms: number;
  source: AffirmationSource;
  voice_id: string | null;
  script_text: string | null;
  trim_start_ms: number | null;
  trim_end_ms: number | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
};

export type CreateLocalAffirmationInput = {
  userId: string;
  title: string;
  localUri: string;
  durationMs: number;
  source: AffirmationSource;
  folderId?: string | null;
  voiceId?: string | null;
  scriptText?: string | null;
  trimStartMs?: number | null;
  trimEndMs?: number | null;
};

/** Writes the affirmation locally (always succeeds offline) and queues the Postgres upsert. */
export async function createLocalAffirmation(
  input: CreateLocalAffirmationInput,
): Promise<LocalAffirmation> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const affirmation: LocalAffirmation = {
    id: Crypto.randomUUID(),
    user_id: input.userId,
    folder_id: input.folderId ?? null,
    title: input.title,
    local_uri: input.localUri,
    storage_path: null,
    duration_ms: input.durationMs,
    source: input.source,
    voice_id: input.voiceId ?? null,
    script_text: input.scriptText ?? null,
    trim_start_ms: input.trimStartMs ?? null,
    trim_end_ms: input.trimEndMs ?? null,
    created_at: now,
    updated_at: now,
    synced_at: null,
  };

  await database.runAsync(
    `INSERT INTO affirmations (
      id, user_id, folder_id, title, local_uri, storage_path, duration_ms,
      source, voice_id, script_text, trim_start_ms, trim_end_ms, created_at, updated_at, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      affirmation.id,
      affirmation.user_id,
      affirmation.folder_id,
      affirmation.title,
      affirmation.local_uri,
      affirmation.storage_path,
      affirmation.duration_ms,
      affirmation.source,
      affirmation.voice_id,
      affirmation.script_text,
      affirmation.trim_start_ms,
      affirmation.trim_end_ms,
      affirmation.created_at,
      affirmation.updated_at,
      affirmation.synced_at,
    ],
  );

  await enqueue('affirmations', 'upsert', affirmation.id, {
    id: affirmation.id,
    user_id: affirmation.user_id,
    folder_id: affirmation.folder_id,
    title: affirmation.title,
    local_uri: affirmation.local_uri,
    storage_path: affirmation.storage_path,
    duration_ms: affirmation.duration_ms,
    source: affirmation.source,
    voice_id: affirmation.voice_id,
    script_text: affirmation.script_text,
    trim_start_ms: affirmation.trim_start_ms,
    trim_end_ms: affirmation.trim_end_ms,
    created_at: affirmation.created_at,
  });

  return affirmation;
}

export async function listLocalAffirmations(userId: string): Promise<LocalAffirmation[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalAffirmation>(
    `SELECT * FROM affirmations WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
  );
}

export async function getLocalAffirmation(id: string): Promise<LocalAffirmation | null> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<LocalAffirmation>(
    `SELECT * FROM affirmations WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Updates an affirmation's trim points (non-destructive — the audio file is untouched,
 * playback just starts/stops at these offsets) and queues a partial Postgres update
 * (not upsert — see syncQueue.ts on why a partial payload needs a real UPDATE).
 * Safe even if the row hasn't synced yet: the sync queue is strictly FIFO, so this
 * update always processes after the row's own create.
 */
export async function updateLocalAffirmationTrim(
  id: string,
  trimStartMs: number,
  trimEndMs: number,
): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.runAsync(
    `UPDATE affirmations SET trim_start_ms = ?, trim_end_ms = ?, updated_at = ? WHERE id = ?`,
    [trimStartMs, trimEndMs, now, id],
  );

  await enqueue('affirmations', 'update', id, {
    trim_start_ms: trimStartMs,
    trim_end_ms: trimEndMs,
  });
}

/** Reassigns an affirmation to a different folder, or un-files it (folderId: null). */
export async function updateLocalAffirmationFolder(
  id: string,
  folderId: string | null,
): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.runAsync(`UPDATE affirmations SET folder_id = ?, updated_at = ? WHERE id = ?`, [
    folderId,
    now,
    id,
  ]);

  await enqueue('affirmations', 'update', id, { folder_id: folderId });
}

/** Deletes the affirmation locally and remotely, and best-effort removes its on-device audio file. */
export async function deleteLocalAffirmation(id: string): Promise<void> {
  const database = await getDatabase();
  const affirmation = await getLocalAffirmation(id);

  await database.runAsync(`DELETE FROM affirmations WHERE id = ?`, [id]);
  await enqueue('affirmations', 'delete', id);

  if (affirmation) {
    try {
      new File(affirmation.local_uri).delete();
    } catch {
      // Best-effort cleanup; a stray file isn't a correctness issue.
    }
  }
}
