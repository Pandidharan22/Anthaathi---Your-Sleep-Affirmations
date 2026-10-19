import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

/** Snap the animated position to the player's only if they drift further apart. */
const RESYNC_MS = 200;

type PlaybackProgressOptions = {
  playing: boolean;
  /** The player's latest reported position. */
  positionMs: number;
  /** Where playback will stop (a trim end, or the end of a short preview). */
  stopMs: number;
  durationMs: number;
  /** True when the value only drives transforms; width or left need the JS driver. */
  useNativeDriver?: boolean;
};

/**
 * Playback position as an Animated.Value (0–1 of the full length), for drawing progress.
 * The player reports its position a few times a second; between reports the value
 * glides at playback speed toward `stopMs`, so progress moves every frame instead of
 * in steps (the user's phone check in R.5b).
 */
export function usePlaybackProgress({
  playing,
  positionMs,
  stopMs,
  durationMs,
  useNativeDriver = false,
}: PlaybackProgressOptions): Animated.Value {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (durationMs <= 0) return;
    const at = positionMs / durationMs;
    progress.stopAnimation((current) => {
      if (Math.abs(current - at) * durationMs > RESYNC_MS || !playing) {
        progress.setValue(at);
      }
      if (!playing) return;
      Animated.timing(progress, {
        toValue: stopMs / durationMs,
        duration: Math.max(0, stopMs - positionMs),
        easing: Easing.linear,
        useNativeDriver,
      }).start();
    });
  }, [progress, playing, positionMs, stopMs, durationMs, useNativeDriver]);
  return progress;
}
