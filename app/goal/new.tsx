import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createLocalGoal } from '@/lib/goals.local';

export default function NewGoalScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageLocalUri, setImageLocalUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handlePickImage() {
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
      setImageLocalUri(dest.uri);
    } catch {
      setError('Could not use that image. Please try another.');
    }
  }

  function handleRemoveImage() {
    if (imageLocalUri) {
      try {
        new File(imageLocalUri).delete();
      } catch {
        // Best-effort cleanup; a stray file isn't a correctness issue.
      }
    }
    setImageLocalUri(null);
  }

  async function handleSave() {
    if (!user) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Give this goal a title before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createLocalGoal({
        userId: user.id,
        title: trimmedTitle,
        description: description.trim(),
        imageLocalUri,
      });
      router.back();
    } catch {
      setError('Could not save the goal. Please try again.');
      setSaving(false);
    }
  }

  if (saving) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.heading, { color: colors.textPrimary }]}>New goal</Text>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Description"
        placeholderTextColor={colors.textSecondary}
        multiline
        style={[
          styles.input,
          styles.multiline,
          { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />

      {imageLocalUri ? (
        <View style={styles.imageRow}>
          <Image source={{ uri: imageLocalUri }} style={styles.imagePreview} accessibilityLabel="Selected goal image" />
          <Pressable onPress={handleRemoveImage} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: colors.error }}>Remove image</Text>
          </Pressable>
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
        onPress={handleSave}
        accessibilityRole="button"
        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.primaryButtonLabel, { color: colors.background }]}>Save</Text>
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
    fontSize: typography.body.fontSize,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
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
  secondaryButton: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryButtonLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
});
