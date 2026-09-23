import { uploadPendingGoalImages } from './goalImages';

const mockUpload = jest.fn();
const mockFrom = jest.fn((_bucket: string) => ({ upload: mockUpload }));
const mockBytes = jest.fn();

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ bytes: mockBytes })),
}));
jest.mock('@/lib/db', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: { storage: { from: (bucket: string) => mockFrom(bucket) } } }));
jest.mock('@/lib/syncQueue', () => ({ enqueue: jest.fn().mockResolvedValue(undefined) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDatabase } = require('@/lib/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { enqueue } = require('@/lib/syncQueue');

function makeFakeDatabase(pending: unknown[]) {
  const runCalls: [string, unknown[]][] = [];
  return {
    getAllAsync: jest.fn(async () => pending),
    runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      runCalls.push([sql, params]);
    }),
    __runCalls: runCalls,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('uploadPendingGoalImages', () => {
  it('uploads each pending local image and syncs the resulting storage path', async () => {
    const db = makeFakeDatabase([
      { id: 'goal-1', user_id: 'user-1', image_local_uri: 'file:///doc/goal-1.jpg' },
    ]);
    getDatabase.mockResolvedValue(db);
    mockBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockUpload.mockResolvedValue({ error: null });

    await uploadPendingGoalImages();

    expect(mockFrom).toHaveBeenCalledWith('goal-images');
    expect(mockUpload).toHaveBeenCalledWith('user-1/goal-1', expect.any(Uint8Array), {
      contentType: 'image/jpeg',
      upsert: true,
    });
    expect(db.__runCalls).toContainEqual([
      expect.stringContaining('UPDATE goals SET image_path'),
      ['user-1/goal-1', 'goal-1'],
    ]);
    expect(enqueue).toHaveBeenCalledWith('goals', 'update', 'goal-1', { image_path: 'user-1/goal-1' });
  });

  it('leaves the goal pending (no local update, no enqueue) when the upload fails', async () => {
    const db = makeFakeDatabase([
      { id: 'goal-1', user_id: 'user-1', image_local_uri: 'file:///doc/goal-1.jpg' },
    ]);
    getDatabase.mockResolvedValue(db);
    mockBytes.mockResolvedValue(new Uint8Array([1]));
    mockUpload.mockResolvedValue({ error: { message: 'network error' } });

    await uploadPendingGoalImages();

    expect(db.runAsync).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('continues to the next goal when reading the local file throws', async () => {
    const db = makeFakeDatabase([
      { id: 'goal-1', user_id: 'user-1', image_local_uri: 'file:///doc/broken.jpg' },
      { id: 'goal-2', user_id: 'user-1', image_local_uri: 'file:///doc/goal-2.jpg' },
    ]);
    getDatabase.mockResolvedValue(db);
    mockBytes.mockRejectedValueOnce(new Error('file gone')).mockResolvedValueOnce(new Uint8Array([1]));
    mockUpload.mockResolvedValue({ error: null });

    await uploadPendingGoalImages();

    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledWith('user-1/goal-2', expect.any(Uint8Array), expect.anything());
  });

  it('does nothing when there are no pending images', async () => {
    const db = makeFakeDatabase([]);
    getDatabase.mockResolvedValue(db);

    await uploadPendingGoalImages();

    expect(mockUpload).not.toHaveBeenCalled();
  });
});
