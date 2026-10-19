import {
  bucketLevels,
  describeTrim,
  findSilenceTrim,
  levelFromDb,
  moveTrimHandle,
  normalizeTrim,
} from './waveform';

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

describe('moveTrimHandle', () => {
  const full = { startMs: 0, endMs: 10000 };

  it('snaps to 100 ms steps', () => {
    expect(moveTrimHandle(full, 'start', 1234, 10000)).toEqual({ startMs: 1200, endMs: 10000 });
    expect(moveTrimHandle(full, 'end', 8760, 10000)).toEqual({ startMs: 0, endMs: 8800 });
  });

  it('stays inside the recording', () => {
    expect(moveTrimHandle(full, 'start', -500, 10000).startMs).toBe(0);
    expect(moveTrimHandle(full, 'end', 12000, 10000).endMs).toBe(10000);
  });

  it('snaps to the real end, which is rarely a whole step', () => {
    expect(moveTrimHandle({ startMs: 0, endMs: 3000 }, 'end', 4210, 4237).endMs).toBe(4237);
  });

  it('keeps at least a second between the handles', () => {
    const range = { startMs: 2000, endMs: 5000 };
    expect(moveTrimHandle(range, 'start', 4800, 10000).startMs).toBe(4000);
    expect(moveTrimHandle(range, 'end', 2100, 10000).endMs).toBe(3000);
  });

  it('allows a recording shorter than a second to be kept whole', () => {
    expect(moveTrimHandle({ startMs: 0, endMs: 600 }, 'start', 300, 600).startMs).toBe(0);
  });
});

describe('normalizeTrim', () => {
  it('is null when the whole recording is kept', () => {
    expect(normalizeTrim({ startMs: 0, endMs: 5000 }, 5000)).toBeNull();
    expect(normalizeTrim({ startMs: 100, endMs: 5000 }, 5000)).toEqual({
      startMs: 100,
      endMs: 5000,
    });
  });
});

describe('describeTrim', () => {
  it('describes Trim silence', () => {
    expect(describeTrim({ startMs: 700, endMs: 1500 }, 2000, 'silence')).toBe(
      'Trims 0.7 s of quiet at the start and 0.5 s at the end.',
    );
    expect(describeTrim({ startMs: 700, endMs: 2000 }, 2000, 'silence')).toBe(
      'Trims 0.7 s of quiet at the start.',
    );
  });

  it('describes a trim set by hand', () => {
    expect(describeTrim({ startMs: 4000, endMs: 44000 }, 48000, 'manual')).toBe(
      'Cuts 4.0 s from the start and 4.0 s from the end.',
    );
    expect(describeTrim({ startMs: 0, endMs: 44000 }, 48000, 'manual')).toBe(
      'Cuts 4.0 s from the end.',
    );
  });

  it('suggests dragging when nothing is cut', () => {
    expect(describeTrim(null, 48000, 'manual')).toBe('Drag the handles to cut the start or end.');
  });
});
