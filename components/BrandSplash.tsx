import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { DuskBackground } from '@/components/ui/DuskBackground';
import { gradientBackground } from '@/components/ui/gradient';
import { GradientText } from '@/components/ui/GradientText';
import { colors, gradients, typography } from '@/constants/theme';

/** The splash stays at least this long, so it reads as a calm moment, not a flicker. */
export const SPLASH_MIN_MS = 3000;
const FADE_MS = 400;

type BrandSplashProps = {
  /** True while the app is still loading (the auth session). */
  loading: boolean;
};

/**
 * The Splash mockup, drawn over the app on cold start: it shows for at least
 * SPLASH_MIN_MS and until `loading` is false, then fades out (instantly when the
 * system's reduce-motion setting is on) and unmounts. The navigator renders underneath
 * meanwhile, so the first screen is ready when the splash lifts.
 */
export function BrandSplash({ loading }: BrandSplashProps) {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [visible, setVisible] = useState(true);
  // Created once and never replaced (lazy state, not a ref read during render).
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading || !minTimeElapsed) return;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) {
          setVisible(false);
          return;
        }
        Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(
          () => setVisible(false),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [loading, minTimeElapsed, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      testID="brand-splash"
      // One announcement for the whole moment, instead of the mark and the wordmark
      // each reading out "Anthaathi".
      accessible
      accessibilityLabel="Anthaathi. Where old patterns end, new ones begin."
      style={[StyleSheet.absoluteFill, styles.root, { opacity }]}
    >
      <DuskBackground />
      <View style={styles.center}>
        <View style={styles.mark}>
          <BrandMark width={96} />
        </View>
        <GradientText accessibilityRole="header" style={styles.wordmark}>
          Anthaathi
        </GradientText>
        <Text style={styles.tagline}>{'Where old patterns end,\nnew ones begin.'}</Text>
      </View>
      <View style={[styles.bar, gradientBackground(gradients.actionFill)]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  mark: {
    marginBottom: 28,
  },
  wordmark: {
    ...typography.wordmark,
    letterSpacing: -0.5,
  },
  tagline: {
    ...typography.quote,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 22,
  },
  bar: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    width: 40,
    height: 3,
    borderRadius: 3,
    opacity: 0.8,
  },
});
