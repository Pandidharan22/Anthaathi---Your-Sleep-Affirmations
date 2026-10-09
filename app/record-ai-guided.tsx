import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FolderPicker } from '@/components/FolderPicker';
import { PauseMarkHint } from '@/components/PauseMarkHint';
import { VoicePicker } from '@/components/VoicePicker';
import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createAiGuidedAffirmation } from '@/lib/affirmations.local';
import { getDefaultVoiceId } from '@/lib/aiVoice';
import { listLocalFolders, type LocalFolder } from '@/lib/folders.local';
import { getNeuralVoiceStatus, NeuralModelMissingError } from '@/lib/neuralVoice';

/** FR-511/FR-513/FR-515: create an AI Guided affirmation -- script + voice, synthesized on-device. */
export default function RecordAiGuidedScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { scriptText: initialScriptText, suggestedTitle } = useLocalSearchParams<{
    scriptText?: string;
    suggestedTitle?: string;
  }>();

  const [title, setTitle] = useState(suggestedTitle ?? '');
  const [scriptText, setScriptText] = useState(initialScriptText ?? '');
  const [voiceId, setVoiceId] = useState(() =>
    getDefaultVoiceId(getNeuralVoiceStatus().state === 'installed'),
  );
  const [folders, setFolders] = useState<LocalFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) listLocalFolders(user.id).then(setFolders);
  }, [user]);

  async function handleGenerate() {
    if (!user) return;
    const trimmedTitle = title.trim();
    const trimmedScript = scriptText.trim();
    if (!trimmedTitle) {
      setError('Give this affirmation a title before generating.');
      return;
    }
    if (!trimmedScript) {
      setError('Enter the affirmation text before generating.');
      return;
    }
    if (!voiceId) {
      setError('Choose a voice before generating.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      await createAiGuidedAffirmation({
        userId: user.id,
        title: trimmedTitle,
        folderId: selectedFolderId,
        scriptText: trimmedScript,
        voiceId,
      });
      router.back();
    } catch (err) {
      setError(
        err instanceof NeuralModelMissingError
          ? err.message
          : 'Could not generate the affirmation. Please try again.',
      );
      setGenerating(false);
    }
  }

  if (generating) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.body, { color: colors.textSecondary }]}>Generating… this can take a moment.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>AI Guided affirmation</Text>

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
        value={scriptText}
        onChangeText={setScriptText}
        placeholder="What should this affirmation say?"
        placeholderTextColor={colors.textSecondary}
        multiline
        style={[
          styles.input,
          styles.scriptInput,
          { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />
      <PauseMarkHint />

      <VoicePicker value={voiceId} onChange={setVoiceId} />

      <FolderPicker folders={folders} selectedFolderId={selectedFolderId} onSelect={setSelectedFolderId} />

      <Pressable
        onPress={handleGenerate}
        accessibilityRole="button"
        style={[styles.generateButton, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.generateButtonLabel, { color: colors.background }]}>Generate</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontWeight: typography.title.fontWeight,
    textAlign: 'center',
  },
  body: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
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
  scriptInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  generateButton: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  generateButtonLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
});
