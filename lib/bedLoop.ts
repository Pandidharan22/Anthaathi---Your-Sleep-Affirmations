import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import type { Bed } from '@/lib/beds';

// Plays a bed as an endless loop by alternating two players and crossfading between them,
// instead of `player.loop`: MP3 start/end padding makes a single player's restart an audible
// gap, which is very noticeable in a quiet bed like rain.

export const CROSSFADE_MS = 4000;
export const FADE_IN_MS = 3000;
export const FADE_OUT_MS = 2000;
export const TICK_MS = 100;

/** Equal-power gains for a fade progress `p` (0..1): `in` rises, `out` falls. */
export function fadeGains(p: number): { in: number; out: number } {
  const clamped = Math.min(1, Math.max(0, p));
  return { in: Math.sin((clamped * Math.PI) / 2), out: Math.cos((clamped * Math.PI) / 2) };
}

export type BedLoop = {
  pause(): void;
  resume(): void;
  /** Applies instantly. `balance` is 0..1, the bed's volume relative to the affirmation. */
  setBalance(balance: number): void;
  /** Fades out, then releases both players. Safe to call more than once. */
  stop(): void;
};

type Phase = 'fadeIn' | 'steady' | 'crossfade' | 'fadeOut';

export function startBedLoop(
  bed: Bed,
  balance: number,
  createPlayer: (source: number) => AudioPlayer = createAudioPlayer,
): BedLoop {
  const players = [createPlayer(bed.source), createPlayer(bed.source)];
  for (const player of players) {
    player.loop = false;
    player.volume = 0;
  }

  let level = balance;
  let active = 0;
  let phase: Phase = 'fadeIn';
  let paused = false;
  let finished = false;
  const gains = [0, 0];
  let fadeOutFrom = [0, 0];

  // Ramps are measured on a clock that stops while paused, so pausing mid-fade resumes the
  // fade where it left off instead of jumping ahead.
  let virtualNow = 0;
  let lastReal = Date.now();
  let phaseStart = 0;

  function applyVolumes() {
    players[0].volume = level * gains[0];
    players[1].volume = level * gains[1];
  }

  function release() {
    finished = true;
    clearInterval(interval);
    for (const player of players) {
      player.pause();
      player.remove();
    }
  }

  function enter(next: Phase) {
    phase = next;
    phaseStart = virtualNow;
  }

  function tick() {
    const real = Date.now();
    if (!paused) virtualNow += real - lastReal;
    lastReal = real;
    if (paused || finished) return;

    const elapsed = virtualNow - phaseStart;
    const incoming = 1 - active;

    if (phase === 'fadeIn') {
      const p = elapsed / FADE_IN_MS;
      gains[active] = fadeGains(p).in;
      if (p >= 1) enter('steady');
    } else if (phase === 'steady') {
      if (players[active].currentTime * 1000 >= bed.durationMs - CROSSFADE_MS) {
        gains[incoming] = 0;
        applyVolumes();
        players[incoming].seekTo(0);
        players[incoming].play();
        enter('crossfade');
      }
    } else if (phase === 'crossfade') {
      const p = elapsed / CROSSFADE_MS;
      const g = fadeGains(p);
      gains[active] = g.out;
      gains[incoming] = g.in;
      if (p >= 1) {
        gains[active] = 0;
        players[active].pause();
        players[active].seekTo(0);
        active = incoming;
        enter('steady');
      }
    } else {
      const p = elapsed / FADE_OUT_MS;
      const g = fadeGains(p).out;
      gains[0] = fadeOutFrom[0] * g;
      gains[1] = fadeOutFrom[1] * g;
      if (p >= 1) {
        release();
        return;
      }
    }
    applyVolumes();
  }

  const interval = setInterval(tick, TICK_MS);
  players[active].play();

  return {
    pause() {
      if (finished || paused) return;
      paused = true;
      for (const player of players) player.pause();
    },
    resume() {
      if (finished || !paused) return;
      paused = false;
      lastReal = Date.now();
      players[active].play();
      // Mid-crossfade the other player was playing too (it holds a non-zero gain).
      if (phase === 'crossfade') players[1 - active].play();
    },
    setBalance(next) {
      level = Math.min(1, Math.max(0, next));
      applyVolumes();
    },
    stop() {
      if (finished || phase === 'fadeOut') return;
      // Nothing is audible while paused, so there's nothing to fade.
      if (paused) {
        release();
        return;
      }
      fadeOutFrom = [gains[0], gains[1]];
      enter('fadeOut');
    },
  };
}
