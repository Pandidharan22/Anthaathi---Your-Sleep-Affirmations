import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { GlowOrb } from '@/components/GlowOrb';
import { Icon } from '@/components/ui/Icon';
import { colors } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type StarSpec = { x: number; y: number; size: number; period: number; delay: number };

/** A small fixed-seed generator, so the sky is the same every night (and in tests). */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const COLUMNS = 7;
const ROWS = 6;

/**
 * The stars, scattered evenly over the sky (user, R.7a: "scattered, but like a pattern"): one
 * star per cell of a 7 × 6 grid, nudged inside its cell so no rows or columns show, and none
 * in the middle, where the moon and its glow are. Mostly small, a few larger, each with its
 * own twinkle rhythm and start.
 */
export const STARS: readonly StarSpec[] = (() => {
  const random = seeded(20261021);
  const stars: StarSpec[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      // Cell centre plus a nudge of up to 35% of a cell either way, in percent of the sky.
      const x = ((col + 0.5 + (random() - 0.5) * 0.7) / COLUMNS) * 100;
      const y = ((row + 0.5 + (random() - 0.5) * 0.7) / ROWS) * 100;
      const sizeRoll = random();
      const period = 1800 + random() * 1800;
      const delay = random() * 2500;
      // An ellipse around the moon stays clear.
      if (((x - 50) / 26) ** 2 + ((y - 50) / 30) ** 2 < 1) continue;
      const size = sizeRoll > 0.85 ? 12 : sizeRoll > 0.55 ? 9 : 6;
      stars.push({ x, y, size, period, delay });
    }
  }
  return stars;
})();

/**
 * Each star at its brightest stays well under the moon's glow, so a sky full of them
 * shimmers around the moon instead of competing with it.
 */
const STAR_MAX = 0.65;
const STAR_MIN = 0.12;
/** Still stars (paused, or reduced motion) rest here. */
const STAR_REST = 0.38;

type MoonSkyProps = {
  /** The moon's glow diameter; the stars spread around it across the whole area. */
  glowSize: number;
  /** Twinkles and breathes while playing; rests while paused. */
  animate: boolean;
};

/**
 * The Player's night sky (user's request, R.7a): a light mauve moon in a soft breathing
 * mauve glow, with star-shaped stars twinkling all around it. The moon's glow is toned down
 * (intensity 0.7) and the stars kept small and dim, so neither outshines the other.
 * Decorative only: hidden from screen readers.
 */
export function MoonSky({ glowSize, animate }: MoonSkyProps) {
  const reduceMotion = useReducedMotion();
  const twinkling = animate && !reduceMotion;

  return (
    <View style={styles.sky} aria-hidden>
      {STARS.map((star, i) => (
        <Star key={i} {...star} twinkling={twinkling} />
      ))}
      <GlowOrb size={glowSize} breathing={animate} intensity={0.7}>
        <Icon name="moon" color={colors.accent} size={Math.round(glowSize * 0.42)} filled />
      </GlowOrb>
    </View>
  );
}

function Star({ x, y, size, period, delay, twinkling }: StarSpec & { twinkling: boolean }) {
  const [opacity] = useState(() => new Animated.Value(STAR_REST));

  useEffect(() => {
    if (!twinkling) {
      Animated.timing(opacity, {
        toValue: STAR_REST,
        duration: 400,
        useNativeDriver: true,
      }).start();
      return;
    }
    const half = period / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: STAR_MAX,
          duration: half,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: STAR_MIN,
          duration: half,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    // Each star starts at its own moment, so they never pulse in step.
    const start = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [opacity, twinkling, period, delay]);

  return (
    <Animated.View
      style={[
        styles.star,
        // Centred on its point, whatever its size.
        { left: `${x}%`, top: `${y}%`, marginLeft: -size / 2, marginTop: -size / 2, opacity },
      ]}
    >
      <Icon name="sparkle" color={colors.textPrimary} size={size} filled />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sky: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
  },
  star: {
    position: 'absolute',
  },
});
