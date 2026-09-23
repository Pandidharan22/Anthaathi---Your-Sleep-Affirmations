import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import {
  deleteLocalGoal,
  getLocalGoal,
  updateLocalGoalImage,
  updateLocalGoalStatus,
  updateLocalGoalText,
  type LocalGoal,
} from '@/lib/goals.local';

const ERROR_MESSAGE = 'Something went wrong. Please try again.';

export default function GoalDetailScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [goal, setGoal] = useState<LocalGoal | null | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadGoal = useCallback(() => {
    if (!id) return;
    getLocalGoal(id).then((result) => {
      setGoal(result);
      if (result) {
        setTitle(result.title);
        setDescription(result.description);
      }
    });
  }, [id]);

  useEffect(loadGoal, [loadGoal]);

  async function handleTextBlur() {
    if (!goal) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitle(goal.title);
      return;
    }
    if (trimmedTitle === goal.title && description === goal.description) return;
    try {
      await updateLocalGoalText(goal.id, trimmedTitle, description);
      setGoal({ ...goal, title: trimmedTitle, description });
    } catch {
      setError(ERROR_MESSAGE);
      setTitle(goal.title);
      setDescription(goal.description);
    }
  }

  async function handlePickImage() {
    if (!goal) return;
    setError(null);
    const { granted, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      setError(
        canAskAgain
          ? 'Photo library access is needed to add an image.'
          : 'Photo library access is needed to add an image. Enable it for Anthaathi in your device Settings.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;

    try {
      const picked = new File(result.assets[0].uri);
      const dest = new File(Paths.document, `goal-image-${Date.now()}${picked.extension || '.jpg'}`);
      await picked.copy(dest);
      await updateLocalGoalImage(goal.id, dest.uri);
      setGoal({ ...goal, image_local_uri: dest.uri, image_path: null });
    } catch {
      setError('Could not use that image. Please try another.');
    }
  }

  async function handleRemoveImage() {
    if (!goal) return;
    try {
      await updateLocalGoalImage(goal.id, null);
      setGoal({ ...goal, image_local_uri: null, image_path: null });
    } catch {
      setError(ERROR_MESSAGE);
    }
  }

  async function handleToggleAchieved() {
    if (!goal) return;
    const nextStatus = goal.status === 'achieved' ? 'active' : 'achieved';
    try {
      await updateLocalGoalStatus(goal.id, nextStatus);
      setGoal({
        ...goal,
        status: nextStatus,
        achieved_at: nextStatus === 'achieved' ? new Date().toISOString() : null,
      });
    } catch {
      setError(ERROR_MESSAGE);
    }
  }

  function handleDelete() {
    if (!goal) return;
    Alert.alert('Delete goal?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteLocalGoal(goal.id);
          router.back();
        },
      },
    ]);
  }

  if (goal === undefined) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (goal === null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>Goal not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <TextInput
        value={title}
        onChangeText={setTitle}
        onBlur={handleTextBlur}
        placeholder="Title"
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.heading,
          styles.input,
          { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        onBlur={handleTextBlur}
        placeholder="Description"
        placeholderTextColor={colors.textSecondary}
        multiline
        style={[
          styles.input,
          styles.multiline,
          { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />

      {goal.image_local_uri ? (
        <View style={styles.imageRow}>
          <Image source={{ uri: goal.image_local_uri }} style={styles.imagePreview} accessibilityLabel="Goal image" />
          <View style={styles.imageActions}>
            <Pressable onPress={handlePickImage} accessibilityRole="button" hitSlop={8}>
              <Text style={{ color: colors.primary }}>Replace image</Text>
            </Pressable>
            <Pressable onPress={handleRemoveImage} accessibilityRole="button" hitSlop={8}>
              <Text style={{ color: colors.error }}>Remove image</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={handlePickImage}
          accessibilityRole="button"
          style={[styles.secondaryButton, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textPrimary }}>Add image (optional)</Text>
        </Pressable>
      )}

      <Pressable
        onPress={handleToggleAchieved}
        accessibilityRole="button"
        style={[styles.secondaryButton, { borderColor: colors.success }]}
      >
        <Text style={{ color: colors.success }}>
          {goal.status === 'achieved' ? 'Move back to active' : 'Mark achieved'}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleDelete}
        accessibilityRole="button"
        style={[styles.secondaryButton, { borderColor: colors.error }]}
      >
        <Text style={{ color: colors.error }}>Delete goal</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  heading: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontWeight: typography.title.fontWeight,
  },
  error: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
    fontSize: typography.body.fontSize,
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  imagePreview: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
  },
  imageActions: {
    gap: spacing.sm,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
