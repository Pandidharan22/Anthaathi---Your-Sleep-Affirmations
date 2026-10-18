import { bucketLevels, levelFromDb } from './waveform';

describe('levelFromDb', () => {
  it.each([
    [0, 1],
    [-25, 0.5],
    [-50, 0],
    [-160, 0],
    [undefined, 0],
    [Number.NEGATIVE_INFINITY, 0],
  ])('%s dBFS → %s', (db, expected) => {
    expect(levelFromDb(db)).toBeCloseTo(expected);
  });
});

describe('bucketLevels', () => {
  it('keeps the loudest level in each slice', () => {
    expect(bucketLevels([0.1, 0.9, 0.2, 0.3, 0.8, 0.1], 3)).toEqual([0.9, 0.3, 0.8]);
  });

  it('spreads fewer levels across more bars instead of padding', () => {
    expect(bucketLevels([0.2, 0.6], 4)).toEqual([0.2, 0.2, 0.6, 0.6]);
  });

  it('returns nothing to draw for an empty waveform', () => {
    expect(bucketLevels([], 10)).toEqual([]);
  });
});
