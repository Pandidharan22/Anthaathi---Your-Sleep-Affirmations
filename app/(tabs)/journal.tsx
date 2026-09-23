import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { formatDate } from '@/lib/format';
import { listLocalJournalEntries, type LocalJournalEntry } from '@/lib/journal.local';

export default function JournalScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const [entries, setEntries] = useState<LocalJournalEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      listLocalJournalEntries(user.id).then(setEntries);
    }, [user]),
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Journal</Text>
        <Pressable
          onPress={() => router.push('/journal/new')}
          accessibilityRole="button"
          style={[styles.addButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.addButtonLabel, { color: colors.background }]}>New entry</Text>
        </Pressable>
      </View>

      {entries.length === 0 ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          No journal entries yet — tap New entry to write your first one.
        </Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/journal/${item.id}`)}
              accessibilityRole="button"
              style={[styles.entryRow, { borderColor: colors.border }]}
            >
              <Text style={[styles.entryDate, { color: colors.textSecondary }]}>{formatDate(item.created_at)}</Text>
              {item.prompt ? (
                <Text style={[styles.entryPrompt, { color: colors.accentText }]} numberOfLines={1}>
                  {item.prompt}
                </Text>
              ) : null}
              <Text style={[styles.entryBody, { color: colors.textPrimary }]} numberOfLines={2}>
                {item.body}
              </Text>
            </Pressable>
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
  entryRow: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  entryDate: {
    fontSize: typography.caption.fontSize,
  },
  entryPrompt: {
    fontSize: typography.caption.fontSize,
    fontStyle: 'italic',
  },
  entryBody: {
    fontSize: typography.body.fontSize,
  },
});
