import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { Waveform } from '@/components/Waveform';
import { Button } from '@/components/ui/Button';
import { GlowButton } from '@/components/ui/GlowButton';
import { GradientText } from '@/components/ui/GradientText';
import { Icon } from '@/components/ui/Icon';
import { NavHeader } from '@/components/ui/NavHeader';
import { colors, fonts, glows, typography } from '@/constants/theme';
import { usePlaybackProgress } from '@/hooks/usePlaybackProgress';
import { formatDuration } from '@/lib/format';
import { describeTrim, moveTrimHandle, normalizeTrim, type TrimRange } from '@/lib/waveform';

/** "◀ Preview" and "Preview ▶" play this much just inside each handle. */
const PREVIEW_MS = 3000;
/** One screen-reader swipe on a handle moves it this far. */
const NUDGE_MS = 500;
const BARS = 60;
const WAVE_HEIGHT = 120;

type TrimScreenProps = {
  uri: string;
  durationMs: number;
  levels: number[] | null;
  /** The trim to start from; null starts with the whole recording. */
  initialTrim: TrimRange | null;
  onCancel: () => void;
  /** null when the handles were left at (or put back to) the very ends. */
  onDone: (trim: TrimRange | null) => void;
};

/**
 * The Trim mockup: the kept range in big gradient numbers, a large waveform with two
 * glowing handles to drag, a ruler, previews of each cut, and a note saying what will be
 * cut. Shown as a full-screen modal over Preview (R.5c) and the recording edit screen
 * (R.5d); Android's back gesture cancels. Nothing is saved here: Done hands the range
 * back, and the trim stays non-destructive (step 1.5).
 */
export function TrimScreen({
  uri,
  durationMs,
  levels,
  initialTrim,
  onCancel,
  onDone,
}: TrimScreenProps) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const [range, setRange] = useState<TrimRange>(
    () => initialTrim ?? { startMs: 0, endMs: durationMs },
  );
  // Where the current playback stops: the trim end, or the end of a short preview.
  const [stopMs, setStopMs] = useState(range.endMs);
  const [waveWidth, setWaveWidth] = useState(0);

  const positionMs = Math.min(Math.max(status.currentTime * 1000, 0), durationMs);
  const playhead = usePlaybackProgress({
    playing: status.playing,
    positionMs,
    stopMs,
    durationMs,
    useNativeDriver: true,
  });

  useEffect(() => {
    if (status.playing && status.currentTime * 1000 >= stopMs) player.pause();
  }, [status.playing, status.currentTime, stopMs, player]);

  function play(fromMs: number, toMs: number) {
    setStopMs(toMs);
    player.seekTo(fromMs / 1000);
    player.play();
  }

  function handleTogglePlay() {
    if (status.playing) {
      player.pause();
      return;
    }
    // Resume a paused full play; anything else starts again from the start handle.
    const resumable =
      stopMs === range.endMs && positionMs > range.startMs && positionMs < range.endMs - 50;
    play(resumable ? positionMs : range.startMs, range.endMs);
  }

  // Dragging. The whole waveform is one touch area: a touch grabs whichever handle is
  // nearer and moves it by the drag distance, so it never jumps under the finger. The
  // handles themselves are only 4 pt wide, far too small to hit directly (NFR-401).
  const waveRef = useRef<View>(null);
  const waveLeft = useRef(0);
  const drag = useRef<{ handle: 'start' | 'end'; originMs: number; startX: number } | null>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  function handleGrant(event: GestureResponderEvent) {
    if (waveWidth <= 0) return;
    const { pageX } = event.nativeEvent;
    const atMs = ((pageX - waveLeft.current) / waveWidth) * durationMs;
    const handle =
      atMs < range.startMs
        ? 'start'
        : atMs > range.endMs
          ? 'end'
          : atMs - range.startMs <= range.endMs - atMs
            ? 'start'
            : 'end';
    drag.current = {
      handle,
      originMs: handle === 'start' ? range.startMs : range.endMs,
      startX: pageX,
    };
    setDragging(handle);
    player.pause();
  }

  function handleMove(event: GestureResponderEvent) {
    const current = drag.current;
    if (!current || waveWidth <= 0) return;
    const toMs =
      current.originMs + ((event.nativeEvent.pageX - current.startX) / waveWidth) * durationMs;
    setRange((r) => moveTrimHandle(r, current.handle, toMs, durationMs));
  }

  function handleRelease() {
    drag.current = null;
    setDragging(null);
  }

  function nudge(handle: 'start' | 'end', deltaMs: number) {
    player.pause();
    setRange((r) =>
      moveTrimHandle(r, handle, (handle === 'start' ? r.startMs : r.endMs) + deltaMs, durationMs),
    );
  }

  const fraction = (ms: number) => (durationMs > 0 ? ms / durationMs : 0);
  const rangeLabel = `${formatDuration(range.startMs)} — ${formatDuration(range.endMs)}`;
  const trim = normalizeTrim(range, durationMs);

  function renderHandle(handle: 'start' | 'end') {
    const ms = handle === 'start' ? range.startMs : range.endMs;
    return (
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={handle === 'start' ? 'Trim start' : 'Trim end'}
        accessibilityValue={{ text: formatDuration(ms) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          nudge(handle, event.nativeEvent.actionName === 'increment' ? NUDGE_MS : -NUDGE_MS)
        }
        style={[
          styles.handle,
          { left: fraction(ms) * waveWidth - 2 },
          dragging === handle && styles.handleActive,
        ]}
      />
    );
  }

  return (
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.root}>
        <NavHeader
          title="Trim"
          leadingContent={
            <Button label="Cancel" variant="ghost" onPress={onCancel} style={styles.navButton} />
          }
          trailing={
            <Button
              label="Done"
              variant="ghost"
              tone="accent"
              onPress={() => onDone(trim)}
              style={styles.navButton}
            />
          }
        />

        <View style={styles.content}>
          <View style={styles.rangeRow}>
            <Text style={styles.cap}>Start</Text>
            <GradientText
              style={styles.range}
              accessibilityLabel={`Keeping ${formatDuration(range.startMs)} to ${formatDuration(range.endMs)}`}
            >
              {rangeLabel}
            </GradientText>
            <Text style={styles.cap}>End</Text>
          </View>

          <View style={styles.waveCard}>
            <View
              ref={waveRef}
              testID="trim-waveform"
              onLayout={(event) => {
                setWaveWidth(event.nativeEvent.layout.width);
                waveRef.current?.measureInWindow((x) => {
                  waveLeft.current = x;
                });
              }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
              onResponderGrant={handleGrant}
              onResponderMove={handleMove}
              onResponderRelease={handleRelease}
              onResponderTerminate={handleRelease}
            >
              <Waveform
                levels={levels}
                bars={BARS}
                height={WAVE_HEIGHT}
                gap={2}
                keepFrom={fraction(range.startMs)}
                keepTo={fraction(range.endMs)}
                highlightKept
              />
              {status.playing && waveWidth > 0 ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.playhead,
                    {
                      transform: [
                        {
                          translateX: playhead.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, waveWidth],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ) : null}
              {waveWidth > 0 ? (
                <>
                  {renderHandle('start')}
                  {renderHandle('end')}
                </>
              ) : null}
            </View>
          </View>

          <View style={styles.ruler} aria-hidden>
            {[0, 0.25, 0.5, 0.75, 1].map((at) => (
              <Text key={at} style={styles.cap}>
                {formatDuration(at * durationMs)}
              </Text>
            ))}
          </View>

          <View style={styles.transport}>
            <Button
              label="◀ Preview"
              variant="secondary"
              compact
              accessibilityLabel="Preview the start"
              onPress={() => play(range.startMs, Math.min(range.startMs + PREVIEW_MS, range.endMs))}
              style={styles.previewButton}
            />
            <GlowButton
              icon={status.playing ? 'pause' : 'play'}
              iconFilled
              size={72}
              accessibilityLabel={status.playing ? 'Pause' : 'Play the kept part'}
              onPress={handleTogglePlay}
            />
            <Button
              label="Preview ▶"
              variant="secondary"
              compact
              accessibilityLabel="Preview the end"
              onPress={() => play(Math.max(range.endMs - PREVIEW_MS, range.startMs), range.endMs)}
              style={styles.previewButton}
            />
          </View>

          <View style={styles.note}>
            <Icon name="info" color={colors.info} />
            <Text accessibilityLiveRegion="polite" style={styles.noteText}>
              {describeTrim(trim, durationMs, 'manual')}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navButton: {
    paddingHorizontal: 0,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  range: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 32,
    lineHeight: 40,
    fontVariant: ['tabular-nums'],
  },
  cap: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  waveCard: {
    marginTop: 30,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  handle: {
    position: 'absolute',
    top: -12,
    bottom: -12,
    width: 4,
    borderRadius: 3,
    backgroundColor: colors.accent,
    boxShadow: glows.handle,
  },
  handleActive: {
    backgroundColor: colors.textPrimary,
  },
  playhead: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    left: -1,
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.textPrimary,
    opacity: 0.85,
  },
  ruler: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 36,
  },
  previewButton: {
    flex: 1,
  },
  note: {
    marginTop: 32,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noteText: {
    ...typography.caption,
    flex: 1,
    color: colors.textSecondary,
  },
});
