import { getDatabase } from '@/lib/db';
import { supabase } from '@/lib/supabase';

export type SyncTable = 'folders' | 'affirmations';
export type SyncOperation = 'upsert' | 'update' | 'delete';

// The remote NOT NULL columns per table (see supabase/migrations). Checked at
// enqueue() time for 'upsert' so a caller that reaches for 'upsert' with a
// partial payload out of habit fails loudly right away, in local code —
// instead of silently reproducing the exact NOT-NULL-on-partial-upsert bug
// this module was already patched once for (see the 'update' operation doc
// below), which previously only surfaced against real Postgres at sync time.
const REQUIRED_UPSERT_FIELDS: Record<SyncTable, string[]> = {
  folders: ['id', 'user_id', 'name', 'created_at'],
  affirmations: ['id', 'user_id', 'title', 'local_uri', 'duration_ms', 'source', 'created_at'],
};

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
 * shaped as remote columns (no local bookkeeping fields like synced_at).
 * Required for 'upsert' (the full row — this is what creates it remotely) and
 * 'update' (just the changed columns), ignored for 'delete'.
 *
 * 'update' issues a real partial UPDATE rather than upsert()'s INSERT ... ON
 * CONFLICT DO UPDATE: Postgres validates NOT NULL constraints on the proposed
 * insert row before it even checks for a conflict, so a partial payload sent
 * through upsert() fails on any column not included, even when the row
 * already exists. A true UPDATE only ever touches the columns given.
 */
export async function enqueue(
  table: SyncTable,
  operation: SyncOperation,
  rowId: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  if (operation === 'upsert') {
    const missing = REQUIRED_UPSERT_FIELDS[table].filter((field) => payload?.[field] == null);
    if (missing.length > 0) {
      throw new Error(
        `enqueue('${table}', 'upsert', ...) payload is missing required field(s): ${missing.join(', ')}. ` +
          `'upsert' needs the full row — use 'update' for a partial change.`,
      );
    }
  }

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
      if (next.operation === 'upsert' || next.operation === 'update') {
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
  if (!payload) {
    throw new Error(`Queued ${row.operation} for ${row.table_name}/${row.row_id} has no payload`);
  }

  if (row.operation === 'update') {
    const { error } = await supabase.from(row.table_name).update(payload).eq('id', row.row_id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from(row.table_name).upsert(payload);
  if (error) throw error;
}
