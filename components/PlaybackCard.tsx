import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Waveform } from '@/components/Waveform';
import { Card } from '@/components/ui/Card';
import { GlowButton } from '@/components/ui/GlowButton';
import { IconButton } from '@/components/ui/IconButton';
import { colors, typography } from '@/constants/theme';
import { formatDuration } from '@/lib/format';

const SKIP_MS = 5000;
/** Snap the animated position to the player's only if they drift further apart. */
const RESYNC_MS = 200;

type PlaybackCardProps = {
  uri: string;
  durationMs: number;
  levels: number[] | null;
  /** The part that plays; null means the whole recording. */
  trimStartMs: number | null;
  trimEndMs: number | null;
};

/**
 * The Preview mockup's waveform card: "0:12 / 0:48", the waveform with progress, and
 * back 5 s / play-pause / forward 5 s. Plays only the trimmed part, so what you hear is
 * what the Player will play. Shared by Preview (R.5b) and the recording edit screen.
 */
export function PlaybackCard({
  uri,
  durationMs,
  levels,
  trimStartMs,
  trimEndMs,
}: PlaybackCardProps) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const startMs = trimStartMs ?? 0;
  const endMs = trimEndMs ?? durationMs;
  const positionMs = Math.min(Math.max(status.currentTime * 1000, startMs), endMs);

  // The waveform's played part as an Animated.Value (0–1 of the full length). The player
  // reports its position a few times a second; between reports the value glides at
  // playback speed, so progress moves every frame instead of in steps.
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (durationMs <= 0) return;
    const at = positionMs / durationMs;
    progress.stopAnimation((current) => {
      if (Math.abs(current - at) * durationMs > RESYNC_MS || !status.playing) {
        progress.setValue(at);
      }
      if (!status.playing) return;
      Animated.timing(progress, {
        toValue: endMs / durationMs,
        duration: Math.max(0, endMs - positionMs),
        easing: Easing.linear,
        // Width can't use the native driver; a single clip view is cheap on the JS side.
        useNativeDriver: false,
      }).start();
    });
  }, [progress, status.playing, positionMs, endMs, durationMs]);

  // Stop at the trim end; the next Play starts again from the trim start.
  useEffect(() => {
    if (status.playing && status.currentTime * 1000 >= endMs) player.pause();
  }, [status.playing, status.currentTime, endMs, player]);

  function handleTogglePlay() {
    if (status.playing) {
      player.pause();
      return;
    }
    const atMs = status.currentTime * 1000;
    if (atMs < startMs || atMs >= endMs - 50) player.seekTo(startMs / 1000);
    player.play();
  }

  function skip(deltaMs: number) {
    const target = Math.min(Math.max(positionMs + deltaMs, startMs), endMs);
    player.seekTo(target / 1000);
  }

  const lengthMs = Math.max(0, endMs - startMs);
  const elapsedMs = positionMs - startMs;

  return (
    <Card mesh style={styles.card}>
      <Text
        style={styles.time}
        accessibilityLabel={`${formatDuration(elapsedMs)} of ${formatDuration(lengthMs)}`}
      >
        {formatDuration(elapsedMs)} / {formatDuration(lengthMs)}
      </Text>
      <Waveform
        levels={levels}
        progress={progress}
        keepFrom={durationMs > 0 ? startMs / durationMs : 0}
        keepTo={durationMs > 0 ? endMs / durationMs : 1}
      />
      <View style={styles.transport}>
        <IconButton
          icon="rewind"
          accessibilityLabel="Back 5 seconds"
          onPress={() => skip(-SKIP_MS)}
        />
        <GlowButton
          icon={status.playing ? 'pause' : 'play'}
          iconFilled
          size={64}
          accessibilityLabel={status.playing ? 'Pause' : 'Play'}
          onPress={handleTogglePlay}
        />
        <IconButton
          icon="forward"
          accessibilityLabel="Forward 5 seconds"
          onPress={() => skip(SKIP_MS)}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 22,
    gap: 14,
  },
  time: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 4,
  },
});
