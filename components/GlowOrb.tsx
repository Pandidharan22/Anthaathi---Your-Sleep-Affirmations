import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { gradientBackground } from '@/components/ui/gradient';
import { glowColor, glows, gradients } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type GlowOrbProps = {
  /** Outer diameter: 260 on Generating (mockup #23). */
  size?: number;
  /** The faint ring Generating draws. */
  ring?: boolean;
  /** Breathes while true (and the phone doesn't ask for reduced motion), holds still otherwise. */
  breathing?: boolean;
  /** Scales the glow's strength: 1 as on Generating; lower where it shares the sky (the moon). */
  intensity?: number;
  /** Something in the middle (the Player's moon). Without it, a glowing core is drawn. */
  children?: ReactNode;
};

/**
 * The big glow from the Generating and Player screens: a wide soft mauve halo with a brighter
 * one closer in, around either a glowing gradient core or a child. It breathes slowly on the
 * native driver.
 */
export function GlowOrb({
  size = 260,
  ring = false,
  breathing = true,
  intensity = 1,
  children,
}: GlowOrbProps) {
  const reduceMotion = useReducedMotion();
  const [breath] = useState(() => new Animated.Value(0));
  const moving = breathing && !reduceMotion;

  useEffect(() => {
    if (!moving) {
      Animated.timing(breath, { toValue: 0, duration: 400, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
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
    return () => loop.stop();
  }, [breath, moving]);

  const haloScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });
  const coreScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] });
  const layer = (inset: number) => ({
    position: 'absolute' as const,
    top: inset,
    right: inset,
    bottom: inset,
    left: inset,
    borderRadius: size / 2,
  });
  // Insets scale with the orb, from the mockup's 260 pt Generating orb.
  const at = (px: number) => Math.round((px / 260) * size);
  const halo = gradientBackground(
    `radial-gradient(closest-side, ${glowColor(0.4 * intensity)}, transparent)`,
  );
  const inner = gradientBackground(
    `radial-gradient(closest-side, ${glowColor(0.55 * intensity)}, transparent)`,
  );

  return (
    <View style={[styles.orb, { width: size, height: size }]}>
      <Animated.View aria-hidden style={[layer(0), halo, { transform: [{ scale: haloScale }] }]} />
      <Animated.View
        aria-hidden
        style={[layer(at(40)), inner, { transform: [{ scale: haloScale }] }]}
      />
      {ring ? <View aria-hidden style={[layer(at(20)), styles.ring]} /> : null}
      {children ? (
        <Animated.View style={[styles.center, { transform: [{ scale: coreScale }] }]}>
          {children}
        </Animated.View>
      ) : (
        <Animated.View
          aria-hidden
          style={[
            layer(at(90)),
            styles.core,
            gradientBackground(gradients.actionFill),
            { transform: [{ scale: coreScale }] },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    alignSelf: 'center',
  },
  ring: {
    borderWidth: 1,
    borderColor: 'rgba(247, 238, 227, 0.15)',
  },
  core: {
    boxShadow: glows.hero,
  },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
