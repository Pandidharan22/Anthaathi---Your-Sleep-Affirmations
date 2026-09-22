import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { listLocalAffirmations, type LocalAffirmation } from '@/lib/affirmations.local';
import { formatDuration } from '@/lib/format';
import { listLocalFolders, type LocalFolder } from '@/lib/folders.local';

export default function LibraryScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const [affirmations, setAffirmations] = useState<LocalAffirmation[]>([]);
  const [folders, setFolders] = useState<LocalFolder[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      listLocalAffirmations(user.id).then(setAffirmations);
      listLocalFolders(user.id).then(setFolders);
    }, [user]),
  );

  const folderNameById = new Map(folders.map((folder) => [folder.id, folder.name]));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Library</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/folders')} accessibilityRole="button">
            <Text style={{ color: colors.primary }}>Folders</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/record')}
            accessibilityRole="button"
            style={[styles.recordButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.recordButtonLabel, { color: colors.background }]}>Record</Text>
          </Pressable>
        </View>
      </View>

      {affirmations.length === 0 ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          No recordings yet — tap Record to make your first affirmation.
        </Text>
      ) : (
        <FlatList
          data={affirmations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/affirmation/${item.id}/trim`)}
              accessibilityRole="button"
              style={[styles.row, { borderColor: colors.border }]}
            >
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
                {item.folder_id && folderNameById.has(item.folder_id)
                  ? `${folderNameById.get(item.folder_id)} · `
                  : ''}
                {formatDuration(item.duration_ms)}
                {item.trim_start_ms !== null ? ' · trimmed' : ''}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  recordButton: {
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  recordButtonLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: typography.body.fontSize,
    flexShrink: 1,
  },
  rowMeta: {
    fontSize: typography.caption.fontSize,
  },
});
