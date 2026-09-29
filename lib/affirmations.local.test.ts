import {
  createAiGuidedAffirmation,
  createLocalAffirmation,
  deleteLocalAffirmation,
  getLocalAffirmation,
  listLocalAffirmations,
  updateAiGuidedAffirmationScript,
  updateLocalAffirmationFolder,
  updateLocalAffirmationTitle,
  updateLocalAffirmationTrim,
} from './affirmations.local';

const mockFileDelete = jest.fn();
const mockSynthesizeAffirmationAudio = jest.fn();

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'fixed-uuid') }));
jest.mock('@/lib/db', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/syncQueue', () => ({ enqueue: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/aiVoice', () => ({
  synthesizeAffirmationAudio: (...args: unknown[]) => mockSynthesizeAffirmationAudio(...args),
}));
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ delete: mockFileDelete })),
}));

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
  // clearAllMocks (not resetAllMocks): resetAllMocks would also wipe the
  // File mock's mockImplementation set up in the jest.mock factory above.
  jest.clearAllMocks();
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

  it('updateLocalAffirmationTitle updates the title and enqueues a partial update', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    await updateLocalAffirmationTitle('aff-1', 'New title');

    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('UPDATE affirmations SET title'), [
      'New title',
      expect.any(String),
      'aff-1',
    ]);
    expect(enqueue).toHaveBeenCalledWith('affirmations', 'update', 'aff-1', { title: 'New title' });
  });

  it('updateLocalAffirmationFolder updates folder_id and enqueues a partial update', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    await updateLocalAffirmationFolder('aff-1', 'folder-2');

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE affirmations SET folder_id'),
      ['folder-2', expect.any(String), 'aff-1'],
    );
    expect(enqueue).toHaveBeenCalledWith('affirmations', 'update', 'aff-1', { folder_id: 'folder-2' });
  });

  it('updateLocalAffirmationFolder can un-file (folderId: null)', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);

    await updateLocalAffirmationFolder('aff-1', null);

    expect(enqueue).toHaveBeenCalledWith('affirmations', 'update', 'aff-1', { folder_id: null });
  });

  it('deleteLocalAffirmation deletes the row, enqueues a delete carrying user_id, and removes the audio file', async () => {
    const db = makeFakeDatabase([
      { id: 'aff-1', user_id: 'user-1', local_uri: 'file:///doc/rec.m4a' },
    ]);
    getDatabase.mockResolvedValue(db);

    await deleteLocalAffirmation('aff-1');

    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM affirmations'), [
      'aff-1',
    ]);
    expect(enqueue).toHaveBeenCalledWith('affirmations', 'delete', 'aff-1', { user_id: 'user-1' });
    expect(mockFileDelete).toHaveBeenCalled();
  });

  it('deleteLocalAffirmation enqueues a delete with no payload when the row is already gone', async () => {
    const db = makeFakeDatabase([]);
    getDatabase.mockResolvedValue(db);

    await deleteLocalAffirmation('missing');

    expect(enqueue).toHaveBeenCalledWith('affirmations', 'delete', 'missing', undefined);
    expect(mockFileDelete).not.toHaveBeenCalled();
  });

  it('createAiGuidedAffirmation synthesizes audio and saves it as source: ai_generated', async () => {
    const db = makeFakeDatabase();
    getDatabase.mockResolvedValue(db);
    mockSynthesizeAffirmationAudio.mockResolvedValue({
      localUri: 'file:///doc/ai-affirmation-fixed-uuid.wav',
      durationMs: 4200,
    });

    const affirmation = await createAiGuidedAffirmation({
      userId: 'user-1',
      title: 'Morning calm',
      scriptText: 'I am calm and capable.',
      voiceId: 'en-gb-x-gbd-local',
    });

    expect(mockSynthesizeAffirmationAudio).toHaveBeenCalledWith(
      'I am calm and capable.',
      'en-gb-x-gbd-local',
    );
    expect(affirmation).toMatchObject({
      source: 'ai_generated',
      local_uri: 'file:///doc/ai-affirmation-fixed-uuid.wav',
      duration_ms: 4200,
      voice_id: 'en-gb-x-gbd-local',
      script_text: 'I am calm and capable.',
    });
  });

  it('updateAiGuidedAffirmationScript re-synthesizes and resets trim when the script changed', async () => {
    const db = makeFakeDatabase([
      {
        id: 'aff-1',
        local_uri: 'file:///doc/old.wav',
        script_text: 'Old script.',
        voice_id: 'en-gb-x-gbd-local',
        trim_start_ms: 500,
        trim_end_ms: 3000,
      },
    ]);
    getDatabase.mockResolvedValue(db);
    mockSynthesizeAffirmationAudio.mockResolvedValue({
      localUri: 'file:///doc/ai-affirmation-fixed-uuid.wav',
      durationMs: 5000,
    });

    const result = await updateAiGuidedAffirmationScript('aff-1', {
      scriptText: 'New script.',
      voiceId: 'en-gb-x-gbd-local',
    });

    expect(mockSynthesizeAffirmationAudio).toHaveBeenCalledWith('New script.', 'en-gb-x-gbd-local');
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE affirmations'),
      [
        'file:///doc/ai-affirmation-fixed-uuid.wav',
        5000,
        'en-gb-x-gbd-local',
        'New script.',
        expect.any(String),
        'aff-1',
      ],
    );
    expect(enqueue).toHaveBeenCalledWith('affirmations', 'update', 'aff-1', {
      local_uri: 'file:///doc/ai-affirmation-fixed-uuid.wav',
      duration_ms: 5000,
      voice_id: 'en-gb-x-gbd-local',
      script_text: 'New script.',
      trim_start_ms: null,
      trim_end_ms: null,
    });
    // The old file is only removed after the new one is safely recorded.
    expect(mockFileDelete).toHaveBeenCalled();
    expect(result).toMatchObject({
      local_uri: 'file:///doc/ai-affirmation-fixed-uuid.wav',
      duration_ms: 5000,
      trim_start_ms: null,
      trim_end_ms: null,
    });
  });

  it('updateAiGuidedAffirmationScript re-synthesizes when only the voice changed, script unchanged', async () => {
    const db = makeFakeDatabase([
      { id: 'aff-1', local_uri: 'file:///doc/old.wav', script_text: 'Same script.', voice_id: 'voice-a' },
    ]);
    getDatabase.mockResolvedValue(db);
    mockSynthesizeAffirmationAudio.mockResolvedValue({
      localUri: 'file:///doc/ai-affirmation-fixed-uuid.wav',
      durationMs: 3000,
    });

    await updateAiGuidedAffirmationScript('aff-1', { scriptText: 'Same script.', voiceId: 'voice-b' });

    expect(mockSynthesizeAffirmationAudio).toHaveBeenCalledWith('Same script.', 'voice-b');
  });

  it('updateAiGuidedAffirmationScript is a no-op (FR-514 cache reuse) when neither script nor voice changed', async () => {
    const existing = {
      id: 'aff-1',
      local_uri: 'file:///doc/old.wav',
      script_text: 'Same script.',
      voice_id: 'voice-a',
    };
    const db = makeFakeDatabase([existing]);
    getDatabase.mockResolvedValue(db);

    const result = await updateAiGuidedAffirmationScript('aff-1', {
      scriptText: 'Same script.',
      voiceId: 'voice-a',
    });

    expect(mockSynthesizeAffirmationAudio).not.toHaveBeenCalled();
    expect(db.runAsync).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(mockFileDelete).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it('updateAiGuidedAffirmationScript throws for a missing affirmation, without calling synthesis', async () => {
    const db = makeFakeDatabase([]);
    getDatabase.mockResolvedValue(db);

    await expect(
      updateAiGuidedAffirmationScript('missing', { scriptText: 'x', voiceId: 'voice-a' }),
    ).rejects.toThrow('missing');
    expect(mockSynthesizeAffirmationAudio).not.toHaveBeenCalled();
  });
});
