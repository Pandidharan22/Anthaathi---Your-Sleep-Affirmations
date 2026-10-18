import type { LocalAffirmation } from '@/lib/affirmations.local';

import { describeFolderStats, summarizeByFolder } from './folderStats';

function affirmation(overrides: Partial<LocalAffirmation>): LocalAffirmation {
  return {
    id: 'a',
    user_id: 'u',
    folder_id: null,
    title: 't',
    local_uri: 'file:///a.m4a',
    storage_path: null,
    duration_ms: 30000,
    trim_start_ms: null,
    trim_end_ms: null,
    source: 'recorded',
    voice_id: null,
    script_text: null,
    created_at: '2026-10-18T00:00:00Z',
    updated_at: '2026-10-18T00:00:00Z',
    synced_at: null,
    ...overrides,
  };
}

describe('summarizeByFolder', () => {
  it('counts recordings and sums playable length per folder, unfiled under null', () => {
    const stats = summarizeByFolder([
      affirmation({ id: '1', folder_id: 'f1', duration_ms: 32000 }),
      affirmation({
        id: '2',
        folder_id: 'f1',
        duration_ms: 60000,
        trim_start_ms: 10000,
        trim_end_ms: 40000,
      }),
      affirmation({ id: '3', folder_id: null, duration_ms: 5000 }),
    ]);

    expect(stats.get('f1')).toEqual({ count: 2, totalMs: 62000 });
    expect(stats.get(null)).toEqual({ count: 1, totalMs: 5000 });
  });
});

describe('describeFolderStats', () => {
  it.each([
    [undefined, 'No recordings yet'],
    [{ count: 1, totalMs: 32000 }, '1 recording · 32s'],
    [{ count: 12, totalMs: 384000 }, '12 recordings · 6m 24s'],
  ])('%j → %s', (stats, expected) => {
    expect(describeFolderStats(stats)).toBe(expected);
  });
});
