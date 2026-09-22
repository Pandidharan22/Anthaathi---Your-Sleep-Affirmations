import { deleteAccount } from './account';

const mockFileDelete = jest.fn();
const mockRpc = jest.fn();
const mockSignOut = jest.fn();

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ delete: mockFileDelete })),
}));
jest.mock('@/lib/db', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { signOut: (...args: unknown[]) => mockSignOut(...args) },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDatabase } = require('@/lib/db');

function makeFakeDatabase(
  folders: { id: string }[],
  affirmations: { id: string; local_uri: string }[],
  deleteOpQueueRows: { queue_id: number; payload: string | null }[] = [],
) {
  const runCalls: [string, unknown[]][] = [];
  return {
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('FROM folders')) return folders;
      if (sql.includes('FROM affirmations')) return affirmations;
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
});

describe('deleteAccount', () => {
  it('calls the RPC, cleans up local rows/files/queue entries, and signs out', async () => {
    mockRpc.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
    const db = makeFakeDatabase(
      [{ id: 'folder-1' }],
      [{ id: 'aff-1', local_uri: 'file:///doc/rec.m4a' }],
    );
    getDatabase.mockResolvedValue(db);

    await deleteAccount('user-1');

    expect(mockRpc).toHaveBeenCalledWith('delete_own_account');
    expect(mockFileDelete).toHaveBeenCalled();
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM affirmations WHERE user_id = ?'), [
      'user-1',
    ]);
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM folders WHERE user_id = ?'), [
      'user-1',
    ]);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM sync_queue WHERE row_id IN'),
      ['folder-1', 'aff-1'],
    );
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('throws and leaves local data untouched when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'network error' } });
    const db = makeFakeDatabase([], []);
    getDatabase.mockResolvedValue(db);

    await expect(deleteAccount('user-1')).rejects.toEqual({ message: 'network error' });

    expect(db.runAsync).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('skips the sync_queue cleanup when there is nothing local to clean up', async () => {
    mockRpc.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
    const db = makeFakeDatabase([], []);
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
    // folders/affirmations tables are empty (already deleted via deleteLocalFolder
    // before the account itself was deleted), but a stale 'delete' queue entry
    // for that same user (payload set by folders.local.ts's fix) remains, plus
    // one belonging to a different user that must NOT be touched.
    const db = makeFakeDatabase([], [], [
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
