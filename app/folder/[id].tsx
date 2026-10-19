import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AffirmationRow } from '@/components/AffirmationRow';
import { FolderNameSheet } from '@/components/FolderNameSheet';
import { GlowButton } from '@/components/ui/GlowButton';
import { IconButton } from '@/components/ui/IconButton';
import { NavHeader } from '@/components/ui/NavHeader';
import { colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePreviewPlayer } from '@/hooks/usePreviewPlayer';
import { listLocalAffirmations, type LocalAffirmation } from '@/lib/affirmations.local';
import { getVoiceOption } from '@/lib/aiVoice';
import { describeFolderStats, summarizeByFolder, UNFILED_FOLDER_ID } from '@/lib/folderStats';
import { deleteLocalFolder, getLocalFolder, renameLocalFolder } from '@/lib/folders.local';

const ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * The Folder Detail mockup: the folder's recordings with in-place previews, its total
 * length, a ⋯ menu to rename or delete it, and the glowing mic to add a recording to
 * it. `/folder/unfiled` shows recordings with no folder (no ⋯ menu: it isn't a real
 * folder). Replaces the old separate Folders screen (step 1.6).
 */
export default function FolderDetailScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const unfiled = id === UNFILED_FOLDER_ID;

  // undefined = loading, null = not found.
  const [name, setName] = useState<string | null | undefined>(unfiled ? 'Unfiled' : undefined);
  const [affirmations, setAffirmations] = useState<LocalAffirmation[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = usePreviewPlayer();
  const { stop: stopPreview } = preview;

  const refresh = useCallback(() => {
    if (!id) return;
    if (!unfiled) getLocalFolder(id).then((folder) => setName(folder ? folder.name : null));
    if (user) {
      listLocalAffirmations(user.id).then((all) =>
        setAffirmations(all.filter((a) => (unfiled ? a.folder_id === null : a.folder_id === id))),
      );
    }
  }, [id, unfiled, user]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      // Leaving the screen (opening a recording, going back) ends any preview.
      return stopPreview;
    }, [refresh, stopPreview]),
  );

  async function handleRename(newName: string) {
    await renameLocalFolder(id, newName);
    setRenaming(false);
    setName(newName);
  }

  function confirmDelete() {
    Alert.alert('Delete folder?', `Recordings in "${name}" will move to Unfiled.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setError(null);
          try {
            await deleteLocalFolder(id);
            router.back();
          } catch {
            setError(ERROR_MESSAGE);
          }
        },
      },
    ]);
  }

  function openMenu() {
    Alert.alert(name ?? 'Folder', undefined, [
      { text: 'Rename', onPress: () => setRenaming(true) },
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (name === undefined) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.action} />
      </View>
    );
  }

  if (name === null) {
    return (
      <View style={styles.root}>
        <NavHeader leading="back" onLeadingPress={() => router.back()} />
        <Text style={[styles.empty, styles.padded]}>This folder no longer exists.</Text>
      </View>
    );
  }

  const stats = summarizeByFolder(affirmations).get(unfiled ? null : id);
  const summary = stats ? `${describeFolderStats(stats)} total` : 'No recordings yet';

  return (
    <View style={styles.root}>
      <NavHeader
        title={name}
        leading="back"
        onLeadingPress={() => router.back()}
        trailing={
          unfiled ? undefined : (
            <IconButton icon="more" accessibilityLabel="Folder options" onPress={openMenu} />
          )
        }
      />

      <FlatList
        data={affirmations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.summary}>{summary}</Text>
            {error ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nothing here yet. Tap the mic to record or create an affirmation.
          </Text>
        }
        renderItem={({ item }) => (
          <AffirmationRow
            affirmation={item}
            voiceLabel={item.voice_id ? getVoiceOption(item.voice_id)?.label : undefined}
            playing={preview.playingId === item.id}
            onTogglePlay={() => preview.toggle(item)}
            onPress={() => router.push(`/affirmation/${item.id}`)}
          />
        )}
      />

      <View style={[styles.fab, { bottom: insets.bottom + 24 }]}>
        <GlowButton
          icon="mic"
          size={64}
          accessibilityLabel={`New affirmation in ${name}`}
          onPress={() =>
            router.push({ pathname: '/new-affirmation', params: unfiled ? {} : { folderId: id } })
          }
        />
      </View>

      <FolderNameSheet
        visible={renaming}
        title="Rename folder"
        confirmLabel="Save"
        initialName={name}
        onSubmit={handleRename}
        onClose={() => setRenaming(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  padded: {
    paddingHorizontal: 24,
  },
  list: {
    paddingHorizontal: 24,
    // Room for the floating mic so the last row can scroll clear of it.
    paddingBottom: 120,
    gap: 8,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  summary: {
    ...typography.caption,
    color: colors.textMuted,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
  empty: {
    ...typography.quote,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 24,
  },
  fab: {
    position: 'absolute',
    right: 24,
  },
});
