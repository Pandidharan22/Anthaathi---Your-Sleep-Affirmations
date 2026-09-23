import {
  createLocalJournalEntry,
  deleteLocalJournalEntry,
  getLocalJournalEntry,
  listLocalJournalEntries,
} from './journal.local';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'fixed-uuid') }));
jest.mock('@/lib/db', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/syncQueue', () => ({ enqueue: jest.fn().mockResolvedValue(undefined) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDatabase } = require('@/lib/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { enqueue } = require('@/lib/syncQueue');

function makeFakeDatabase(getAllResult: unknown[] = []) {
  const runCalls: [string, unknown[]][] = [];
  return {
    runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      runCalls.push([sql, params]);
    }),
    getAllAsync: jest.fn(async () => getAllResult),
    __runCalls: runCalls,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (require('expo-crypto').randomUUID as jest.Mock).mockReturnValue('fixed-uuid');
});

describe('journal.local', () => {
  it('createLocalJournalEntry writes the row locally and enqueues an upsert, with a prompt', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    const entry = await createLocalJournalEntry({
      userId: 'user-1',
      prompt: 'What went well today?',
      body: 'Finished a hard project.',
    });

    expect(entry).toMatchObject({
      id: 'fixed-uuid',
      user_id: 'user-1',
      prompt: 'What went well today?',
      body: 'Finished a hard project.',
      synced_at: null,
    });
    expect(enqueue).toHaveBeenCalledWith('journal_entries', 'upsert', 'fixed-uuid', {
      id: 'fixed-uuid',
      user_id: 'user-1',
      prompt: 'What went well today?',
      body: 'Finished a hard project.',
      created_at: entry.created_at,
    });
  });

  it('createLocalJournalEntry allows a null prompt (freeform)', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    const entry = await createLocalJournalEntry({ userId: 'user-1', prompt: null, body: 'Freeform thoughts.' });

    expect(entry.prompt).toBeNull();
    expect(enqueue).toHaveBeenCalledWith(
      'journal_entries',
      'upsert',
      'fixed-uuid',
      expect.objectContaining({ prompt: null }),
    );
  });

  it('listLocalJournalEntries queries by user_id, newest first', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    await listLocalJournalEntries('user-1');

    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = ? ORDER BY created_at DESC'),
      ['user-1'],
    );
  });

  it('getLocalJournalEntry returns the row when found, null otherwise', async () => {
    const found = makeFakeDatabase([{ id: 'entry-1' }]);
    getDatabase.mockResolvedValue(found);
    expect(await getLocalJournalEntry('entry-1')).toEqual({ id: 'entry-1' });

    const missing = makeFakeDatabase([]);
    getDatabase.mockResolvedValue(missing);
    expect(await getLocalJournalEntry('missing')).toBeNull();
  });

  it('deleteLocalJournalEntry deletes the row and enqueues a delete carrying user_id', async () => {
    const db = makeFakeDatabase([{ id: 'entry-1', user_id: 'user-1' }]);
    getDatabase.mockResolvedValue(db);

    await deleteLocalJournalEntry('entry-1');

    expect(db.__runCalls).toContainEqual([expect.stringContaining('DELETE FROM journal_entries'), ['entry-1']]);
    expect(enqueue).toHaveBeenCalledWith('journal_entries', 'delete', 'entry-1', { user_id: 'user-1' });
  });

  it('deleteLocalJournalEntry enqueues a delete with no payload when the entry is already gone', async () => {
    const db = makeFakeDatabase([]);
    getDatabase.mockResolvedValue(db);

    await deleteLocalJournalEntry('missing');

    expect(enqueue).toHaveBeenCalledWith('journal_entries', 'delete', 'missing', undefined);
  });
});
