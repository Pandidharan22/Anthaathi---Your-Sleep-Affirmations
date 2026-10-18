import { StyleSheet, Text, View } from 'react-native';

import { gradientBackground } from '@/components/ui/gradient';
import { colors, fonts, gradients, radii, typography } from '@/constants/theme';
import { getStreakEmoji } from '@/lib/streak';

type StreakBadgeProps = {
  streak: number;
};

/**
 * The mockup's `.streak` pill, "7 night streak", in the mauve gradient with a soft mauve
 * glow (the user's change from the mockup's terracotta, 2026-10-18). Where the
 * mockup has a flame, this keeps step 2.3's growth stages (🌱 → 🌿 → 🌳): FR-602 asks
 * for a visual growth metaphor, and a flame doesn't grow. With no streak yet it is a
 * quiet caption instead, so an empty state never looks like an achievement. Sits on
 * Library until R.8 moves it to Goals, where the mockup shows it.
 */
export function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak === 0) {
    return <Text style={styles.empty}>No streak yet — play tonight to start one.</Text>;
  }

  const label = `${streak} night streak`;
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.pill, gradientBackground(gradients.actionFill)]}
    >
      <Text style={styles.stage}>{getStreakEmoji(streak)}</Text>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: radii.full,
    // A soft mauve glow, gentler than the terracotta glow of the voice controls.
    boxShadow: '0px 0px 18px 2px rgba(169, 143, 196, 0.45)',
  },
  stage: {
    fontSize: 14,
  },
  pillText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.background,
  },
  empty: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
