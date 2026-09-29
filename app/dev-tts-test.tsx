import { useAudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import AnthaathiTts, { type AnthaathiVoice } from '@/modules/anthaathi-tts';

/**
 * Temporary, __DEV__-only screen for Execution Plan step 3.6/3.8's native module. Lists every
 * voice the device's TTS engine reports, and lets each be synthesized + played individually --
 * Android's Voice API has no gender field, so this is how real per-device voice data (names,
 * locales, and which ones actually sound male/female by ear) gets collected before step 3.8's
 * male/female curation can be written. Remove once step 3.10 builds the real voice picker.
 */
const TEST_STRING = 'This is a test of on-device speech synthesis for Anthaathi.';

type SynthesisStatus = 'idle' | 'synthesizing' | 'ready' | 'error';

// Round 2 of voice curation: narrowed from a first pass over this device's full ~473-voice
// list (every installed language, not just English) down to the 8 English voices that sounded
// good by ear -- gender and quality notes are the user's own, since Android's Voice API has no
// such fields. Final pick is 2 male + 2 female from these, made by re-listening on-device.
const CANDIDATE_VOICES: { identifier: string; gender: 'male' | 'female'; note?: string }[] = [
  { identifier: 'en-gb-x-gba-local', gender: 'female' },
  { identifier: 'en-gb-x-gbb-network', gender: 'male' },
  { identifier: 'en-AU-language', gender: 'female' },
  { identifier: 'en-us-x-tpf-local', gender: 'female', note: 'clear, liked' },
  { identifier: 'en-gb-x-rjs-local', gender: 'male', note: 'liked' },
  { identifier: 'en-gb-x-gbd-local', gender: 'male', note: 'liked' },
  { identifier: 'en-us-x-tpc-network', gender: 'female', note: 'liked' },
  { identifier: 'en-us-x-tpc-local', gender: 'female', note: 'liked' },
];

// Top-level (not nested inside the component/FlatList renderItem closures) so the
// react-hooks purity lint rule doesn't flag Date.now() as possibly reachable during render.
function makeOutputFile(): File {
  return new File(Paths.document, `tts-test-${Date.now()}.wav`);
}

export default function DevTtsTestScreen() {
  const colors = useThemeColors();
  const [voices, setVoices] = useState<AnthaathiVoice[] | null>(null);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);
  const [status, setStatus] = useState<SynthesisStatus>('idle');
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const player = useAudioPlayer(resultPath);

  useEffect(() => {
    AnthaathiTts.listVoices()
      .then((result) => {
        const candidateIds = new Set(CANDIDATE_VOICES.map((c) => c.identifier));
        setVoices(result.filter((voice) => candidateIds.has(voice.identifier)));
      })
      .catch((err) => setVoicesError(err instanceof Error ? err.message : 'Could not list voices.'));
  }, []);

  async function handleTest(voiceId: string) {
    setActiveVoiceId(voiceId);
    setStatus('synthesizing');
    setError(null);
    setResultPath(null);
    try {
      const outputFile = makeOutputFile();
      const path = await AnthaathiTts.synthesizeToFile(TEST_STRING, outputFile.uri, voiceId);
      setResultPath(path);
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

      {voicesError ? <Text style={[styles.body, { color: colors.error }]}>{voicesError}</Text> : null}
      {!voices && !voicesError ? <ActivityIndicator color={colors.primary} /> : null}

      {voices ? (
        <>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {voices.length} of {CANDIDATE_VOICES.length} candidates found on this device
          </Text>
          <FlatList
            style={styles.list}
            data={voices}
            keyExtractor={(voice) => voice.identifier}
            renderItem={({ item }) => {
              const isActive = activeVoiceId === item.identifier;
              const candidate = CANDIDATE_VOICES.find((c) => c.identifier === item.identifier);
              return (
                <Pressable
                  onPress={() => handleTest(item.identifier)}
                  disabled={status === 'synthesizing'}
                  accessibilityRole="button"
                  style={[styles.voiceRow, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.textPrimary }}>{item.identifier}</Text>
                  <Text style={[styles.caption, { color: colors.textSecondary }]}>
                    {candidate?.gender} · {item.locale} · quality {item.quality} ·{' '}
                    {item.isNetworkConnectionRequired ? 'network' : 'offline'}
                    {candidate?.note ? ` · ${candidate.note}` : ''}
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
