import { getDailyPrompt } from './journalPrompts';

describe('getDailyPrompt', () => {
  it('returns the same prompt for the same calendar day', () => {
    const morning = new Date(2026, 8, 23, 6, 0, 0);
    const night = new Date(2026, 8, 23, 23, 0, 0);
    expect(getDailyPrompt(morning)).toBe(getDailyPrompt(night));
  });

  it('returns a different prompt on a different day (not always the same one)', () => {
    const day1 = getDailyPrompt(new Date(2026, 8, 23));
    const day2 = getDailyPrompt(new Date(2026, 8, 24));
    expect(day1).not.toBe(day2);
  });

  it('cycles back to the same prompt after a full cycle of the list', () => {
    const start = new Date(2026, 0, 1);
    const first = getDailyPrompt(start);
    // Walking forward one day at a time (not jumping by a guessed list length)
    // finds the actual cycle length, so this test doesn't assume a specific
    // prompt-list size that would silently stop being checked if it changed.
    let cursor = new Date(start);
    let cycleLength = 0;
    do {
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
      cycleLength += 1;
    } while (getDailyPrompt(cursor) !== first && cycleLength < 100);
    expect(getDailyPrompt(cursor)).toBe(first);
    expect(cycleLength).toBeLessThan(100);
  });
});
