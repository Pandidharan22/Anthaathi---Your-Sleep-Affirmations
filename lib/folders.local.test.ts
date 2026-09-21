import { createLocalFolder, listLocalFolders } from './folders.local';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'fixed-uuid') }));
jest.mock('@/lib/db', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/syncQueue', () => ({ enqueue: jest.fn().mockResolvedValue(undefined) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDatabase } = require('@/lib/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { enqueue } = require('@/lib/syncQueue');

function makeFakeDatabase() {
  const inserted: unknown[][] = [];
  return {
    runAsync: jest.fn(async (_sql: string, params: unknown[]) => {
      inserted.push(params);
    }),
    getAllAsync: jest.fn(async () => []),
    __inserted: inserted,
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
});
