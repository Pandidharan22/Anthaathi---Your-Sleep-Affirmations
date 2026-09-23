import { StyleSheet, Text, View } from 'react-native';

import { spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { getStreakEmoji } from '@/lib/streak';

type StreakBadgeProps = {
  streak: number;
};

export function StreakBadge({ streak }: StreakBadgeProps) {
  const colors = useThemeColors();

  const label =
    streak === 0
      ? 'No streak yet — play tonight to start one'
      : `${getStreakEmoji(streak)} ${streak}-day streak`;

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.body.fontSize,
  },
});
