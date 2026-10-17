import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii } from '@/constants/theme';

import { gradientBackground } from './gradient';

// The board's `.card-mesh::before`: two faint mauve glows in opposite corners.
const CARD_MESH =
  'radial-gradient(40% 60% at 100% 0%, rgba(169, 143, 196, 0.14) 0%, rgba(169, 143, 196, 0) 60%), ' +
  'radial-gradient(50% 60% at 0% 100%, rgba(169, 143, 196, 0.12) 0%, rgba(169, 143, 196, 0) 60%)';

type CardProps = {
  children: ReactNode;
  /** `elevated` sits one step above `surface`, e.g. a card on a card. */
  tone?: 'surface' | 'elevated';
  /** Adds the board's faint corner glows. */
  mesh?: boolean;
  /** Makes the whole card one button; give it an accessibilityLabel. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** The board's `.card` / `.card-elev`: 20pt corners, 16pt padding. */
export function Card({
  children,
  tone = 'surface',
  mesh = false,
  onPress,
  accessibilityLabel,
  style,
}: CardProps) {
  const cardStyle = [
    styles.card,
    { backgroundColor: tone === 'elevated' ? colors.elevated : colors.surface },
    style,
  ];
  const overlay = mesh ? (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, gradientBackground(CARD_MESH)]} />
  ) : null;

  if (!onPress) {
    return (
      <View style={cardStyle}>
        {overlay}
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.85 : 1 }]}
    >
      {overlay}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: 16,
    overflow: 'hidden',
  },
});
