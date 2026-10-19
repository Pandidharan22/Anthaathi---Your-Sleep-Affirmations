import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PauseMarkHint } from '@/components/PauseMarkHint';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NavHeader } from '@/components/ui/NavHeader';
import { StepDots } from '@/components/ui/StepDots';
import { gradientBackground } from '@/components/ui/gradient';
import { colors, fonts, gradients, radii, typography } from '@/constants/theme';
import { requestAffirmationDraft } from '@/lib/aiDraft';
import { DRAFT_ERROR_MESSAGES, goalDraftText } from '@/lib/draftCopy';
import { getLocalGoal, type LocalGoal } from '@/lib/goals.local';
import {
  countSentences,
  estimateReadMs,
  SCRIPT_MAX_LENGTH,
  titleFromScript,
} from '@/lib/scriptStats';

/**
 * AI Guided, step 1 of 3 (R.6a): the words to be read. Started from Mode Choice (with the
 * folder it was opened from) or from a goal's draft, which adds a "From your goal" card
 * with Redraft. Continue goes to the voice step; nothing is saved until generating ends.
 */
export default function ScriptScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    scriptText?: string;
    suggestedTitle?: string;
    folderId?: string;
    goalId?: string;
  }>();
  const [script, setScript] = useState((params.scriptText ?? '').slice(0, SCRIPT_MAX_LENGTH));
  const [focused, setFocused] = useState(false);
  const [goal, setGoal] = useState<LocalGoal | null>(null);
  const [redrafting, setRedrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.goalId) getLocalGoal(params.goalId).then(setGoal);
  }, [params.goalId]);

  async function handleRedraft() {
    if (!goal) return;
    setRedrafting(true);
    setError(null);
    try {
      const result = await requestAffirmationDraft(goal.id, goalDraftText(goal));
      if (result.ok) setScript(result.draftText.trim().slice(0, SCRIPT_MAX_LENGTH));
      else setError(DRAFT_ERROR_MESSAGES[result.kind]);
    } catch {
      setError(DRAFT_ERROR_MESSAGES.unknown);
    } finally {
      setRedrafting(false);
    }
  }

  function handleContinue() {
    const trimmed = script.trim();
    router.push({
      pathname: '/ai-guided/voice',
      params: {
        scriptText: trimmed,
        title: params.suggestedTitle || titleFromScript(trimmed),
        ...(params.folderId ? { folderId: params.folderId } : {}),
      },
    });
  }

  const sentences = countSentences(script);
  const readSeconds = Math.max(1, Math.round(estimateReadMs(script) / 1000));
  const canContinue = sentences > 0;

  return (
    <View style={styles.root}>
      <NavHeader title="Write your script" leading="back" onLeadingPress={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <StepDots step={1} total={3} />
          <Text style={styles.hint}>Short, present-tense sentences work best.</Text>

          <View>
            <TextInput
              value={script}
              onChangeText={setScript}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              maxLength={SCRIPT_MAX_LENGTH}
              multiline
              placeholder="I am calm and ready for rest."
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Your script"
              accessibilityHint="Short, present-tense sentences work best."
              style={[styles.script, focused && styles.focused]}
            />
            <View style={styles.stats}>
              <Text style={styles.statsText}>
                {sentences === 0
                  ? 'Nothing to read yet'
                  : `${sentences} ${sentences === 1 ? 'sentence' : 'sentences'} · reads in ~${readSeconds}s`}
              </Text>
              <Text
                style={[styles.statsText, styles.count]}
                accessibilityLabel={`${script.length} of ${SCRIPT_MAX_LENGTH} characters`}
              >
                {script.length} / {SCRIPT_MAX_LENGTH}
              </Text>
            </View>
          </View>

          <PauseMarkHint />

          {goal ? (
            <Card style={styles.goalCard}>
              <View style={[styles.goalMark, gradientBackground(gradients.actionFill)]} />
              <View style={styles.flex}>
                <Text style={styles.goalLabel}>From your goal</Text>
                <Text style={styles.goalTitle} numberOfLines={1}>
                  {goal.title}
                </Text>
              </View>
              <Button
                label="✨ Redraft"
                variant="ghost"
                tone="accent"
                loading={redrafting}
                accessibilityLabel="Redraft from this goal"
                onPress={handleRedraft}
                style={styles.redraft}
              />
            </Card>
          ) : null}

          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
          <Button label="Continue" disabled={!canContinue} onPress={handleContinue} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 18,
  },
  hint: {
    ...typography.quote,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 6,
  },
  script: {
    minHeight: 200,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...typography.script,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  // Same focus ring as TextField.
  focused: {
    borderColor: 'rgba(195, 174, 218, 0.4)',
    boxShadow:
      '0px 0px 0px 4px rgba(169, 143, 196, 0.12), 0px 0px 24px -4px rgba(169, 143, 196, 0.35)',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statsText: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  count: {
    color: colors.textSecondary,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goalMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },
  goalLabel: {
    ...typography.caption,
    color: colors.accent,
    fontFamily: fonts.sansBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  goalTitle: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
    marginTop: 4,
  },
  redraft: {
    paddingHorizontal: 10,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
  },
  actions: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
});
