import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { gradientBackground } from '@/components/ui/gradient';
import { gradients } from '@/constants/theme';

const SIZE = 260;

/**
 * The Generating step's glow (mockup #23): a soft mauve halo, a terracotta warmth inside it,
 * a faint ring and a glowing gradient core. It breathes slowly on the native driver while the
 * voice is made, and holds still when the phone asks for reduced motion.
 */
export function GeneratingOrb() {
  const [breath] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breath, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(breath, {
            toValue: 0,
            duration: 1600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [breath]);

  const haloScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });
  const coreScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] });

  return (
    <View style={styles.orb} aria-hidden>
      <Animated.View style={[styles.layer, styles.halo, { transform: [{ scale: haloScale }] }]} />
      <Animated.View style={[styles.layer, styles.warmth, { transform: [{ scale: haloScale }] }]} />
      <View style={[styles.layer, styles.ring]} />
      <Animated.View
        style={[
          styles.layer,
          styles.core,
          gradientBackground(gradients.actionFill),
          { transform: [{ scale: coreScale }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    width: SIZE,
    height: SIZE,
    alignSelf: 'center',
  },
  layer: {
    position: 'absolute',
    borderRadius: SIZE / 2,
  },
  halo: {
    inset: 0,
    ...gradientBackground('radial-gradient(closest-side, rgba(169, 143, 196, 0.4), transparent)'),
  },
  warmth: {
    inset: 40,
    ...gradientBackground('radial-gradient(closest-side, rgba(227, 148, 110, 0.55), transparent)'),
  },
  ring: {
    inset: 20,
    borderWidth: 1,
    borderColor: 'rgba(247, 238, 227, 0.15)',
  },
  core: {
    inset: 90,
    boxShadow: '0px 0px 40px 4px rgba(227, 148, 110, 0.65)',
  },
});
