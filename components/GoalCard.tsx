import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { LocalGoal } from '@/lib/goals.local';

type GoalCardProps = {
  goal: LocalGoal;
  onPress: () => void;
};

export function GoalCard({ goal, onPress }: GoalCardProps) {
  const colors = useThemeColors();

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.card, { borderColor: colors.border }]}>
      {goal.image_local_uri ? (
        <Image source={{ uri: goal.image_local_uri }} style={styles.image} accessibilityLabel="Goal image" />
      ) : null}
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {goal.title}
        </Text>
        {goal.description ? (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {goal.description}
          </Text>
        ) : null}
      </View>
      {goal.status === 'achieved' ? (
        <Text style={[styles.badge, { color: colors.success }]}>Achieved</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
  },
  textColumn: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  description: {
    fontSize: typography.caption.fontSize,
  },
  badge: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
});
