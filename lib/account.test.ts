import { deleteAccount } from './account';

const mockFileDelete = jest.fn();
const mockRpc = jest.fn();
const mockSignOut = jest.fn();
const mockStorageList = jest.fn();
const mockStorageRemove = jest.fn();

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ delete: mockFileDelete })),
}));
jest.mock('@/lib/db', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { signOut: (...args: unknown[]) => mockSignOut(...args) },
    storage: {
      from: () => ({
        list: (...args: unknown[]) => mockStorageList(...args),
        remove: (...args: unknown[]) => mockStorageRemove(...args),
      }),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDatabase } = require('@/lib/db');

function makeFakeDatabase(
  folders: { id: string }[],
  affirmations: { id: string; local_uri: string }[],
  goals: { id: string; image_local_uri: string | null }[] = [],
  deleteOpQueueRows: { queue_id: number; payload: string | null }[] = [],
) {
  const runCalls: [string, unknown[]][] = [];
  return {
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('FROM folders')) return folders;
      if (sql.includes('FROM affirmations')) return affirmations;
      if (sql.includes('FROM goals')) return goals;
      if (sql.includes("operation = 'delete'")) return deleteOpQueueRows;
      return [];
    }),
    runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      runCalls.push([sql, params]);
    }),
    __runCalls: runCalls,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStorageList.mockResolvedValue({ data: [], error: null });
  mockStorageRemove.mockResolvedValue({ error: null });
});

describe('deleteAccount', () => {
  it('removes goal images, calls the RPC, cleans up local rows/files/queue entries, and signs out', async () => {
    mockRpc.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
    mockStorageList.mockResolvedValue({ data: [{ name: 'goal-1' }], error: null });
    const db = makeFakeDatabase(
      [{ id: 'folder-1' }],
      [{ id: 'aff-1', local_uri: 'file:///doc/rec.m4a' }],
      [{ id: 'goal-1', image_local_uri: 'file:///doc/goal-1.jpg' }],
    );
    getDatabase.mockResolvedValue(db);

    await deleteAccount('user-1');

    expect(mockStorageList).toHaveBeenCalledWith('user-1');
    expect(mockStorageRemove).toHaveBeenCalledWith(['user-1/goal-1']);
    expect(mockRpc).toHaveBeenCalledWith('delete_own_account');
    expect(mockFileDelete).toHaveBeenCalledTimes(2); // one recording, one goal image
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM affirmations WHERE user_id = ?'), [
      'user-1',
    ]);
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM folders WHERE user_id = ?'), [
      'user-1',
    ]);
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM goals WHERE user_id = ?'), [
      'user-1',
    ]);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM sync_queue WHERE row_id IN'),
      ['folder-1', 'aff-1', 'goal-1'],
    );
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('throws and leaves everything untouched when goal-image cleanup fails, without calling the RPC', async () => {
    mockStorageList.mockResolvedValue({ data: null, error: { message: 'network error' } });
    const db = makeFakeDatabase([], [], []);
    getDatabase.mockResolvedValue(db);

    await expect(deleteAccount('user-1')).rejects.toEqual({ message: 'network error' });

    expect(mockRpc).not.toHaveBeenCalled();
    expect(db.runAsync).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('throws and leaves local data untouched when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'network error' } });
    const db = makeFakeDatabase([], [], []);
    getDatabase.mockResolvedValue(db);

    await expect(deleteAccount('user-1')).rejects.toEqual({ message: 'network error' });

    expect(db.runAsync).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('skips the sync_queue cleanup when there is nothing local to clean up', async () => {
    mockRpc.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
    const db = makeFakeDatabase([], [], []);
    getDatabase.mockResolvedValue(db);

    await deleteAccount('user-1');

    expect(db.runAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('sync_queue'),
      expect.anything(),
    );
  });

  it('also clears delete-op queue rows for entities already deleted locally before account deletion', async () => {
    mockRpc.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
    // folders/affirmations/goals tables are empty (already deleted locally
    // before the account itself was deleted), but a stale 'delete' queue entry
    // for that same user (payload set by folders.local.ts's fix) remains, plus
    // one belonging to a different user that must NOT be touched.
    const db = makeFakeDatabase([], [], [], [
      { queue_id: 7, payload: JSON.stringify({ user_id: 'user-1' }) },
      { queue_id: 8, payload: JSON.stringify({ user_id: 'someone-else' }) },
      { queue_id: 9, payload: null },
    ]);
    getDatabase.mockResolvedValue(db);

    await deleteAccount('user-1');

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM sync_queue WHERE queue_id IN'),
      [7],
    );
  });
});
