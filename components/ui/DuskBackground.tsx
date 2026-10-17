import { StyleSheet, View } from 'react-native';

import { gradientBackground } from './gradient';

// The board's `.hero-mesh`: a dark Velvet Dusk base with soft mauve blobs.
const HERO_MESH = [
  'radial-gradient(60% 45% at 15% 10%, rgba(169, 143, 196, 0.42) 0%, rgba(169, 143, 196, 0) 70%)',
  'radial-gradient(60% 45% at 90% 5%, rgba(54, 42, 63, 0.95) 0%, rgba(54, 42, 63, 0) 70%)',
  'radial-gradient(65% 50% at 95% 95%, rgba(169, 143, 196, 0.22) 0%, rgba(169, 143, 196, 0) 70%)',
  'radial-gradient(70% 55% at 5% 100%, rgba(78, 54, 96, 0.7) 0%, rgba(78, 54, 96, 0) 70%)',
  'linear-gradient(160deg, #1D1622 0%, #362A3F 100%)',
].join(', ');

type DuskBackgroundProps = {
  /** The Record screen dims it to 0.7. */
  opacity?: number;
};

/**
 * Full-screen Velvet Dusk mesh for the hero screens (Splash, Player, Record,
 * Generating, Mode Choice). Place it first inside the screen's root view.
 */
export function DuskBackground({ opacity = 1 }: DuskBackgroundProps) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, gradientBackground(HERO_MESH), { opacity }]}
    />
  );
}
