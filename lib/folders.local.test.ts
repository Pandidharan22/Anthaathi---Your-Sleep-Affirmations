import {
  createLocalFolder,
  deleteLocalFolder,
  getLocalFolder,
  listLocalFolders,
  renameLocalFolder,
} from './folders.local';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'fixed-uuid') }));
jest.mock('@/lib/db', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/syncQueue', () => ({ enqueue: jest.fn().mockResolvedValue(undefined) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDatabase } = require('@/lib/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { enqueue } = require('@/lib/syncQueue');

function makeFakeDatabase(getAllResult: unknown[] = []) {
  const inserted: unknown[][] = [];
  const runCalls: [string, unknown[]][] = [];
  return {
    runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      inserted.push(params);
      runCalls.push([sql, params]);
    }),
    getAllAsync: jest.fn(async () => getAllResult),
    __inserted: inserted,
    __runCalls: runCalls,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  (require('expo-crypto').randomUUID as jest.Mock).mockReturnValue('fixed-uuid');
});

describe('folders.local', () => {
  it('createLocalFolder writes the row locally and enqueues an upsert with only remote columns', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    const folder = await createLocalFolder('user-1', 'Sleep affirmations');

    expect(folder).toMatchObject({ id: 'fixed-uuid', user_id: 'user-1', name: 'Sleep affirmations' });
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO folders'),
      ['fixed-uuid', 'user-1', 'Sleep affirmations', folder.created_at, folder.updated_at, null],
    );
    expect(enqueue).toHaveBeenCalledWith('folders', 'upsert', 'fixed-uuid', {
      id: 'fixed-uuid',
      user_id: 'user-1',
      name: 'Sleep affirmations',
      created_at: folder.created_at,
    });
  });

  it('listLocalFolders queries by user_id', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    await listLocalFolders('user-1');

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = ?'), [
      'user-1',
    ]);
  });

  it('getLocalFolder returns the row when found, null otherwise', async () => {
    const found = makeFakeDatabase([{ id: 'folder-1', name: 'Sleep' }]);
    getDatabase.mockResolvedValue(found);
    expect(await getLocalFolder('folder-1')).toEqual({ id: 'folder-1', name: 'Sleep' });

    const missing = makeFakeDatabase([]);
    getDatabase.mockResolvedValue(missing);
    expect(await getLocalFolder('missing')).toBeNull();
  });

  it('renameLocalFolder updates the row and enqueues a partial update', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    await renameLocalFolder('folder-1', 'Focus');

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE folders SET name'),
      ['Focus', expect.any(String), 'folder-1'],
    );
    expect(enqueue).toHaveBeenCalledWith('folders', 'update', 'folder-1', { name: 'Focus' });
  });

  it('deleteLocalFolder un-files affirmations locally, deletes the folder, and enqueues a delete', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    await deleteLocalFolder('folder-1');

    expect(db.__runCalls).toEqual([
      [
        expect.stringContaining('UPDATE affirmations SET folder_id = NULL'),
        [expect.any(String), 'folder-1'],
      ],
      [expect.stringContaining('DELETE FROM folders'), ['folder-1']],
    ]);
    expect(enqueue).toHaveBeenCalledWith('folders', 'delete', 'folder-1');
  });
});
