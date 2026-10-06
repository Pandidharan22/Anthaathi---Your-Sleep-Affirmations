import type { AudioPlayer } from 'expo-audio';

import {
  CROSSFADE_MS,
  FADE_IN_MS,
  FADE_OUT_MS,
  fadeGains,
  startBedLoop,
  TICK_MS,
} from '@/lib/bedLoop';
import type { Bed } from '@/lib/beds';

// The real expo-audio can't load under Jest; the engine takes its player factory by injection.
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn() }));

const BED: Bed = { id: 'test', label: 'Test', source: 1, durationMs: 20_000 };

type FakePlayer = {
  loop: boolean;
  volume: number;
  currentTime: number;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  remove: jest.Mock;
  playing: boolean;
};

function makeFakePlayer(): FakePlayer {
  const p: FakePlayer = {
    loop: true,
    volume: 1,
    currentTime: 0,
    playing: false,
    play: jest.fn(() => {
      p.playing = true;
    }),
    pause: jest.fn(() => {
      p.playing = false;
    }),
    seekTo: jest.fn((seconds: number) => {
      p.currentTime = seconds;
    }),
    remove: jest.fn(),
  };
  return p;
}

let players: FakePlayer[];

function start(balance = 0.5) {
  players = [];
  const loop = startBedLoop(BED, balance, () => {
    const p = makeFakePlayer();
    players.push(p);
    return p as unknown as AudioPlayer;
  });
  return loop;
}

/** Advances wall-clock time; any playing fake player's clock advances with it. */
function advance(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
    for (const p of players) if (p.playing) p.currentTime += TICK_MS / 1000;
    jest.advanceTimersByTime(TICK_MS);
  }
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('fadeGains', () => {
  it('runs from silent to full and keeps constant power', () => {
    expect(fadeGains(0)).toEqual({ in: 0, out: 1 });
    const end = fadeGains(1);
    expect(end.in).toBeCloseTo(1);
    expect(end.out).toBeCloseTo(0);
    const mid = fadeGains(0.37);
    expect(mid.in ** 2 + mid.out ** 2).toBeCloseTo(1);
  });

  it('clamps out-of-range progress', () => {
    expect(fadeGains(-1).in).toBe(0);
    expect(fadeGains(2).in).toBeCloseTo(1);
  });
});

describe('startBedLoop', () => {
  it('starts one silent non-looping player and fades in to the balance', () => {
    start(0.5);
    expect(players).toHaveLength(2);
    expect(players.every((p) => p.loop === false)).toBe(true);
    expect(players[0].play).toHaveBeenCalled();
    expect(players[1].play).not.toHaveBeenCalled();
    expect(players[0].volume).toBe(0);

    advance(FADE_IN_MS);
    expect(players[0].volume).toBeCloseTo(0.5);
  });

  it('crossfades into the second player before the first one ends, then swaps roles', () => {
    start(1);
    advance(BED.durationMs - CROSSFADE_MS - 2 * TICK_MS);
    expect(players[1].play).not.toHaveBeenCalled();

    advance(3 * TICK_MS);
    expect(players[1].play).toHaveBeenCalledTimes(1);
    expect(players[1].seekTo).toHaveBeenCalledWith(0);

    advance(CROSSFADE_MS / 2);
    // Mid-crossfade both are audible and the incoming one is rising.
    expect(players[0].volume).toBeGreaterThan(0);
    expect(players[1].volume).toBeGreaterThan(0);

    advance(CROSSFADE_MS);
    expect(players[0].pause).toHaveBeenCalled();
    expect(players[0].volume).toBe(0);
    expect(players[1].volume).toBeCloseTo(1);

    // The second player is now the active one and hands back to the first.
    advance(BED.durationMs - CROSSFADE_MS);
    expect(players[0].play).toHaveBeenCalledTimes(2);
  });

  it('keeps looping across many cycles without ever going silent', () => {
    start(1);
    // Sample the summed gain through ~4 loop cycles: it must never dip towards silence.
    advance(FADE_IN_MS);
    let minTotal = Infinity;
    for (let t = 0; t < BED.durationMs * 4; t += TICK_MS) {
      advance(TICK_MS);
      minTotal = Math.min(minTotal, players[0].volume + players[1].volume);
    }
    // Equal-power crossfade dips to ~0.707 summed amplitude at the midpoint at worst.
    expect(minTotal).toBeGreaterThan(0.7);
  });

  it('applies balance changes immediately', () => {
    const loop = start(0.2);
    advance(FADE_IN_MS);
    loop.setBalance(0.8);
    expect(players[0].volume).toBeCloseTo(0.8);
    loop.setBalance(5);
    expect(players[0].volume).toBeCloseTo(1);
  });

  it('pauses and resumes both layers, holding a fade in place', () => {
    const loop = start(1);
    advance(FADE_IN_MS / 2);
    loop.pause();
    const volumeAtPause = players[0].volume;
    expect(players[0].pause).toHaveBeenCalled();

    advance(60_000);
    expect(players[0].volume).toBe(volumeAtPause);

    loop.resume();
    expect(players[0].playing).toBe(true);
    advance(FADE_IN_MS);
    expect(players[0].volume).toBeCloseTo(1);
  });

  it('resumes both players when paused mid-crossfade', () => {
    const loop = start(1);
    advance(BED.durationMs - CROSSFADE_MS + CROSSFADE_MS / 2);
    expect(players[1].playing).toBe(true);
    loop.pause();
    expect(players[0].playing).toBe(false);
    expect(players[1].playing).toBe(false);
    loop.resume();
    expect(players[0].playing).toBe(true);
    expect(players[1].playing).toBe(true);
  });

  it('fades out and releases both players on stop', () => {
    const loop = start(1);
    advance(FADE_IN_MS);
    loop.stop();
    advance(FADE_OUT_MS / 2);
    expect(players[0].volume).toBeGreaterThan(0);
    expect(players[0].volume).toBeLessThan(1);
    expect(players[0].remove).not.toHaveBeenCalled();

    advance(FADE_OUT_MS);
    for (const p of players) {
      expect(p.pause).toHaveBeenCalled();
      expect(p.remove).toHaveBeenCalledTimes(1);
    }
    // The tick loop is gone: no further volume writes.
    const volume = players[0].volume;
    advance(5000);
    expect(players[0].volume).toBe(volume);
  });

  it('stops cleanly in the middle of a crossfade, silencing both players', () => {
    const loop = start(1);
    advance(BED.durationMs - CROSSFADE_MS + CROSSFADE_MS / 2);
    loop.stop();
    advance(FADE_OUT_MS + 2 * TICK_MS);
    for (const p of players) {
      expect(p.remove).toHaveBeenCalledTimes(1);
      expect(p.playing).toBe(false);
    }
  });

  it('releases immediately when stopped while paused', () => {
    const loop = start(1);
    advance(FADE_IN_MS);
    loop.pause();
    loop.stop();
    for (const p of players) expect(p.remove).toHaveBeenCalledTimes(1);
  });

  it('is safe to stop twice', () => {
    const loop = start(1);
    loop.stop();
    loop.stop();
    advance(FADE_OUT_MS * 2);
    for (const p of players) expect(p.remove).toHaveBeenCalledTimes(1);
  });
});
