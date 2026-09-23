import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createLocalJournalEntry } from '@/lib/journal.local';
import { getDailyPrompt } from '@/lib/journalPrompts';

export default function NewJournalEntryScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const dailyPrompt = getDailyPrompt();

  const [usePrompt, setUsePrompt] = useState(true);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user) return;
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setError('Write something before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createLocalJournalEntry({
        userId: user.id,
        prompt: usePrompt ? dailyPrompt : null,
        body: trimmedBody,
      });
      router.back();
    } catch {
      setError('Could not save your entry. Please try again.');
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
      <Text style={[styles.heading, { color: colors.textPrimary }]}>New journal entry</Text>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      {usePrompt ? (
        <View style={styles.promptRow}>
          <Text style={[styles.prompt, { color: colors.accentText }]}>{dailyPrompt}</Text>
          <Pressable
            onPress={() => setUsePrompt(false)}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={{ color: colors.primary }}>Write freeform instead</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setUsePrompt(true)} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: colors.primary }}>Use today&apos;s prompt instead</Text>
        </Pressable>
      )}

      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Write what's on your mind…"
        placeholderTextColor={colors.textSecondary}
        multiline
        autoFocus
        style={[
          styles.input,
          { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />

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
  promptRow: {
    gap: spacing.sm,
  },
  prompt: {
    fontSize: typography.subtitle.fontSize,
    fontStyle: 'italic',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
    textAlignVertical: 'top',
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
