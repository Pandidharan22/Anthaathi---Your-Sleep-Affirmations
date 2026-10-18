import type { LocalAffirmation } from './affirmations.local';
import {
  formatDate,
  formatDuration,
  formatLength,
  formatNightsAgo,
  getEffectiveDurationMs,
} from './format';

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
    const affirmation = makeAffirmation({
      duration_ms: 10000,
      trim_start_ms: null,
      trim_end_ms: null,
    });
    expect(getEffectiveDurationMs(affirmation)).toBe(10000);
  });

  it('returns the trimmed span, not the original duration, when trimmed', () => {
    const affirmation = makeAffirmation({
      duration_ms: 10000,
      trim_start_ms: 2000,
      trim_end_ms: 5000,
    });
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

describe('formatLength', () => {
  it.each([
    [0, '0s'],
    [32000, '32s'],
    [59400, '59s'],
    [60000, '1m 00s'],
    [384000, '6m 24s'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatLength(ms)).toBe(expected);
  });
});

describe('formatNightsAgo', () => {
  const now = new Date(2026, 9, 18, 1, 0);
  const daysBefore = (days: number, hour = 22) =>
    new Date(2026, 9, 18 - days, hour, 0).toISOString();

  it.each([
    [0, 'Today'],
    [1, 'Last night'],
    [2, '2 nights ago'],
    [6, '6 nights ago'],
    [7, 'Last week'],
    [13, 'Last week'],
    [14, '2 weeks ago'],
    [59, '8 weeks ago'],
  ])('%i days before → %s', (days, expected) => {
    expect(formatNightsAgo(daysBefore(days), now)).toBe(expected);
  });

  it('counts calendar days, so 11 pm yesterday is "Last night" at 1 am', () => {
    expect(formatNightsAgo(daysBefore(1, 23), now)).toBe('Last night');
  });

  it('falls back to the date after about two months', () => {
    expect(formatNightsAgo(daysBefore(90), now)).toMatch(/2026/);
  });
});
