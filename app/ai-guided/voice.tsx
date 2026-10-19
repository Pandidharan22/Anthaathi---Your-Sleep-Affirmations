import { useAudioPlayer } from 'expo-audio';
import { File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeneratingOrb } from '@/components/GeneratingOrb';
import { VoiceCard, type VoicePreviewState } from '@/components/VoiceCard';
import { Button } from '@/components/ui/Button';
import { DuskBackground } from '@/components/ui/DuskBackground';
import { gradientBackground } from '@/components/ui/gradient';
import { Icon } from '@/components/ui/Icon';
import { NavHeader } from '@/components/ui/NavHeader';
import { StepDots } from '@/components/ui/StepDots';
import { colors, gradients, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useNeuralVoiceStatus } from '@/hooks/useNeuralVoiceStatus';
import { createAiGuidedAffirmation, GenerationCancelledError } from '@/lib/affirmations.local';
import {
  getDefaultVoiceId,
  getVoiceOption,
  NATURAL_VOICE_OPTIONS,
  synthesizeAffirmationAudio,
  SYSTEM_VOICE_OPTIONS,
} from '@/lib/aiVoice';
import { NeuralModelMissingError } from '@/lib/neuralVoice';
import { estimateGenerationMs, firstSentence } from '@/lib/scriptStats';

type Step = 'choose' | 'generating' | 'error';
type Preview = { voiceId: string; state: Exclude<VoicePreviewState, 'idle'> } | null;

/**
 * AI Guided, steps 2 and 3 of 3 (R.6a): choose a voice (each can be previewed reading the
 * first sentence of the script), then generate on the device. Generating can be cancelled;
 * a failure keeps the script and offers Try again. When it's done, the flow closes and the
 * new recording opens (R.5d's screen), where it can be renamed, filed and trimmed.
 */
export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    scriptText = '',
    title = '',
    folderId,
  } = useLocalSearchParams<{
    scriptText?: string;
    title?: string;
    folderId?: string;
  }>();
  const naturalInstalled = useNeuralVoiceStatus().state === 'installed';
  const [voiceId, setVoiceId] = useState(() => getDefaultVoiceId(naturalInstalled));
  const [step, setStep] = useState<Step>('choose');
  const [failure, setFailure] = useState<'voices-missing' | 'other'>('other');
  const [preview, setPreview] = useState<Preview>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Previews: one player, and each voice's clip kept while on this screen.
  const player = useAudioPlayer(null);
  const clips = useRef(new Map<string, string>());
  // Each generation gets a number; Cancel moves it on, so a run that finishes after being
  // cancelled (synthesis can't be stopped part way) sees it's stale and saves nothing.
  const run = useRef(0);
  const unmounted = useRef(false);

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) setPreview(null);
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    const files = clips.current;
    return () => {
      unmounted.current = true;
      for (const uri of files.values()) {
        try {
          new File(uri).delete();
        } catch {
          // Best-effort cleanup of preview clips.
        }
      }
    };
  }, []);

  const voice = getVoiceOption(voiceId);

  async function handlePreview(id: string) {
    // The voice engines take one request at a time.
    if (preview?.state === 'loading') return;
    setVoiceId(id);
    setPreviewError(null);
    if (preview?.voiceId === id && preview.state === 'playing') {
      player.pause();
      setPreview(null);
      return;
    }
    player.pause();
    let uri = clips.current.get(id);
    if (!uri) {
      setPreview({ voiceId: id, state: 'loading' });
      try {
        uri = (await synthesizeAffirmationAudio(firstSentence(scriptText) || scriptText, id))
          .localUri;
        clips.current.set(id, uri);
      } catch (err) {
        setPreview(null);
        setPreviewError(
          err instanceof NeuralModelMissingError
            ? err.message
            : "Couldn't play a preview. You can still choose this voice.",
        );
        return;
      }
      if (unmounted.current) return;
    }
    player.replace(uri);
    player.play();
    setPreview({ voiceId: id, state: 'playing' });
  }

  async function handleGenerate() {
    if (!user || !voice) return;
    player.pause();
    setPreview(null);
    const thisRun = ++run.current;
    const isCancelled = () => unmounted.current || run.current !== thisRun;
    setStep('generating');
    try {
      const created = await createAiGuidedAffirmation(
        {
          userId: user.id,
          title,
          folderId: folderId ?? null,
          scriptText,
          voiceId,
        },
        { isCancelled },
      );
      // Cancelled while it was being saved: it's kept (it shows in its folder), but the
      // user has moved on, so don't jump to it.
      if (isCancelled()) return;
      // Close the flow (this step and the script) and open the new recording.
      router.dismiss(2);
      router.push(`/affirmation/${created.id}`);
    } catch (err) {
      if (err instanceof GenerationCancelledError || isCancelled()) return;
      setFailure(err instanceof NeuralModelMissingError ? 'voices-missing' : 'other');
      setStep('error');
    }
  }

  function handleCancel() {
    run.current++;
    setStep('choose');
  }

  if (step === 'generating' && voice) {
    return (
      <GeneratingView
        voiceLabel={voice.label}
        estimateMs={estimateGenerationMs(scriptText, voice.engine)}
        bottomInset={insets.bottom}
        onCancel={handleCancel}
      />
    );
  }

  if (step === 'error') {
    return (
      <View style={styles.root}>
        <NavHeader leading="back" onLeadingPress={() => router.back()} />
        <View style={styles.errorBody}>
          <View style={styles.errorOrb}>
            <Icon name="warning" color={colors.error} size={32} />
          </View>
          <Text accessibilityRole="header" style={styles.heading}>
            Couldn&apos;t generate audio
          </Text>
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {failure === 'voices-missing'
              ? "The natural voices aren't on this phone right now. Choose a basic voice, or download them in Settings."
              : 'Something got in the way. Your script is safe — try again, or make a small edit.'}
          </Text>
        </View>
        <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
          {failure === 'voices-missing' ? (
            <Button
              label="Choose another voice"
              variant="secondary"
              onPress={() => setStep('choose')}
            />
          ) : (
            <Button label="↻ Try again" variant="secondary" onPress={handleGenerate} />
          )}
          <Button label="Back to script" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const previewState = (id: string): VoicePreviewState =>
    preview?.voiceId === id ? preview.state : 'idle';

  return (
    <View style={styles.root}>
      <NavHeader title="Choose a voice" leading="back" onLeadingPress={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <StepDots step={2} total={3} />
        <Text style={styles.hint}>Tap to preview. The chosen voice reads your script.</Text>

        <View accessibilityRole="radiogroup" style={styles.list}>
          {NATURAL_VOICE_OPTIONS.map((v) => (
            <VoiceCard
              key={v.id}
              voice={v}
              selected={v.id === voiceId}
              disabled={!naturalInstalled}
              preview={previewState(v.id)}
              onSelect={() => setVoiceId(v.id)}
              onPreview={() => handlePreview(v.id)}
            />
          ))}
          {!naturalInstalled ? (
            <Pressable
              onPress={() => router.navigate('/settings')}
              accessibilityRole="link"
              hitSlop={8}
            >
              <Text style={styles.link}>Download the natural voices in Settings to use them.</Text>
            </Pressable>
          ) : null}
          {SYSTEM_VOICE_OPTIONS.map((v) => (
            <VoiceCard
              key={v.id}
              voice={v}
              selected={v.id === voiceId}
              preview={previewState(v.id)}
              onSelect={() => setVoiceId(v.id)}
              onPreview={() => handlePreview(v.id)}
            />
          ))}
        </View>

        {previewError ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {previewError}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
        <Button
          label={voice ? `Continue with ${voice.label}` : 'Continue'}
          disabled={
            !voice ||
            (voice.engine === 'natural' && !naturalInstalled) ||
            preview?.state === 'loading'
          }
          onPress={handleGenerate}
        />
      </View>
    </View>
  );
}

function GeneratingView({
  voiceLabel,
  estimateMs,
  bottomInset,
  onCancel,
}: {
  voiceLabel: string;
  estimateMs: number;
  bottomInset: number;
  onCancel: () => void;
}) {
  // There's no real progress to report, so the bar eases toward 90% over the estimate and
  // waits there; finishing closes this screen anyway.
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 0.9,
      duration: estimateMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, estimateMs]);
  const seconds = Math.max(2, Math.round(estimateMs / 1000));

  return (
    <View style={styles.root}>
      <DuskBackground opacity={0.7} />
      <NavHeader title="Step 3 of 3" titleStyle="quiet" />
      <View style={styles.generating}>
        <GeneratingOrb />
        <View style={styles.generatingText}>
          <Text accessibilityRole="header" style={styles.heading}>
            Creating your affirmation…
          </Text>
          <Text accessibilityLiveRegion="polite" style={styles.quote}>
            {voiceLabel} is settling into your words.
          </Text>
          <View style={styles.track} aria-hidden>
            <Animated.View
              style={[
                styles.fill,
                gradientBackground(gradients.actionFill),
                { transform: [{ scaleX: progress }] },
              ]}
            />
          </View>
          <Text style={styles.caption}>On-device · about {seconds} seconds</Text>
        </View>
      </View>
      <View style={[styles.actions, { paddingBottom: bottomInset + 24 }]}>
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
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
  },
  list: {
    gap: 10,
  },
  link: {
    ...typography.caption,
    color: colors.accent,
    paddingHorizontal: 4,
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
  generating: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 32,
  },
  generatingText: {
    alignItems: 'center',
  },
  heading: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  quote: {
    ...typography.quote,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  track: {
    width: 220,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginTop: 28,
  },
  fill: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
    transformOrigin: 'left',
  },
  caption: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 10,
  },
  errorBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(224, 122, 138, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
});
