import { bucketLevels, findSilenceTrim, levelFromDb } from './waveform';

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

describe('findSilenceTrim', () => {
  // 10 levels over 1000 ms: 100 ms each.
  const quiet = 0.05;
  const loud = 0.6;

  it('cuts the quiet start and end, keeping 300 ms around the speech', () => {
    // 20 levels over 2000 ms: quiet 0–1000, speech 1000–1200, quiet to the end.
    const levels = [...Array(10).fill(quiet), loud, loud, ...Array(8).fill(quiet)];
    expect(findSilenceTrim(levels, 2000)).toEqual({ startMs: 700, endMs: 1500 });
  });

  it('spreads levels over the real duration', () => {
    const levels = [quiet, quiet, quiet, quiet, quiet, quiet, quiet, quiet, loud, quiet];
    // 10 levels over 2000 ms: speech at 1600–1800 → 1300–2000
    expect(findSilenceTrim(levels, 2000)).toEqual({ startMs: 1300, endMs: 2000 });
  });

  it('finds the speech over a noisy room, judging quiet against the take itself', () => {
    // Background hum at 0.3 (above a fixed threshold), voice at 0.8.
    const hum = 0.3;
    const voice = 0.8;
    const levels = [...Array(10).fill(hum), voice, voice, ...Array(8).fill(hum)];
    expect(findSilenceTrim(levels, 2000)).toEqual({ startMs: 700, endMs: 1500 });
  });

  it('returns null when the take is all one level', () => {
    expect(findSilenceTrim(Array(20).fill(0.5), 2000)).toBeNull();
  });

  it('returns null when there is too little quiet to bother', () => {
    expect(findSilenceTrim([quiet, loud, loud, loud, quiet], 500)).toBeNull();
  });

  it('returns null with no speech or no waveform', () => {
    expect(findSilenceTrim([quiet, quiet, quiet], 3000)).toBeNull();
    expect(findSilenceTrim([], 3000)).toBeNull();
  });
});
