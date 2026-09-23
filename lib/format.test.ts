import type { LocalAffirmation } from './affirmations.local';
import { formatDate, formatDuration, getEffectiveDurationMs } from './format';

function makeAffirmation(overrides: Partial<LocalAffirmation> = {}): LocalAffirmation {
  return {
    id: 'aff-1',
    user_id: 'user-1',
    folder_id: null,
    title: 'Recording',
    local_uri: 'file:///rec.m4a',
    storage_path: null,
    duration_ms: 10000,
    source: 'recorded',
    voice_id: null,
    script_text: null,
    trim_start_ms: null,
    trim_end_ms: null,
    created_at: '',
    updated_at: '',
    synced_at: null,
    ...overrides,
  };
}

describe('formatDuration', () => {
  it('formats whole minutes and seconds as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5000)).toBe('0:05');
    expect(formatDuration(65000)).toBe('1:05');
    expect(formatDuration(600000)).toBe('10:00');
  });

  it('floors partial seconds', () => {
    expect(formatDuration(5999)).toBe('0:05');
  });

  it('clamps negative input to 0:00 instead of rendering a broken string', () => {
    expect(formatDuration(-1000)).toBe('0:00');
  });
});

describe('getEffectiveDurationMs', () => {
  it('returns the full duration when untrimmed', () => {
    const affirmation = makeAffirmation({ duration_ms: 10000, trim_start_ms: null, trim_end_ms: null });
    expect(getEffectiveDurationMs(affirmation)).toBe(10000);
  });

  it('returns the trimmed span, not the original duration, when trimmed', () => {
    const affirmation = makeAffirmation({ duration_ms: 10000, trim_start_ms: 2000, trim_end_ms: 5000 });
    expect(getEffectiveDurationMs(affirmation)).toBe(3000);
  });
});

describe('formatDate', () => {
  it('formats an ISO timestamp as a short local date', () => {
    // Constructed from local components (not a fixed UTC literal) so this
    // holds regardless of the machine's timezone running the test.
    const localNoon = new Date(2026, 8, 23, 12, 0, 0);
    expect(formatDate(localNoon.toISOString())).toBe('Sep 23, 2026');
  });
});
