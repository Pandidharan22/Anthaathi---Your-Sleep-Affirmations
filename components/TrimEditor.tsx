import Slider from '@react-native-community/slider';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { formatDuration } from '@/lib/format';

type TrimEditorProps = {
  uri: string;
  durationMs: number;
  initialTrimStartMs?: number | null;
  initialTrimEndMs?: number | null;
  /** Both args are null when the trim covers the full, untouched duration — "no trim". */
  onSave: (trimStartMs: number | null, trimEndMs: number | null) => Promise<void> | void;
  saveLabel?: string;
};

/**
 * Non-destructive trim: the audio file is never re-encoded. Trim points are just
 * start/end offsets applied at playback time (used both mid-review before the
 * first save, and to edit an already-saved recording).
 */
export function TrimEditor({
  uri,
  durationMs,
  initialTrimStartMs,
  initialTrimEndMs,
  onSave,
  saveLabel = 'Save trim',
}: TrimEditorProps) {
  const colors = useThemeColors();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const [trimStartMs, setTrimStartMs] = useState(initialTrimStartMs ?? 0);
  const [trimEndMs, setTrimEndMs] = useState(initialTrimEndMs ?? durationMs);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Playback always respects the current trim range — pressing Play previews
  // exactly what will be saved. Position is only clamped at the point Play is
  // pressed (not continuously), so dragging the slider past either boundary
  // still works for picking a new start/end point.
  useEffect(() => {
    if (status.playing && status.currentTime * 1000 >= trimEndMs) {
      player.pause();
    }
  }, [status.playing, status.currentTime, trimEndMs, player]);

  function handleTogglePlay() {
    if (status.playing) {
      player.pause();
    } else {
      const positionMs = status.currentTime * 1000;
      if (positionMs < trimStartMs || positionMs >= trimEndMs) {
        player.seekTo(trimStartMs / 1000);
      }
      player.play();
    }
  }

  function handleSetStart() {
    const positionMs = Math.round(status.currentTime * 1000);
    if (positionMs >= trimEndMs) {
      setError('Start must be before the end point.');
      return;
    }
    setError(null);
    setTrimStartMs(positionMs);
  }

  function handleSetEnd() {
    const positionMs = Math.round(status.currentTime * 1000);
    if (positionMs <= trimStartMs) {
      setError('End must be after the start point.');
      return;
    }
    setError(null);
    setTrimEndMs(positionMs);
  }

  async function handleSave() {
    if (trimEndMs <= trimStartMs) {
      setError('End must be after the start point.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // The full, untouched range means "not actually trimmed" — store null
      // rather than the concrete 0/durationMs bounds, so callers and the
      // Library's "trimmed" label can tell the difference.
      const isFullRange = trimStartMs === 0 && trimEndMs === durationMs;
      await onSave(isFullRange ? null : trimStartMs, isFullRange ? null : trimEndMs);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.time, { color: colors.textPrimary }]}>
        {formatDuration(status.currentTime * 1000)} / {formatDuration(durationMs)}
      </Text>

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={durationMs / 1000}
        value={status.currentTime}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
        onSlidingComplete={(value) => player.seekTo(value)}
      />

      <Pressable
        onPress={handleTogglePlay}
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.buttonLabel, { color: colors.background }]}>
          {status.playing ? 'Pause' : 'Play'}
        </Text>
      </Pressable>

      <View style={styles.row}>
        <Pressable
          onPress={handleSetStart}
          accessibilityRole="button"
          style={[styles.secondaryButton, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textPrimary }}>Set start here</Text>
        </Pressable>
        <Pressable
          onPress={handleSetEnd}
          accessibilityRole="button"
          style={[styles.secondaryButton, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textPrimary }}>Set end here</Text>
        </Pressable>
      </View>

      <Text style={[styles.trimSummary, { color: colors.textSecondary }]}>
        Trim: {formatDuration(trimStartMs)} – {formatDuration(trimEndMs)}
      </Text>

      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <Pressable
        onPress={handleSave}
        disabled={saving}
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: colors.secondary, opacity: saving ? 0.5 : 1 }]}
      >
        {saving ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={[styles.buttonLabel, { color: colors.background }]}>{saveLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.md,
    alignItems: 'center',
  },
  time: {
    fontSize: typography.body.fontSize,
    fontVariant: ['tabular-nums'],
  },
  slider: {
    width: '100%',
  },
  button: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 200,
  },
  buttonLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  trimSummary: {
    fontSize: typography.caption.fontSize,
    fontVariant: ['tabular-nums'],
  },
  error: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
  },
});
