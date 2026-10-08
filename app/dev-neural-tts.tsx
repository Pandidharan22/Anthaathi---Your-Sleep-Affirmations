import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { startBedLoop, type BedLoop } from '@/lib/bedLoop';
import { getBedPreference } from '@/lib/bedPrefs';
import { getBed } from '@/lib/beds';
import {
  deleteModel,
  installModel,
  isModelInstalled,
  NEURAL_VOICES,
  synthesizeNeural,
  type InstallProgress,
  type NeuralVoice,
} from '@/lib/neuralVoice';

/**
 * Temporary, __DEV__-only screen for Execution Plan step 3.13's neural voice spike: install the
 * Kokoro model, load it, synthesize the same sample with each picked voice, and play it (optionally
 * under the saved bed) to judge it against the tuned system voices. Shows timings so on-device
 * speed can be judged too. Remove once the spike is decided.
 */
// "/" marks a short pause where there is no punctuation (lib/voiceStyle.ts PAUSE_MARK).
const SAMPLE = 'I am deserving. My strength / is permanent. I am calm, safe / and at peace.';

type VoiceResult = { uri: string; durationMs: number; synthMs: number } | { error: string };

function formatMb(bytes: number): string {
  return `${(bytes / 1e6).toFixed(0)} MB`;
}

export default function DevNeuralTtsScreen() {
  const colors = useThemeColors();
  const [installed, setInstalled] = useState(isModelInstalled());
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadInfo, setLoadInfo] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, VoiceResult>>({});
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [bedOn, setBedOn] = useState(false);
  const bedRef = useRef<BedLoop | null>(null);
  const player = useAudioPlayer(playingUri);

  useEffect(() => () => bedRef.current?.stop(), []);

  useEffect(() => {
    if (playingUri) player.play();
  }, [playingUri, player]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  const handleInstall = () =>
    run('Installing', async () => {
      const start = Date.now();
      await installModel(setProgress);
      setInstalled(isModelInstalled());
      setLoadInfo(`Installed in ${((Date.now() - start) / 1000).toFixed(0)} s`);
    });

  const handleSynthesize = (voice: NeuralVoice) =>
    run(`Synthesizing ${voice.label}`, async () => {
      try {
        const r = await synthesizeNeural(SAMPLE, voice);
        setResults((prev) => ({
          ...prev,
          [voice.name]: { uri: r.localUri, durationMs: r.durationMs, synthMs: r.synthMs },
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setResults((prev) => ({ ...prev, [voice.name]: { error: message } }));
        throw err;
      }
    });

  async function handlePlay(uri: string) {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
    if (uri === playingUri) {
      player.seekTo(0);
      player.play();
    } else {
      setPlayingUri(uri);
    }
  }

  async function toggleBed() {
    if (bedRef.current) {
      bedRef.current.stop();
      bedRef.current = null;
      setBedOn(false);
      return;
    }
    const pref = await getBedPreference();
    const bed = getBed(pref.bedId) ?? getBed('rain');
    if (!bed) return;
    bedRef.current = startBedLoop(bed, pref.balance);
    setBedOn(true);
  }

  const button = (enabled: boolean) => [
    styles.button,
    { borderColor: colors.primary, opacity: enabled ? 1 : 0.5 },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>Dev: neural voice (Kokoro)</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>&quot;{SAMPLE}&quot;</Text>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>
        Per-voice speed · 0.5 s at commas and / · 1.8 s after sentences · full-precision model (~350
        MB download)
      </Text>

      <Pressable
        onPress={
          installed
            ? () =>
                run('Deleting model', async () => {
                  await deleteModel();
                  setInstalled(false);
                  setLoadInfo(null);
                })
            : handleInstall
        }
        disabled={busy !== null}
        accessibilityRole="button"
        style={button(busy === null)}
      >
        <Text style={{ color: colors.primary }}>
          {installed ? 'Delete model' : 'Download + install model (Wi-Fi)'}
        </Text>
      </Pressable>

      {busy ? (
        <View style={styles.row}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.textPrimary }}>
            {busy}
            {progress?.stage === 'downloading'
              ? ` — ${formatMb(progress.bytesWritten)} / ${formatMb(progress.totalBytes)}`
              : progress?.stage === 'verifying'
                ? ' — verifying download'
                : progress?.stage === 'extracting'
                  ? ' — extracting (can take a few minutes)'
                  : ''}
          </Text>
        </View>
      ) : null}
      {loadInfo ? <Text style={{ color: colors.success }}>{loadInfo}</Text> : null}
      {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}

      <Pressable onPress={toggleBed} accessibilityRole="button" style={button(true)}>
        <Text style={{ color: colors.primary }}>
          {bedOn ? 'Stop bed' : 'Start bed (saved bed, else rain)'}
        </Text>
      </Pressable>

      {NEURAL_VOICES.map((voice) => {
        const result = results[voice.name];
        return (
          <View key={voice.name} style={[styles.voiceRow, { borderColor: colors.border }]}>
            <Text style={{ color: colors.textPrimary }}>
              {voice.label} · speed {voice.speed}
            </Text>
            <View style={styles.row}>
              <Pressable
                onPress={() => handleSynthesize(voice)}
                disabled={busy !== null || !installed}
                accessibilityRole="button"
                style={button(busy === null && installed)}
              >
                <Text style={{ color: colors.primary }}>Synthesize</Text>
              </Pressable>
              {result && 'uri' in result ? (
                <Pressable
                  onPress={() => handlePlay(result.uri)}
                  accessibilityRole="button"
                  style={button(true)}
                >
                  <Text style={{ color: colors.primary }}>Play</Text>
                </Pressable>
              ) : null}
            </View>
            {result && 'uri' in result ? (
              <Text style={[styles.caption, { color: colors.textSecondary }]}>
                {(result.durationMs / 1000).toFixed(1)} s audio in{' '}
                {(result.synthMs / 1000).toFixed(1)} s (×
                {(result.synthMs / result.durationMs).toFixed(2)} real time)
              </Text>
            ) : null}
            {result && 'error' in result ? (
              <Text style={[styles.caption, { color: colors.error }]}>{result.error}</Text>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  title: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontWeight: typography.title.fontWeight,
  },
  body: { fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight },
  caption: { fontSize: typography.caption.fontSize },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  voiceRow: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  button: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
