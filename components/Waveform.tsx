import { useMemo, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { gradientBackground } from '@/components/ui/gradient';
import { colors } from '@/constants/theme';
import { bucketLevels } from '@/lib/waveform';

const PLAYED_BAR = gradientBackground(
  `linear-gradient(180deg, ${colors.accent}, ${colors.action})`,
);

type WaveformProps = {
  /** 0–1 loudness levels; null or empty draws a flat line (recordings made before R.5). */
  levels: number[] | null;
  bars?: number;
  height?: number;
  /** Space between bars. */
  gap?: number;
  /**
   * 0–1 position over the full length. An Animated.Value, so the played part can glide
   * smoothly between the player's position updates (a few per second) instead of
   * jumping with each one.
   */
  progress?: Animated.Value;
  /** 0–1 fractions of the full length kept by the trim; bars outside are dimmed. */
  keepFrom?: number;
  keepTo?: number;
  /**
   * The Trim screen's look: kept bars always in the gradient, cut bars in the border
   * color. Without it, kept bars are dim until played.
   */
  highlightKept?: boolean;
};

/**
 * The mockups' waveform: rounded bars in the border color, with the played part drawn
 * over them in the mauve gradient. The played layer is the same bars, revealed by an
 * animated clip; trimmed-away bars stay dim and never light up. Decorative for screen
 * readers: the screens around it say the time in words.
 */
export function Waveform({
  levels,
  bars = 40,
  height = 72,
  gap = 3,
  progress,
  keepFrom = 0,
  keepTo = 1,
  highlightKept = false,
}: WaveformProps) {
  const [width, setWidth] = useState(0);
  const heights = useMemo(() => {
    const bucketed = levels ? bucketLevels(levels, bars) : [];
    // A floor so quiet stretches still read as a line, not as nothing.
    return bucketed.length > 0
      ? bucketed.map((level) => Math.max(0.08, level))
      : Array.from({ length: bars }, () => 0.08);
  }, [levels, bars]);

  const isKept = (i: number) => {
    const at = (i + 0.5) / heights.length;
    return at >= keepFrom && at <= keepTo;
  };

  return (
    <View aria-hidden style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.row, StyleSheet.absoluteFill, { gap }]}>
        {heights.map((h, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { height: `${Math.round(h * 100)}%` },
              highlightKept
                ? isKept(i)
                  ? PLAYED_BAR
                  : { backgroundColor: colors.border }
                : { backgroundColor: isKept(i) ? colors.border : colors.elevated },
            ]}
          />
        ))}
      </View>
      {progress && width > 0 ? (
        <Animated.View
          style={[
            styles.clip,
            { width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, width] }) },
          ]}
        >
          <View style={[styles.row, { width, height, gap }]}>
            {heights.map((h, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  { height: `${Math.round(h * 100)}%` },
                  isKept(i) ? PLAYED_BAR : styles.hidden,
                ]}
              />
            ))}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bar: {
    flex: 1,
    borderRadius: 3,
  },
  clip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  hidden: {
    backgroundColor: 'transparent',
  },
});
