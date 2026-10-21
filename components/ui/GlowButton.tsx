import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { colors, glowColor, glows, gradients } from '@/constants/theme';

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
  /**
   * `hero` is the slightly stronger glow of the Generating orb; `none` drops it, for the
   * Player's play/pause, where the moon carries the glow instead (user, R.7a).
   */
  glow?: 'control' | 'hero' | 'none';
  /**
   * Diameter of the soft warm light drawn behind the button (the Record and Player
   * screens' soft mauve halo). Omit for no halo.
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
 * mauve glow from DESIGN.md. Never a ring, only a glow.
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
  // The halo eases toward each new scale on the UI thread (native driver). Each glide
  // lasts a little longer than the Record screen's 100 ms level readings, so it never
  // stops between them: a smooth breath instead of 10 jumps a second.
  const [scale] = useState(() => new Animated.Value(haloScale));
  useEffect(() => {
    Animated.timing(scale, {
      toValue: haloScale,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [scale, haloScale]);

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
          boxShadow: glow === 'none' ? undefined : glows[glow],
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
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            transform: [{ scale }],
          },
          gradientBackground(
            'radial-gradient(closest-side, rgba(169, 143, 196, 0.38) 0%, rgba(169, 143, 196, 0) 70%)',
          ),
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: innerHalo,
            height: innerHalo,
            borderRadius: innerHalo / 2,
            transform: [{ scale }],
          },
          gradientBackground(
            `radial-gradient(closest-side, ${glowColor(0.55)} 0%, ${glowColor(0)} 68%)`,
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
