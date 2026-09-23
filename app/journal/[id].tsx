import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { formatDate } from '@/lib/format';
import { deleteLocalJournalEntry, getLocalJournalEntry, type LocalJournalEntry } from '@/lib/journal.local';

export default function JournalEntryDetailScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<LocalJournalEntry | null | undefined>(undefined);

  const loadEntry = useCallback(() => {
    if (!id) return;
    getLocalJournalEntry(id).then(setEntry);
  }, [id]);

  useEffect(loadEntry, [loadEntry]);

  function handleDelete() {
    if (!entry) return;
    Alert.alert('Delete entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteLocalJournalEntry(entry.id);
          router.back();
        },
      },
    ]);
  }

  if (entry === undefined) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (entry === null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>Entry not found</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDate(entry.created_at)}</Text>
      {entry.prompt ? <Text style={[styles.prompt, { color: colors.secondary }]}>{entry.prompt}</Text> : null}
      <Text style={[styles.body, { color: colors.textPrimary }]}>{entry.body}</Text>

      <Pressable
        onPress={handleDelete}
        accessibilityRole="button"
        style={[styles.deleteButton, { borderColor: colors.error }]}
      >
        <Text style={{ color: colors.error }}>Delete entry</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  heading: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontWeight: typography.title.fontWeight,
  },
  date: {
    fontSize: typography.caption.fontSize,
  },
  prompt: {
    fontSize: typography.subtitle.fontSize,
    fontStyle: 'italic',
  },
  body: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  deleteButton: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
