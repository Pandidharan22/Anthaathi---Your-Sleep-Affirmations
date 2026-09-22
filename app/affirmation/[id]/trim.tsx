import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FolderPicker } from '@/components/FolderPicker';
import { TrimEditor } from '@/components/TrimEditor';
import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import {
  deleteLocalAffirmation,
  getLocalAffirmation,
  updateLocalAffirmationFolder,
  updateLocalAffirmationTitle,
  updateLocalAffirmationTrim,
  type LocalAffirmation,
} from '@/lib/affirmations.local';
import { listLocalFolders, type LocalFolder } from '@/lib/folders.local';

const ERROR_MESSAGE = 'Something went wrong. Please try again.';

export default function AffirmationTrimScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [affirmation, setAffirmation] = useState<LocalAffirmation | null | undefined>(undefined);
  const [folders, setFolders] = useState<LocalFolder[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadAffirmation = useCallback(() => {
    if (!id) return;
    getLocalAffirmation(id).then((result) => {
      setAffirmation(result);
      if (result) setTitle(result.title);
    });
  }, [id]);

  useEffect(loadAffirmation, [loadAffirmation]);

  useEffect(() => {
    if (user) listLocalFolders(user.id).then(setFolders);
  }, [user]);

  async function handleFolderSelect(folderId: string | null) {
    if (!affirmation) return;
    await updateLocalAffirmationFolder(affirmation.id, folderId);
    setAffirmation({ ...affirmation, folder_id: folderId });
  }

  async function handleTitleBlur() {
    if (!affirmation) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle === affirmation.title) {
      setTitle(affirmation.title);
      return;
    }
    try {
      await updateLocalAffirmationTitle(affirmation.id, trimmedTitle);
      setAffirmation({ ...affirmation, title: trimmedTitle });
    } catch {
      setError(ERROR_MESSAGE);
      setTitle(affirmation.title);
    }
  }

  function handleDelete() {
    if (!affirmation) return;
    Alert.alert('Delete recording?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteLocalAffirmation(affirmation.id);
          router.back();
        },
      },
    ]);
  }

  if (affirmation === undefined) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (affirmation === null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Recording not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <TextInput
        value={title}
        onChangeText={setTitle}
        onBlur={handleTitleBlur}
        placeholder="Title"
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.title,
          styles.titleInput,
          { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />

      <FolderPicker
        folders={folders}
        selectedFolderId={affirmation.folder_id}
        onSelect={handleFolderSelect}
      />

      <TrimEditor
        uri={affirmation.local_uri}
        durationMs={affirmation.duration_ms}
        initialTrimStartMs={affirmation.trim_start_ms}
        initialTrimEndMs={affirmation.trim_end_ms}
        onSave={async (trimStartMs, trimEndMs) => {
          await updateLocalAffirmationTrim(affirmation.id, trimStartMs, trimEndMs);
          router.back();
        }}
      />

      <Pressable
        onPress={handleDelete}
        accessibilityRole="button"
        style={[styles.deleteButton, { borderColor: colors.error }]}
      >
        <Text style={{ color: colors.error }}>Delete recording</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontWeight: typography.title.fontWeight,
    textAlign: 'center',
  },
  titleInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  error: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
  },
  deleteButton: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
