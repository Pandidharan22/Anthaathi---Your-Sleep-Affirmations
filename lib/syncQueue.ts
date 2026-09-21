import { getDatabase } from '@/lib/db';
import { supabase } from '@/lib/supabase';

export type SyncTable = 'folders' | 'affirmations';
export type SyncOperation = 'upsert' | 'delete';

type QueueRow = {
  queue_id: number;
  table_name: SyncTable;
  operation: SyncOperation;
  row_id: string;
  payload: string | null;
  created_at: string;
};

/**
 * Queues a local change for later push to Supabase. `payload` must already be
 * shaped as the remote row (remote-only columns — no local bookkeeping fields
 * like synced_at) and is required for 'upsert', ignored for 'delete'.
 */
export async function enqueue(
  table: SyncTable,
  operation: SyncOperation,
  rowId: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO sync_queue (table_name, operation, row_id, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
    [table, operation, rowId, payload ? JSON.stringify(payload) : null, new Date().toISOString()],
  );
}

let processing = false;

/**
 * Drains the queue in FIFO order. Stops at the first failure (assumed to be
 * connectivity) and leaves that item and everything after it queued for the
 * next attempt — never reorders or drops on failure.
 */
export async function processQueue(): Promise<{ processed: number; remaining: number }> {
  if (processing) return { processed: 0, remaining: 0 };
  processing = true;

  try {
    const database = await getDatabase();
    let processedCount = 0;

    while (true) {
      const [next] = await database.getAllAsync<QueueRow>(
        `SELECT * FROM sync_queue ORDER BY queue_id ASC LIMIT 1`,
      );
      if (!next) break;

      try {
        await pushOne(next);
      } catch {
        const [{ remaining }] = await database.getAllAsync<{ remaining: number }>(
          `SELECT COUNT(*) as remaining FROM sync_queue`,
        );
        return { processed: processedCount, remaining };
      }

      await database.runAsync(`DELETE FROM sync_queue WHERE queue_id = ?`, [next.queue_id]);
      if (next.operation === 'upsert') {
        await database.runAsync(`UPDATE ${next.table_name} SET synced_at = ? WHERE id = ?`, [
          new Date().toISOString(),
          next.row_id,
        ]);
      }
      processedCount += 1;
    }

    return { processed: processedCount, remaining: 0 };
  } finally {
    processing = false;
  }
}

async function pushOne(row: QueueRow): Promise<void> {
  if (row.operation === 'delete') {
    const { error } = await supabase.from(row.table_name).delete().eq('id', row.row_id);
    if (error) throw error;
    return;
  }

  const payload = row.payload ? JSON.parse(row.payload) : null;
  if (!payload) throw new Error(`Queued upsert for ${row.table_name}/${row.row_id} has no payload`);

  const { error } = await supabase.from(row.table_name).upsert(payload);
  if (error) throw error;
}
