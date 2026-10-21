import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { gradientBackground } from '@/components/ui/gradient';
import { Icon } from '@/components/ui/Icon';
import { colors, fonts, glowColor, gradients, typography } from '@/constants/theme';
import { mixGains } from '@/lib/bedPrefs';

const THUMB = 26;
/** Positions snap to this (the old slider's step), so saved mixes stay tidy. */
const STEP = 0.025;
/** One screen-reader swipe moves this far. */
const NUDGE = 0.05;

/** Clamped to 0–1 and snapped to STEP, rounded so no float noise (0.30000000000000004) is saved. */
function snap(value: number): number {
  const stepped = Math.round(Math.min(1, Math.max(0, value)) / STEP) * STEP;
  return Number(stepped.toFixed(3));
}

type BalanceSliderProps = {
  /** 0–1: the middle plays both at full, left fades the voice, right fades the ambience. */
  mix: number;
  /** False with no ambience chosen: nothing to balance, so it shows dimmed and still. */
  enabled: boolean;
  /** Every movement, for applying the mix live. */
  onChange: (mix: number) => void;
  /** When a drag ends (or a screen-reader swipe), for saving. */
  onCommit: (mix: number) => void;
};

/**
 * The voice / ambience balance (FR-304) in the app's own style (user, R.7b): Ambience on the
 * left, Voice on the right, a soft mauve track with a notch at the middle (both at full), a
 * light-mauve stretch from the middle to the thumb showing which way it leans, and a glowing
 * gradient thumb. Replaces the plain community slider.
 */
export function BalanceSlider({ mix, enabled, onChange, onCommit }: BalanceSliderProps) {
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<View>(null);
  const trackLeft = useRef(0);
  const latest = useRef(mix);

  const gains = mixGains(mix, enabled);
  const percent = (gain: number) => Math.round(gain * 100);
  const travel = Math.max(0, width - THUMB);
  const thumbX = mix * travel;
  const centerX = 0.5 * travel + THUMB / 2;

  function valueAt(pageX: number) {
    if (travel <= 0) return mix;
    return snap((pageX - trackLeft.current - THUMB / 2) / travel);
  }

  function move(event: GestureResponderEvent) {
    const next = valueAt(event.nativeEvent.pageX);
    latest.current = next;
    onChange(next);
  }

  function release() {
    setDragging(false);
    onCommit(latest.current);
  }

  function nudge(delta: number) {
    const next = snap(mix + delta);
    onChange(next);
    onCommit(next);
  }

  const fillLeft = Math.min(centerX, thumbX + THUMB / 2);
  const fillWidth = Math.abs(thumbX + THUMB / 2 - centerX);

  return (
    <View style={[styles.root, !enabled && styles.disabled]}>
      <View style={styles.ends} aria-hidden>
        <View style={styles.end}>
          <Icon name="music" color={colors.accent} size={14} />
          <Text style={styles.endText}>Ambience</Text>
        </View>
        <View style={styles.end}>
          <Text style={styles.endText}>Voice</Text>
          <Icon name="voice" color={colors.accent} size={14} />
        </View>
      </View>

      <View
        ref={trackRef}
        testID="balance-track"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Voice and ambience balance"
        accessibilityState={{ disabled: !enabled }}
        accessibilityValue={{
          text: enabled
            ? `Voice ${percent(gains.voice)} percent, ambience ${percent(gains.bed)} percent`
            : 'No ambience chosen',
        }}
        accessibilityActions={enabled ? [{ name: 'increment' }, { name: 'decrement' }] : []}
        onAccessibilityAction={(event) =>
          nudge(event.nativeEvent.actionName === 'increment' ? NUDGE : -NUDGE)
        }
        onLayout={(event) => {
          setWidth(event.nativeEvent.layout.width);
          trackRef.current?.measureInWindow?.((x) => {
            trackLeft.current = x;
          });
        }}
        onStartShouldSetResponder={() => enabled}
        onMoveShouldSetResponder={() => enabled}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          setDragging(true);
          move(event);
        }}
        onResponderMove={move}
        onResponderRelease={release}
        onResponderTerminate={release}
        style={styles.touch}
      >
        <View style={styles.track} />
        {width > 0 ? (
          <>
            <View style={[styles.fill, { left: fillLeft, width: fillWidth }]} />
            <View style={[styles.notch, { left: centerX - 1 }]} />
            <View
              style={[
                styles.thumb,
                gradientBackground(gradients.actionFill),
                { left: thumbX, transform: [{ scale: dragging ? 1.15 : 1 }] },
              ]}
            />
          </>
        ) : null}
      </View>

      {enabled ? (
        <View style={styles.ends}>
          <Text style={styles.value}>{percent(gains.bed)}%</Text>
          <Text style={styles.value}>{percent(gains.voice)}%</Text>
        </View>
      ) : (
        <Text style={styles.hint}>Add an ambience sound with ♫ to balance it with your voice.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.45,
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  end: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  endText: {
    ...typography.caption,
    fontFamily: fonts.sansSemiBold,
    color: colors.textSecondary,
  },
  touch: {
    height: 44,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: glowColor(0.3),
  },
  fill: {
    position: 'absolute',
    top: 19,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    opacity: 0.7,
  },
  notch: {
    position: 'absolute',
    top: 15,
    width: 2,
    height: 14,
    borderRadius: 1,
    backgroundColor: 'rgba(247, 238, 227, 0.45)',
  },
  thumb: {
    position: 'absolute',
    top: (44 - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    boxShadow: `0px 0px 16px 2px ${glowColor(0.6)}`,
  },
  value: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
