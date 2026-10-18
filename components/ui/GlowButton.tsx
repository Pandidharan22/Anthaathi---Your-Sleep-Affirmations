import { Pressable, StyleSheet, View } from 'react-native';

import { colors, glows, gradients } from '@/constants/theme';

import { gradientBackground } from './gradient';
import { Icon, type IconName } from './Icon';

type GlowButtonProps = {
  icon: IconName;
  /** Required: an icon alone has no name for a screen reader. */
  accessibilityLabel: string;
  onPress: () => void;
  /** E.g. the Record screen's "hold to stop". */
  onLongPress?: () => void;
  accessibilityHint?: string;
  /** Diameter of the gradient button itself. */
  size?: number;
  /** `hero` is the slightly stronger glow of the Player pause and the Generating orb. */
  glow?: 'control' | 'hero';
  /**
   * Diameter of the soft warm light drawn behind the button (the Record and Player
   * screens' mauve halo with a terracotta core). Omit for no halo.
   */
  haloSize?: number;
  /** Grows or shrinks the halo, e.g. with the live recording level (1 = as drawn). */
  haloScale?: number;
  /** Draws the icon solid, as the board does for play and pause. */
  iconFilled?: boolean;
  disabled?: boolean;
};

/**
 * A big round "voice" control (mic, play, pause): the mauve gradient fill with the
 * terracotta glow from DESIGN.md. Terracotta never appears as a ring, only as glow.
 */
export function GlowButton({
  icon,
  accessibilityLabel,
  onPress,
  onLongPress,
  accessibilityHint,
  size = 72,
  glow = 'control',
  haloSize,
  haloScale = 1,
  iconFilled = false,
  disabled = false,
}: GlowButtonProps) {
  const button = (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.center,
        gradientBackground(gradients.actionFill),
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          boxShadow: glows[glow],
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <Icon
        name={icon}
        color={colors.background}
        size={Math.round(size * 0.36)}
        filled={iconFilled}
      />
    </Pressable>
  );

  if (!haloSize) return button;

  const innerHalo = Math.round(haloSize * 0.7);
  return (
    <View style={[styles.center, { width: haloSize, height: haloSize }]}>
      <View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            transform: [{ scale: haloScale }],
          },
          gradientBackground(
            'radial-gradient(closest-side, rgba(169, 143, 196, 0.38) 0%, rgba(169, 143, 196, 0) 70%)',
          ),
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: innerHalo,
            height: innerHalo,
            borderRadius: innerHalo / 2,
            transform: [{ scale: haloScale }],
          },
          gradientBackground(
            'radial-gradient(closest-side, rgba(227, 148, 110, 0.55) 0%, rgba(227, 148, 110, 0) 68%)',
          ),
        ]}
      />
      {button}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
});
