import * as Crypto from 'expo-crypto';

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
    created_at: now,
    updated_at: now,
    synced_at: null,
  };

  await database.runAsync(
    `INSERT INTO affirmations (
      id, user_id, folder_id, title, local_uri, storage_path, duration_ms,
      source, voice_id, script_text, created_at, updated_at, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
