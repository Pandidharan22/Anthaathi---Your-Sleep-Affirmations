import { enqueue, processQueue } from './syncQueue';

jest.mock('@/lib/db', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDatabase } = require('@/lib/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabase } = require('@/lib/supabase');

type QueueRow = {
  queue_id: number;
  table_name: string;
  operation: string;
  row_id: string;
  payload: string | null;
  created_at: string;
};

function makeFakeDatabase() {
  let nextId = 1;
  let rows: QueueRow[] = [];
  const localRows: Record<string, Record<string, unknown>> = {};

  return {
    runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith('INSERT INTO sync_queue')) {
        const [table_name, operation, row_id, payload, created_at] = params as string[];
        rows.push({ queue_id: nextId++, table_name, operation, row_id, payload, created_at });
      } else if (sql.startsWith('DELETE FROM sync_queue')) {
        const [queueId] = params as number[];
        rows = rows.filter((r) => r.queue_id !== queueId);
      } else if (sql.startsWith('UPDATE')) {
        const [syncedAt, rowId] = params as string[];
        localRows[rowId] = { ...(localRows[rowId] ?? {}), synced_at: syncedAt };
      }
    }),
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('LIMIT 1')) return rows.length ? [rows[0]] : [];
      if (sql.includes('COUNT(*)')) return [{ remaining: rows.length }];
      return rows;
    }),
    __rows: () => rows,
    __localRows: () => localRows,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('syncQueue', () => {
  it('enqueue inserts a row into sync_queue with the given payload', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    await enqueue('folders', 'upsert', 'folder-1', { id: 'folder-1', name: 'Sleep' });

    expect(db.__rows()).toHaveLength(1);
    expect(db.__rows()[0]).toMatchObject({ table_name: 'folders', operation: 'upsert', row_id: 'folder-1' });
    expect(JSON.parse(db.__rows()[0].payload as string)).toEqual({ id: 'folder-1', name: 'Sleep' });
  });

  it('processQueue pushes queued upserts to Supabase and clears them', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);
    const upsert = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ upsert });

    await enqueue('folders', 'upsert', 'folder-1', { id: 'folder-1', name: 'Sleep' });
    await enqueue('folders', 'upsert', 'folder-2', { id: 'folder-2', name: 'Focus' });

    const result = await processQueue();

    expect(result).toEqual({ processed: 2, remaining: 0 });
    expect(db.__rows()).toHaveLength(0);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(db.__localRows()['folder-1'].synced_at).toBeTruthy();
  });

  it('processQueue issues a real partial update for update-op rows, not an upsert', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq }));
    const upsert = jest.fn();
    supabase.from.mockReturnValue({ update, upsert });

    await enqueue('affirmations', 'update', 'aff-1', { trim_start_ms: 1000, trim_end_ms: 9000 });
    const result = await processQueue();

    expect(result).toEqual({ processed: 1, remaining: 0 });
    expect(update).toHaveBeenCalledWith({ trim_start_ms: 1000, trim_end_ms: 9000 });
    expect(eq).toHaveBeenCalledWith('id', 'aff-1');
    expect(upsert).not.toHaveBeenCalled();
    expect(db.__localRows()['aff-1'].synced_at).toBeTruthy();
  });

  it('processQueue issues a delete for delete-op rows', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);
    const eq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn(() => ({ eq }));
    supabase.from.mockReturnValue({ delete: del });

    await enqueue('folders', 'delete', 'folder-1');
    const result = await processQueue();

    expect(result).toEqual({ processed: 1, remaining: 0 });
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('id', 'folder-1');
  });

  it('stops at the first failure and leaves the rest queued, in order', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);
    const upsert = jest
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'network error' } });
    supabase.from.mockReturnValue({ upsert });

    await enqueue('folders', 'upsert', 'folder-1', { id: 'folder-1' });
    await enqueue('folders', 'upsert', 'folder-2', { id: 'folder-2' });
    await enqueue('folders', 'upsert', 'folder-3', { id: 'folder-3' });

    const result = await processQueue();

    expect(result).toEqual({ processed: 1, remaining: 2 });
    expect(db.__rows().map((r: QueueRow) => r.row_id)).toEqual(['folder-2', 'folder-3']);
  });
});
