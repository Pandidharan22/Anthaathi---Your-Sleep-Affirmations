import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { requestAffirmationDraft, type DraftErrorKind } from '@/lib/aiDraft';
import { getLocalGoal, type LocalGoal } from '@/lib/goals.local';

type ScreenState = 'loading' | 'drafting' | 'ready' | 'error';

// invalid_request and unknown intentionally share copy: neither is something the
// user did wrong or can act on differently, so there's no reason to distinguish
// them on screen (kept distinct in DraftErrorKind for future debugging/telemetry).
const ERROR_MESSAGES: Record<DraftErrorKind, string> = {
  rate_limited: "You've reached the limit for AI drafts for now — try again in a little while.",
  provider_unavailable: "Drafting isn't working right now. Please try again shortly.",
  invalid_request: 'Something went wrong. Please try again.',
  unknown: 'Something went wrong. Please try again.',
};

/** FR-501/FR-502: draft an affirmation from a goal, then let the user edit/accept/discard before recording. */
export default function DraftAffirmationScreen() {
  const colors = useThemeColors();
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const [state, setState] = useState<ScreenState>(goalId ? 'loading' : 'error');
  const [goal, setGoal] = useState<LocalGoal | null>(null);
  const [draftText, setDraftText] = useState('');
  const [errorMessage, setErrorMessage] = useState(goalId ? '' : 'Missing goal.');

  const requestDraft = useCallback(async (target: LocalGoal) => {
    setState('drafting');
    const goalText = target.description.trim()
      ? `${target.title}: ${target.description}`
      : target.title;
    try {
      const result = await requestAffirmationDraft(target.id, goalText);
      if (result.ok) {
        setDraftText(result.draftText);
        setState('ready');
      } else {
        setErrorMessage(ERROR_MESSAGES[result.kind]);
        setState('error');
      }
    } catch {
      // requestAffirmationDraft shouldn't throw, but FR-503 requires this screen
      // never gets stuck (e.g. an infinite spinner) no matter what goes wrong.
      setErrorMessage(ERROR_MESSAGES.unknown);
      setState('error');
    }
  }, []);

  useEffect(() => {
    if (!goalId) return;
    getLocalGoal(goalId).then((found) => {
      setGoal(found);
      if (found) {
        requestDraft(found);
      } else {
        setErrorMessage('Goal not found.');
        setState('error');
      }
    });
  }, [goalId, requestDraft]);

  function handleAccept() {
    router.replace({
      pathname: '/record',
      params: { scriptText: draftText.trim(), suggestedTitle: goal?.title ?? '' },
    });
  }

  if (state === 'loading' || state === 'drafting') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {state === 'loading' ? 'Loading goal…' : 'Drafting your affirmation…'}
        </Text>
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Couldn&apos;t draft an affirmation</Text>
        <Text style={[styles.body, { color: colors.error }]}>{errorMessage}</Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={[styles.secondaryButton, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.textPrimary }}>Cancel</Text>
          </Pressable>
          {goal ? (
            <Pressable
              onPress={() => requestDraft(goal)}
              accessibilityRole="button"
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.primaryButtonLabel, { color: colors.background }]}>Try again</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Your draft affirmation</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Edit it until it feels right, then record it in your own voice.
      </Text>

      <TextInput
        value={draftText}
        onChangeText={setDraftText}
        multiline
        style={[
          styles.draftInput,
          { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />

      <View style={styles.row}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          style={[styles.secondaryButton, { borderColor: colors.error }]}
        >
          <Text style={{ color: colors.error }}>Discard</Text>
        </Pressable>
        <Pressable
          onPress={handleAccept}
          disabled={!draftText.trim()}
          accessibilityRole="button"
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.primaryButtonLabel, { color: colors.background }]}>Record this</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.lg,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontWeight: typography.title.fontWeight,
  },
  body: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  draftInput: {
    width: '100%',
    minHeight: 140,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
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
    flex: 1,
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
