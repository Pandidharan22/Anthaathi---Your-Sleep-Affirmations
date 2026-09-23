import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { GoalCard } from '@/components/GoalCard';
import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { listLocalGoals, type LocalGoal } from '@/lib/goals.local';

export default function GoalsScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const [goals, setGoals] = useState<LocalGoal[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      listLocalGoals(user.id).then(setGoals);
    }, [user]),
  );

  const active = goals.filter((goal) => goal.status === 'active');
  const achieved = goals.filter((goal) => goal.status === 'achieved');
  const sections = [
    ...(active.length > 0 ? [{ title: 'Active', data: active }] : []),
    ...(achieved.length > 0 ? [{ title: 'Achieved', data: achieved }] : []),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Goals</Text>
        <Pressable
          onPress={() => router.push('/goal/new')}
          accessibilityRole="button"
          style={[styles.addButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.addButtonLabel, { color: colors.background }]}>Add goal</Text>
        </Pressable>
      </View>

      {sections.length === 0 ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          No goals yet — tap Add goal to start your vision board.
        </Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <GoalCard goal={item} onPress={() => router.push(`/goal/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontWeight: typography.title.fontWeight,
  },
  description: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  addButton: {
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  addButtonLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  list: {
    gap: spacing.sm,
  },
  sectionHeader: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingVertical: spacing.xs,
  },
});
