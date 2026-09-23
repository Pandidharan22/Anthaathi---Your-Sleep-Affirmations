import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AffirmationRow } from '@/components/AffirmationRow';
import { StreakBadge } from '@/components/StreakBadge';
import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { listLocalAffirmations, type LocalAffirmation } from '@/lib/affirmations.local';
import { listLocalFolders, type LocalFolder } from '@/lib/folders.local';
import { listLocalPlaybackSessions } from '@/lib/playbackSessions.local';
import { computeStreak } from '@/lib/streak';

export default function LibraryScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const [affirmations, setAffirmations] = useState<LocalAffirmation[]>([]);
  const [folders, setFolders] = useState<LocalFolder[]>([]);
  const [streak, setStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      listLocalAffirmations(user.id).then(setAffirmations);
      listLocalFolders(user.id).then(setFolders);
      listLocalPlaybackSessions(user.id).then((sessions) =>
        setStreak(computeStreak(sessions.map((s) => s.played_at))),
      );
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

      <StreakBadge streak={streak} />

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
            <AffirmationRow
              affirmation={item}
              folderName={item.folder_id ? folderNameById.get(item.folder_id) : null}
              onPress={() => router.push(`/affirmation/${item.id}/trim`)}
            />
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
});
