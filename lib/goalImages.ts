import { File } from 'expo-file-system';

import { getDatabase } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { enqueue } from '@/lib/syncQueue';

type PendingGoalImage = {
  id: string;
  user_id: string;
  image_local_uri: string;
};

/**
 * Uploads any local goal images that haven't made it to Storage yet
 * (image_local_uri set, image_path still null) and syncs the resulting path
 * back to Postgres. Called alongside processQueue() on reconnect, after the
 * goal's own row has synced — a goal that hasn't synced yet can't take an
 * `image_path` update, since the remote row doesn't exist for it to target.
 *
 * Storage path is deterministic ({user_id}/{goal_id}, upsert: true) so a
 * later image change just overwrites this same object.
 */
export async function uploadPendingGoalImages(): Promise<void> {
  const database = await getDatabase();
  const pending = await database.getAllAsync<PendingGoalImage>(
    `SELECT id, user_id, image_local_uri FROM goals WHERE image_local_uri IS NOT NULL AND image_path IS NULL`,
  );

  for (const goal of pending) {
    try {
      const file = new File(goal.image_local_uri);
      const bytes = await file.bytes();
      const storagePath = `${goal.user_id}/${goal.id}`;

      const { error } = await supabase.storage
        .from('goal-images')
        .upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: true });
      if (error) continue; // retried on the next reconnect

      await database.runAsync(`UPDATE goals SET image_path = ? WHERE id = ?`, [storagePath, goal.id]);
      await enqueue('goals', 'update', goal.id, { image_path: storagePath });
    } catch {
      continue; // retried on the next reconnect
    }
  }
}
