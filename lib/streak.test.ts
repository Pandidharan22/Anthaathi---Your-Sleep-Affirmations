import { computeStreak, getStreakEmoji } from './streak';

function isoAt(daysAgo: number, hour = 22): string {
  const date = new Date(2026, 8, 23, hour, 0, 0); // 2026-09-23 local
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

const NOW = new Date(2026, 8, 23, 9, 0, 0); // 2026-09-23 09:00 local — "today" for these tests

describe('computeStreak', () => {
  it('returns 0 when there are no sessions', () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it('counts today alone as a 1-day streak', () => {
    expect(computeStreak([isoAt(0)], NOW)).toBe(1);
  });

  it('counts consecutive days ending today', () => {
    expect(computeStreak([isoAt(0), isoAt(1), isoAt(2)], NOW)).toBe(3);
  });

  it('stays alive on yesterday alone — not reset just because today has no session yet', () => {
    expect(computeStreak([isoAt(1), isoAt(2), isoAt(3)], NOW)).toBe(3);
  });

  it('resets to 0 once a full day has been skipped (gap before yesterday)', () => {
    expect(computeStreak([isoAt(2), isoAt(3)], NOW)).toBe(0);
  });

  it('stops counting at a gap in the middle of the run', () => {
    expect(computeStreak([isoAt(0), isoAt(1), isoAt(3), isoAt(4)], NOW)).toBe(2);
  });

  it('collapses multiple sessions on the same day into one streak day', () => {
    expect(computeStreak([isoAt(0, 20), isoAt(0, 23), isoAt(1, 21)], NOW)).toBe(2);
  });
});

describe('getStreakEmoji', () => {
  it('returns the seedling for a short or no streak', () => {
    expect(getStreakEmoji(0)).toBe('🌱');
    expect(getStreakEmoji(2)).toBe('🌱');
  });

  it('returns the sprout for a mid-length streak', () => {
    expect(getStreakEmoji(3)).toBe('🌿');
    expect(getStreakEmoji(6)).toBe('🌿');
  });

  it('returns the tree for a week or longer', () => {
    expect(getStreakEmoji(7)).toBe('🌳');
    expect(getStreakEmoji(30)).toBe('🌳');
  });
});
