import { useAudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createAiGuidedAffirmation } from '@/lib/affirmations.local';
import { synthesizeAffirmationAudio, VOICE_OPTIONS } from '@/lib/aiVoice';
import { DEFAULT_VOICE_STYLE, type VoiceStyle } from '@/lib/voiceStyle';
import AnthaathiTts, { type AnthaathiVoice } from '@/modules/anthaathi-tts';

/**
 * Temporary, __DEV__-only screen for Execution Plan step 3.6/3.8's native module. Lists every
 * voice the device's TTS engine reports, and lets each be synthesized + played individually --
 * Android's Voice API has no gender field, so this is how real per-device voice data (names,
 * locales, and which ones actually sound male/female by ear) gets collected before step 3.8's
 * male/female curation can be written. Remove once step 3.10 builds the real voice picker.
 */
// Several short affirmations, so the pause between sentences can be judged as well as the pace.
const TEST_STRING =
  'I am deserving of unconditional love. My strength is permanent. I am calm, safe and at peace.';

// Step A (voice pacing): rate/pitch/pause are passed per request from JS, so these can be tuned
// by ear here without a rebuild; the winning values live in VOICE_OPTIONS (lib/aiVoice.ts).
const RATE_OPTIONS = [0.35, 0.45, 0.5, 0.6, 0.8, 1] as const;
const PITCH_OPTIONS = [0.7, 0.8, 0.9, 1] as const;
const PAUSE_OPTIONS = [1200, 1800, 2400, 3000] as const;

type SynthesisStatus = 'idle' | 'synthesizing' | 'ready' | 'error';

function StyleChips<T extends number>({
  label,
  options,
  value,
  format,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: number;
  format: (v: T) => string;
  onChange: (v: T) => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primary : 'transparent',
                },
              ]}
            >
              <Text style={{ color: selected ? colors.background : colors.textPrimary }}>
                {format(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function DevTtsTestScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const [voices, setVoices] = useState<AnthaathiVoice[] | null>(null);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);
  const [status, setStatus] = useState<SynthesisStatus>('idle');
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState<VoiceStyle>(DEFAULT_VOICE_STYLE);
  const player = useAudioPlayer(resultPath);

  // Step 3.9 real-device check: createAiGuidedAffirmation's measureDurationMs has never
  // touched a real audio file before this (only mocked in lib/aiVoice.test.ts) -- this proves
  // the whole pipeline (native synthesize -> real duration measurement -> local save -> sync)
  // for real, and the result should show up in the Library tab like any other recording.
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [pipelineResult, setPipelineResult] = useState('');

  async function handleCreateAiGuidedAffirmation() {
    if (!user) return;
    setPipelineStatus('running');
    setPipelineResult('');
    try {
      const affirmation = await createAiGuidedAffirmation({
        userId: user.id,
        title: 'Dev: AI Guided test',
        scriptText: TEST_STRING,
        voiceId: 'en-gb-x-gbd-local',
      });
      setPipelineResult(
        `Created ${affirmation.id}, duration_ms=${affirmation.duration_ms}. Check the Library tab.`,
      );
      setPipelineStatus('done');
    } catch (err) {
      setPipelineResult(err instanceof Error ? err.message : 'Pipeline failed.');
      setPipelineStatus('error');
    }
  }

  useEffect(() => {
    AnthaathiTts.listVoices()
      .then((result) => {
        const finalIds = new Set(VOICE_OPTIONS.map((v) => v.id));
        setVoices(result.filter((voice) => finalIds.has(voice.identifier)));
      })
      .catch((err) => setVoicesError(err instanceof Error ? err.message : 'Could not list voices.'));
  }, []);

  async function handleTest(voiceId: string) {
    setActiveVoiceId(voiceId);
    setStatus('synthesizing');
    setError(null);
    setResultPath(null);
    try {
      const { localUri } = await synthesizeAffirmationAudio(TEST_STRING, voiceId, style);
      setResultPath(localUri);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Synthesis failed.');
      setStatus('error');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Dev: on-device TTS test</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>&quot;{TEST_STRING}&quot;</Text>

      <Pressable
        onPress={handleCreateAiGuidedAffirmation}
        disabled={pipelineStatus === 'running' || !user}
        accessibilityRole="button"
        style={[styles.playButton, { borderColor: colors.primary, alignSelf: 'center' }]}
      >
        {pipelineStatus === 'running' ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={{ color: colors.primary }}>Create AI Guided affirmation (real pipeline)</Text>
        )}
      </Pressable>
      {pipelineResult ? (
        <Text
          style={[
            styles.body,
            { color: pipelineStatus === 'error' ? colors.error : colors.success },
          ]}
        >
          {pipelineResult}
        </Text>
      ) : null}

      <StyleChips
        label="Speech rate"
        options={RATE_OPTIONS}
        value={style.rate}
        format={(v) => `${v}`}
        onChange={(rate) => setStyle((prev) => ({ ...prev, rate }))}
      />
      <StyleChips
        label="Pitch"
        options={PITCH_OPTIONS}
        value={style.pitch}
        format={(v) => `${v}`}
        onChange={(pitch) => setStyle((prev) => ({ ...prev, pitch }))}
      />
      <StyleChips
        label="Pause between sentences"
        options={PAUSE_OPTIONS}
        value={style.sentencePauseMs}
        format={(v) => `${v / 1000}s`}
        onChange={(sentencePauseMs) => setStyle((prev) => ({ ...prev, sentencePauseMs }))}
      />
      <Text style={[styles.caption, { color: colors.textSecondary }]}>
        Tap a voice below to synthesize with these settings, then Play. The Library test button
        above uses each voice&apos;s saved style (VOICE_OPTIONS in lib/aiVoice.ts).
      </Text>

      {voicesError ? <Text style={[styles.body, { color: colors.error }]}>{voicesError}</Text> : null}
      {!voices && !voicesError ? <ActivityIndicator color={colors.primary} /> : null}

      {voices ? (
        <>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {voices.length} of {VOICE_OPTIONS.length} finalized voices found on this device
          </Text>
          <FlatList
            style={styles.list}
            data={voices}
            keyExtractor={(voice) => voice.identifier}
            renderItem={({ item }) => {
              const isActive = activeVoiceId === item.identifier;
              const option = VOICE_OPTIONS.find((v) => v.id === item.identifier);
              return (
                <Pressable
                  onPress={() => handleTest(item.identifier)}
                  disabled={status === 'synthesizing'}
                  accessibilityRole="button"
                  style={[styles.voiceRow, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.textPrimary }}>{item.identifier}</Text>
                  <Text style={[styles.caption, { color: colors.textSecondary }]}>
                    {option?.label} · {item.locale} · quality {item.quality} ·{' '}
                    {item.isNetworkConnectionRequired ? 'network' : 'offline'}
                  </Text>
                  {isActive && status === 'synthesizing' ? <ActivityIndicator color={colors.primary} /> : null}
                  {isActive && status === 'ready' && resultPath ? (
                    <Pressable
                      onPress={() => player.play()}
                      accessibilityRole="button"
                      style={[styles.playButton, { borderColor: colors.primary }]}
                    >
                      <Text style={{ color: colors.primary }}>Play</Text>
                    </Pressable>
                  ) : null}
                  {isActive && status === 'error' ? (
                    <Text style={[styles.caption, { color: colors.error }]}>{error}</Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.xl,
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
  caption: {
    fontSize: typography.caption.fontSize,
  },
  list: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  voiceRow: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  playButton: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
});
