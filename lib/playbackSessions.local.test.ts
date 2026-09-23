import { listLocalPlaybackSessions, logLocalPlaybackSession } from './playbackSessions.local';

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

describe('playbackSessions.local', () => {
  it('logLocalPlaybackSession writes the row locally and enqueues an upsert', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    const session = await logLocalPlaybackSession('user-1', '2026-09-23T22:00:00.000Z', 1800000);

    expect(session).toEqual({
      id: 'fixed-uuid',
      user_id: 'user-1',
      played_at: '2026-09-23T22:00:00.000Z',
      duration_ms: 1800000,
      synced_at: null,
    });
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO playback_sessions'),
      ['fixed-uuid', 'user-1', '2026-09-23T22:00:00.000Z', 1800000, null],
    );
    expect(enqueue).toHaveBeenCalledWith('playback_sessions', 'upsert', 'fixed-uuid', {
      id: 'fixed-uuid',
      user_id: 'user-1',
      played_at: '2026-09-23T22:00:00.000Z',
      duration_ms: 1800000,
    });
  });

  it('listLocalPlaybackSessions queries by user_id', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    await listLocalPlaybackSessions('user-1');

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = ?'), ['user-1']);
  });
});
