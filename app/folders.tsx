import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import {
  createLocalFolder,
  deleteLocalFolder,
  listLocalFolders,
  renameLocalFolder,
  type LocalFolder,
} from '@/lib/folders.local';

const ERROR_MESSAGE = 'Something went wrong. Please try again.';

export default function FoldersScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const [folders, setFolders] = useState<LocalFolder[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (user) listLocalFolders(user.id).then(setFolders);
  }, [user]);

  useFocusEffect(refresh);

  async function handleCreate() {
    const name = newFolderName.trim();
    if (!user || !name) return;
    setError(null);
    try {
      await createLocalFolder(user.id, name);
      setNewFolderName('');
      refresh();
    } catch {
      setError(ERROR_MESSAGE);
    }
  }

  function startEditing(folder: LocalFolder) {
    setError(null);
    setEditingId(folder.id);
    setEditingName(folder.name);
  }

  async function saveEditing() {
    const name = editingName.trim();
    if (editingId && name) {
      try {
        await renameLocalFolder(editingId, name);
      } catch {
        setError(ERROR_MESSAGE);
      }
    }
    setEditingId(null);
    refresh();
  }

  function confirmDelete(folder: LocalFolder) {
    Alert.alert('Delete folder?', `Recordings in "${folder.name}" will become unfiled.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setError(null);
          try {
            await deleteLocalFolder(folder.id);
            refresh();
          } catch {
            setError(ERROR_MESSAGE);
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <View style={styles.row}>
        <TextInput
          value={newFolderName}
          onChangeText={setNewFolderName}
          placeholder="New folder name"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        />
        <Pressable
          onPress={handleCreate}
          accessibilityRole="button"
          style={[styles.createButton, { backgroundColor: colors.primary }]}
        >
          <Text style={{ color: colors.background, fontWeight: '600' }}>Create</Text>
        </Pressable>
      </View>

      {folders.length === 0 ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          No folders yet — create one above.
        </Text>
      ) : (
        <FlatList
          data={folders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) =>
            editingId === item.id ? (
              <View style={[styles.folderRow, { borderColor: colors.border }]}>
                <TextInput
                  value={editingName}
                  onChangeText={setEditingName}
                  autoFocus
                  style={[styles.input, styles.editInput, { color: colors.textPrimary, borderColor: colors.border }]}
                />
                <Pressable onPress={saveEditing} accessibilityRole="button">
                  <Text style={{ color: colors.primary }}>Save</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.folderRow, { borderColor: colors.border }]}>
                <Text style={[styles.folderName, { color: colors.textPrimary }]}>{item.name}</Text>
                <View style={styles.actions}>
                  <Pressable onPress={() => startEditing(item)} accessibilityRole="button">
                    <Text style={{ color: colors.primary }}>Rename</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmDelete(item)} accessibilityRole="button">
                    <Text style={{ color: colors.error }}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            )
          }
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
  },
  createButton: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  error: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
  },
  list: {
    gap: spacing.sm,
  },
  folderRow: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  folderName: {
    fontSize: typography.body.fontSize,
    flexShrink: 1,
  },
  editInput: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
