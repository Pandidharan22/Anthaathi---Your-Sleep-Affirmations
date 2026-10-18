import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { LocalAffirmation } from '@/lib/affirmations.local';

/**
 * One shared player for the quick previews on a list of recordings (Folder Detail's
 * play buttons). Plays a recording's trimmed range, so the preview matches what the
 * Player plays at night; tapping the same recording again stops it, and tapping
 * another switches to it. `stop` is for leaving the screen.
 */
export function usePreviewPlayer() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const endSecRef = useRef<number | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const stop = useCallback(() => {
    playerRef.current?.pause();
    endSecRef.current = null;
    setPlayingId(null);
  }, []);

  useEffect(() => {
    const player = createAudioPlayer();
    playerRef.current = player;
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      const end = endSecRef.current;
      const reachedTrimEnd = end !== null && status.currentTime >= end;
      if (status.didJustFinish || reachedTrimEnd) {
        player.pause();
        endSecRef.current = null;
        setPlayingId(null);
      }
    });
    return () => {
      subscription.remove();
      player.remove();
      playerRef.current = null;
    };
  }, []);

  const toggle = useCallback(
    (affirmation: LocalAffirmation) => {
      const player = playerRef.current;
      if (!player) return;
      if (playingId === affirmation.id) {
        stop();
        return;
      }
      player.pause();
      player.replace({ uri: affirmation.local_uri });
      const startSec = (affirmation.trim_start_ms ?? 0) / 1000;
      endSecRef.current = affirmation.trim_end_ms !== null ? affirmation.trim_end_ms / 1000 : null;
      player.seekTo(startSec);
      player.play();
      setPlayingId(affirmation.id);
    },
    [playingId, stop],
  );

  return { playingId, toggle, stop };
}
