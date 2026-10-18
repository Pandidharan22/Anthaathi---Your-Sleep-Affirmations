import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { AffirmationRow } from '@/components/AffirmationRow';
import { spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { listLocalAffirmations, type LocalAffirmation } from '@/lib/affirmations.local';
import { UNFILED_FOLDER_ID } from '@/lib/folderStats';
import { getLocalFolder, type LocalFolder } from '@/lib/folders.local';

export default function FolderDetailScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [folder, setFolder] = useState<LocalFolder | null | undefined>(undefined);
  const [affirmations, setAffirmations] = useState<LocalAffirmation[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      // "Unfiled" isn't a real folder: it's the recordings with no folder (Library card).
      const unfiled = id === UNFILED_FOLDER_ID;
      if (unfiled) {
        setFolder({ id, name: 'Unfiled' } as LocalFolder);
      } else {
        getLocalFolder(id).then(setFolder);
      }
      if (user) {
        listLocalAffirmations(user.id).then((all) =>
          setAffirmations(
            all.filter((affirmation) =>
              unfiled ? affirmation.folder_id === null : affirmation.folder_id === id,
            ),
          ),
        );
      }
    }, [id, user]),
  );

  if (folder === undefined) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.action} />
      </View>
    );
  }

  if (folder === null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Folder not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{folder.name}</Text>

      {affirmations.length === 0 ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          No recordings in this folder yet.
        </Text>
      ) : (
        <FlatList
          data={affirmations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <AffirmationRow
              affirmation={item}
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
  title: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontFamily: typography.title.fontFamily,
  },
  description: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  list: {
    gap: spacing.sm,
  },
});
