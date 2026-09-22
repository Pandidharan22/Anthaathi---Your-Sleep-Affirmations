import {
  createLocalAffirmation,
  getLocalAffirmation,
  listLocalAffirmations,
  updateLocalAffirmationTrim,
} from './affirmations.local';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'fixed-uuid') }));
jest.mock('@/lib/db', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/syncQueue', () => ({ enqueue: jest.fn().mockResolvedValue(undefined) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDatabase } = require('@/lib/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { enqueue } = require('@/lib/syncQueue');

function makeFakeDatabase(getAllResult: unknown[] = []) {
  const inserted: unknown[][] = [];
  return {
    runAsync: jest.fn(async (_sql: string, params: unknown[]) => {
      inserted.push(params);
    }),
    getAllAsync: jest.fn(async () => getAllResult),
    __inserted: inserted,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  (require('expo-crypto').randomUUID as jest.Mock).mockReturnValue('fixed-uuid');
});

describe('affirmations.local', () => {
  it('createLocalAffirmation writes the row locally and enqueues an upsert with only remote columns', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    const affirmation = await createLocalAffirmation({
      userId: 'user-1',
      title: 'Recording — Sep 21',
      localUri: 'file:///doc/rec.m4a',
      durationMs: 5000,
      source: 'recorded',
      trimStartMs: 500,
      trimEndMs: 4500,
    });

    expect(affirmation).toMatchObject({
      id: 'fixed-uuid',
      user_id: 'user-1',
      folder_id: null,
      title: 'Recording — Sep 21',
      local_uri: 'file:///doc/rec.m4a',
      storage_path: null,
      duration_ms: 5000,
      source: 'recorded',
      voice_id: null,
      script_text: null,
      trim_start_ms: 500,
      trim_end_ms: 4500,
    });
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO affirmations'),
      [
        'fixed-uuid',
        'user-1',
        null,
        'Recording — Sep 21',
        'file:///doc/rec.m4a',
        null,
        5000,
        'recorded',
        null,
        null,
        500,
        4500,
        affirmation.created_at,
        affirmation.updated_at,
        null,
      ],
    );
    expect(enqueue).toHaveBeenCalledWith('affirmations', 'upsert', 'fixed-uuid', {
      id: 'fixed-uuid',
      user_id: 'user-1',
      folder_id: null,
      title: 'Recording — Sep 21',
      local_uri: 'file:///doc/rec.m4a',
      storage_path: null,
      duration_ms: 5000,
      source: 'recorded',
      voice_id: null,
      script_text: null,
      trim_start_ms: 500,
      trim_end_ms: 4500,
      created_at: affirmation.created_at,
    });
  });

  it('createLocalAffirmation defaults trim fields to null when omitted', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    const affirmation = await createLocalAffirmation({
      userId: 'user-1',
      title: 'Recording',
      localUri: 'file:///doc/rec.m4a',
      durationMs: 5000,
      source: 'recorded',
    });

    expect(affirmation.trim_start_ms).toBeNull();
    expect(affirmation.trim_end_ms).toBeNull();
  });

  it('listLocalAffirmations queries by user_id', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    await listLocalAffirmations('user-1');

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = ?'), [
      'user-1',
    ]);
  });

  it('getLocalAffirmation returns the row when found', async () => {
    const row = { id: 'aff-1', title: 'Test' };
    const db = makeFakeDatabase([row]);
    getDatabase.mockResolvedValue(db);

    const result = await getLocalAffirmation('aff-1');

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE id = ?'), [
      'aff-1',
    ]);
    expect(result).toBe(row);
  });

  it('getLocalAffirmation returns null when not found', async () => {
    const db = makeFakeDatabase([]);
    getDatabase.mockResolvedValue(db);

    const result = await getLocalAffirmation('missing');

    expect(result).toBeNull();
  });

  it('updateLocalAffirmationTrim updates the row and enqueues a partial update (not upsert)', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    await updateLocalAffirmationTrim('aff-1', 1000, 9000);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE affirmations SET trim_start_ms'),
      [1000, 9000, expect.any(String), 'aff-1'],
    );
    expect(enqueue).toHaveBeenCalledWith('affirmations', 'update', 'aff-1', {
      trim_start_ms: 1000,
      trim_end_ms: 9000,
    });
  });
});
