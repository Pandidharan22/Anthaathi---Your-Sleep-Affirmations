import {
  createLocalGoal,
  deleteLocalGoal,
  getLocalGoal,
  listLocalGoals,
  updateLocalGoalImage,
  updateLocalGoalStatus,
  updateLocalGoalText,
} from './goals.local';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'fixed-uuid') }));
jest.mock('expo-file-system', () => ({ File: jest.fn().mockImplementation(() => ({ delete: jest.fn() })) }));
jest.mock('@/lib/db', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/syncQueue', () => ({ enqueue: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: jest.fn(() => ({ remove: jest.fn().mockResolvedValue({ error: null }) })) } },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDatabase } = require('@/lib/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { enqueue } = require('@/lib/syncQueue');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { File } = require('expo-file-system');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabase } = require('@/lib/supabase');

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

describe('goals.local', () => {
  it('createLocalGoal writes the row locally (image_path null) and enqueues an upsert', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    const goal = await createLocalGoal({
      userId: 'user-1',
      title: 'Run a marathon',
      description: 'Finish under 4 hours',
      imageLocalUri: 'file:///doc/goal.jpg',
    });

    expect(goal).toMatchObject({
      id: 'fixed-uuid',
      user_id: 'user-1',
      title: 'Run a marathon',
      description: 'Finish under 4 hours',
      image_local_uri: 'file:///doc/goal.jpg',
      image_path: null,
      status: 'active',
      achieved_at: null,
    });
    expect(enqueue).toHaveBeenCalledWith('goals', 'upsert', 'fixed-uuid', {
      id: 'fixed-uuid',
      user_id: 'user-1',
      title: 'Run a marathon',
      description: 'Finish under 4 hours',
      image_path: null,
      status: 'active',
      created_at: goal.created_at,
      achieved_at: null,
    });
  });

  it('listLocalGoals queries by user_id', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    await listLocalGoals('user-1');

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = ?'), ['user-1']);
  });

  it('getLocalGoal returns the row when found, null otherwise', async () => {
    const found = makeFakeDatabase([{ id: 'goal-1' }]);
    getDatabase.mockResolvedValue(found);
    expect(await getLocalGoal('goal-1')).toEqual({ id: 'goal-1' });

    const missing = makeFakeDatabase([]);
    getDatabase.mockResolvedValue(missing);
    expect(await getLocalGoal('missing')).toBeNull();
  });

  it('updateLocalGoalText updates title/description and enqueues a partial update', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    await updateLocalGoalText('goal-1', 'New title', 'New description');

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE goals SET title'),
      ['New title', 'New description', expect.any(String), 'goal-1'],
    );
    expect(enqueue).toHaveBeenCalledWith('goals', 'update', 'goal-1', {
      title: 'New title',
      description: 'New description',
    });
  });

  it('updateLocalGoalStatus sets achieved_at when marking achieved, clears it when reverting', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    await updateLocalGoalStatus('goal-1', 'achieved');

    expect(enqueue).toHaveBeenCalledWith('goals', 'update', 'goal-1', {
      status: 'achieved',
      achieved_at: expect.any(String),
    });

    await updateLocalGoalStatus('goal-1', 'active');

    expect(enqueue).toHaveBeenCalledWith('goals', 'update', 'goal-1', {
      status: 'active',
      achieved_at: null,
    });
  });

  it('updateLocalGoalImage resets image_path, enqueues the reset, and cleans up the replaced file', async () => {
    const db = makeFakeDatabase([
      { id: 'goal-1', user_id: 'user-1', image_local_uri: 'file:///doc/old.jpg' },
    ]);
    getDatabase.mockResolvedValue(db);
    const deleteFn = jest.fn();
    (File as jest.Mock).mockImplementation(() => ({ delete: deleteFn }));

    await updateLocalGoalImage('goal-1', 'file:///doc/new.jpg');

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('image_local_uri = ?, image_path = NULL'),
      ['file:///doc/new.jpg', expect.any(String), 'goal-1'],
    );
    expect(enqueue).toHaveBeenCalledWith('goals', 'update', 'goal-1', { image_path: null });
    expect(deleteFn).toHaveBeenCalled();
  });

  it('updateLocalGoalImage does not attempt cleanup when there was no previous image', async () => {
    const db = makeFakeDatabase([{ id: 'goal-1', user_id: 'user-1', image_local_uri: null }]);
    getDatabase.mockResolvedValue(db);
    const deleteFn = jest.fn();
    (File as jest.Mock).mockImplementation(() => ({ delete: deleteFn }));

    await updateLocalGoalImage('goal-1', 'file:///doc/new.jpg');

    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('deleteLocalGoal deletes the row, enqueues a delete carrying user_id, and cleans up local + remote images', async () => {
    const db = makeFakeDatabase([
      {
        id: 'goal-1',
        user_id: 'user-1',
        image_local_uri: 'file:///doc/goal-1.jpg',
        image_path: 'user-1/goal-1',
      },
    ]);
    getDatabase.mockResolvedValue(db);
    const deleteFn = jest.fn();
    (File as jest.Mock).mockImplementation(() => ({ delete: deleteFn }));
    const removeFn = jest.fn().mockResolvedValue({ error: null });
    (supabase.storage.from as jest.Mock).mockReturnValue({ remove: removeFn });

    await deleteLocalGoal('goal-1');

    expect(db.__runCalls).toContainEqual([expect.stringContaining('DELETE FROM goals'), ['goal-1']]);
    expect(enqueue).toHaveBeenCalledWith('goals', 'delete', 'goal-1', { user_id: 'user-1' });
    expect(deleteFn).toHaveBeenCalled();
    expect(removeFn).toHaveBeenCalledWith(['user-1/goal-1']);
  });

  it('deleteLocalGoal skips remote image cleanup when the goal never had an uploaded image', async () => {
    const db = makeFakeDatabase([
      { id: 'goal-1', user_id: 'user-1', image_local_uri: null, image_path: null },
    ]);
    getDatabase.mockResolvedValue(db);
    const removeFn = jest.fn();
    (supabase.storage.from as jest.Mock).mockReturnValue({ remove: removeFn });

    await deleteLocalGoal('goal-1');

    expect(removeFn).not.toHaveBeenCalled();
  });

  it('deleteLocalGoal enqueues a delete with no payload when the goal is already gone', async () => {
    const db = makeFakeDatabase([]);
    getDatabase.mockResolvedValue(db);

    await deleteLocalGoal('missing');

    expect(enqueue).toHaveBeenCalledWith('goals', 'delete', 'missing', undefined);
  });
});
