import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PauseMarkHint } from '@/components/PauseMarkHint';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { NavHeader } from '@/components/ui/NavHeader';
import { TextField } from '@/components/ui/TextField';
import { gradientBackground } from '@/components/ui/gradient';
import { colors, fonts, gradients, typography } from '@/constants/theme';
import { requestAffirmationDraft, type DraftRefinement } from '@/lib/aiDraft';
import { DRAFT_ERROR_MESSAGES as ERROR_MESSAGES, goalDraftText } from '@/lib/draftCopy';
import { getLocalGoal, type LocalGoal } from '@/lib/goals.local';
import { countWords, estimateReadMs, SCRIPT_MAX_LENGTH } from '@/lib/scriptStats';

type ScreenState = 'loading' | 'drafting' | 'ready' | 'error';

const REFINEMENTS: { refine: DraftRefinement; label: string }[] = [
  { refine: 'softer', label: 'Softer' },
  { refine: 'shorter', label: 'Shorter' },
  { refine: 'vivid', label: 'More vivid' },
  { refine: 'another', label: 'Try another' },
];

/**
 * FR-501/FR-502, redesigned in R.6b (mockup #15): a draft from the goal, shown as the
 * suggestion, with Softer / Shorter / More vivid / Try another to rework it and an Edit field
 * for the user's own changes. Refinements rewrite the Edit field's text, so edits are kept
 * (user's choice); Try another starts fresh from the goal. Nothing is narrated until the user
 * records it or picks an AI voice (FR-502).
 */
export default function DraftAffirmationScreen() {
  const insets = useSafeAreaInsets();
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const [state, setState] = useState<ScreenState>(goalId ? 'loading' : 'error');
  const [goal, setGoal] = useState<LocalGoal | null>(null);
  // The AI's latest text, and the user's working copy of it.
  const [suggestion, setSuggestion] = useState('');
  const [draftText, setDraftText] = useState('');
  const [errorMessage, setErrorMessage] = useState(goalId ? '' : 'Missing goal.');
  const [refining, setRefining] = useState<DraftRefinement | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);

  const showDraft = (text: string) => {
    const trimmed = text.trim().slice(0, SCRIPT_MAX_LENGTH);
    setSuggestion(trimmed);
    setDraftText(trimmed);
  };

  const requestDraft = useCallback(async (target: LocalGoal) => {
    setState('drafting');
    try {
      const result = await requestAffirmationDraft(target.id, goalDraftText(target));
      if (result.ok) {
        showDraft(result.draftText);
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

  async function handleRefine(refine: DraftRefinement) {
    if (!goal) return;
    setRefining(refine);
    setRefineError(null);
    try {
      const result = await requestAffirmationDraft(goal.id, goalDraftText(goal), {
        refine,
        currentText: draftText.trim() || suggestion,
      });
      if (result.ok) showDraft(result.draftText);
      else setRefineError(ERROR_MESSAGES[result.kind]);
    } catch {
      setRefineError(ERROR_MESSAGES.unknown);
    } finally {
      setRefining(null);
    }
  }

  function handleAccept(pathname: '/record' | '/ai-guided/script') {
    const params = { scriptText: draftText.trim(), suggestedTitle: goal?.title ?? '' };
    router.replace({
      pathname,
      // The Script step offers Redraft from this goal (R.6a).
      params: pathname === '/ai-guided/script' && goal ? { ...params, goalId: goal.id } : params,
    });
  }

  if (state === 'loading' || state === 'drafting') {
    return (
      <View style={styles.root}>
        <NavHeader title="Draft" leading="back" onLeadingPress={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.action} />
          <Text style={styles.waiting}>
            {state === 'loading' ? 'Loading goal…' : 'Drafting your affirmation…'}
          </Text>
        </View>
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={styles.root}>
        <NavHeader title="Draft" leading="back" onLeadingPress={() => router.back()} />
        <View style={styles.center}>
          <Text accessibilityLiveRegion="polite" style={styles.errorBody}>
            {errorMessage}
          </Text>
        </View>
        <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
          {goal ? <Button label="Try again" onPress={() => requestDraft(goal)} /> : null}
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const words = countWords(suggestion);
  const readSeconds = Math.max(1, Math.round(estimateReadMs(suggestion) / 1000));
  const canUse = draftText.trim().length > 0 && !refining;

  return (
    <View style={styles.root}>
      <NavHeader title="Draft" leading="back" onLeadingPress={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {goal ? (
            <Card style={styles.goalCard}>
              <View style={[styles.goalDot, gradientBackground(gradients.actionFill)]} />
              <Text style={styles.goalText} numberOfLines={2}>
                From your goal <Text style={styles.goalTitle}>{goal.title}</Text>
              </Text>
            </Card>
          ) : null}

          <View style={styles.section}>
            <Text style={[typography.label, styles.label]}>Suggested affirmation</Text>
            <Card mesh style={styles.suggestionCard}>
              {refining ? (
                <View style={styles.rewriting} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={colors.action} />
                  <Text style={styles.meta}>Rewriting…</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.suggestion}>“{suggestion}”</Text>
                  <Text style={styles.meta}>
                    {words} {words === 1 ? 'word' : 'words'} · reads in ~{readSeconds}s
                  </Text>
                </>
              )}
            </Card>
          </View>

          <View style={styles.chips}>
            {REFINEMENTS.map(({ refine, label }) => (
              <Chip
                key={refine}
                label={label}
                selected={refining === refine}
                onPress={refining ? undefined : () => handleRefine(refine)}
              />
            ))}
          </View>

          {refineError ? (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {refineError}
            </Text>
          ) : null}

          <TextField
            label="Edit"
            variant="script"
            value={draftText}
            onChangeText={setDraftText}
            maxLength={SCRIPT_MAX_LENGTH}
            multiline
          />
          <PauseMarkHint />
        </ScrollView>

        <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
          <Button
            label="Record this"
            icon="mic"
            disabled={!canUse}
            onPress={() => handleAccept('/record')}
          />
          <Button
            label="Use an AI voice"
            variant="secondary"
            disabled={!canUse}
            onPress={() => handleAccept('/ai-guided/script')}
          />
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  waiting: {
    ...typography.quote,
    color: colors.textSecondary,
  },
  errorBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 18,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  goalText: {
    ...typography.caption,
    flex: 1,
    color: colors.textSecondary,
  },
  goalTitle: {
    fontFamily: fonts.sansSemiBold,
    color: colors.textPrimary,
  },
  section: {
    gap: 8,
  },
  label: {
    color: colors.textSecondary,
  },
  suggestionCard: {
    padding: 20,
    gap: 14,
  },
  suggestion: {
    ...typography.script,
    fontSize: 20,
    lineHeight: 29,
    color: colors.textPrimary,
  },
  rewriting: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    // Room for the chips' extended touch area (hit slop can't reach past the parent).
    paddingVertical: 10,
    marginVertical: -10,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
  },
  actions: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 12,
  },
});
