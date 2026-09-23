import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

import { getDatabase } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { enqueue } from '@/lib/syncQueue';

export type GoalStatus = 'active' | 'achieved';

export type LocalGoal = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_local_uri: string | null;
  image_path: string | null;
  status: GoalStatus;
  created_at: string;
  achieved_at: string | null;
  updated_at: string;
  synced_at: string | null;
};

export type CreateLocalGoalInput = {
  userId: string;
  title: string;
  description: string;
  imageLocalUri?: string | null;
};

/** Writes the goal locally (always succeeds offline) and queues the Postgres upsert. */
export async function createLocalGoal(input: CreateLocalGoalInput): Promise<LocalGoal> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const goal: LocalGoal = {
    id: Crypto.randomUUID(),
    user_id: input.userId,
    title: input.title,
    description: input.description,
    image_local_uri: input.imageLocalUri ?? null,
    image_path: null,
    status: 'active',
    created_at: now,
    achieved_at: null,
    updated_at: now,
    synced_at: null,
  };

  await database.runAsync(
    `INSERT INTO goals (
      id, user_id, title, description, image_local_uri, image_path,
      status, created_at, achieved_at, updated_at, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      goal.id,
      goal.user_id,
      goal.title,
      goal.description,
      goal.image_local_uri,
      goal.image_path,
      goal.status,
      goal.created_at,
      goal.achieved_at,
      goal.updated_at,
      goal.synced_at,
    ],
  );

  // image_path is always null here — a local image (if any) is uploaded and
  // its path synced separately by lib/goalImages.ts once connectivity allows.
  await enqueue('goals', 'upsert', goal.id, {
    id: goal.id,
    user_id: goal.user_id,
    title: goal.title,
    description: goal.description,
    image_path: goal.image_path,
    status: goal.status,
    created_at: goal.created_at,
    achieved_at: goal.achieved_at,
  });

  return goal;
}

export async function listLocalGoals(userId: string): Promise<LocalGoal[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalGoal>(
    `SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
  );
}

export async function getLocalGoal(id: string): Promise<LocalGoal | null> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<LocalGoal>(`SELECT * FROM goals WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

/** Updates a goal's title/description. */
export async function updateLocalGoalText(
  id: string,
  title: string,
  description: string,
): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.runAsync(`UPDATE goals SET title = ?, description = ?, updated_at = ? WHERE id = ?`, [
    title,
    description,
    now,
    id,
  ]);

  await enqueue('goals', 'update', id, { title, description });
}

/**
 * Sets or replaces a goal's local image, or removes it (imageLocalUri: null).
 * image_path is reset to null so lib/goalImages.ts re-uploads under the same
 * deterministic key next sync. If an image is being removed rather than
 * replaced, the previously-uploaded remote object is left in place (not
 * deleted) — a bounded, harmless orphan cleaned up when the goal itself or
 * the account is deleted, not worth a network round trip on every removal.
 */
export async function updateLocalGoalImage(id: string, imageLocalUri: string | null): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const existing = await getLocalGoal(id);

  await database.runAsync(
    `UPDATE goals SET image_local_uri = ?, image_path = NULL, updated_at = ? WHERE id = ?`,
    [imageLocalUri, now, id],
  );

  await enqueue('goals', 'update', id, { image_path: null });

  if (existing?.image_local_uri && existing.image_local_uri !== imageLocalUri) {
    try {
      new File(existing.image_local_uri).delete();
    } catch {
      // Best-effort cleanup; a stray file isn't a correctness issue.
    }
  }
}

/** Marks a goal achieved or moves it back to active (FR-404). */
export async function updateLocalGoalStatus(id: string, status: GoalStatus): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const achievedAt = status === 'achieved' ? now : null;

  await database.runAsync(`UPDATE goals SET status = ?, achieved_at = ?, updated_at = ? WHERE id = ?`, [
    status,
    achievedAt,
    now,
    id,
  ]);

  await enqueue('goals', 'update', id, { status, achieved_at: achievedAt });
}

/**
 * Deletes the goal locally and remotely, and best-effort removes its local
 * image file and uploaded Storage object. Unlike everything else in this
 * file, the Storage removal is a direct Supabase call rather than a queued
 * operation — the sync queue only knows how to replay Postgres table rows,
 * and this is a fire-and-forget cleanup: if it fails (offline), the object
 * is simply an orphan, harmless and bounded to this one goal.
 */
export async function deleteLocalGoal(id: string): Promise<void> {
  const database = await getDatabase();
  const goal = await getLocalGoal(id);

  await database.runAsync(`DELETE FROM goals WHERE id = ?`, [id]);
  // user_id carried in the payload so account deletion can still attribute
  // this queue entry to its user even after the local row itself is gone.
  await enqueue('goals', 'delete', id, goal ? { user_id: goal.user_id } : undefined);

  if (goal?.image_local_uri) {
    try {
      new File(goal.image_local_uri).delete();
    } catch {
      // Best-effort cleanup; a stray file isn't a correctness issue.
    }
  }

  if (goal?.image_path) {
    try {
      await supabase.storage.from('goal-images').remove([goal.image_path]);
    } catch {
      // Best-effort cleanup; an orphaned Storage object isn't a correctness issue.
    }
  }
}
