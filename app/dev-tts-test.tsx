import { useAudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import AnthaathiTts from '@/modules/anthaathi-tts';
import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * Temporary, __DEV__-only screen proving Execution Plan step 3.6's native module actually
 * works on a real device -- synthesizes a known string, then plays it back so both the
 * on-screen status and the audible result confirm it's a genuine, playable file. Remove once
 * step 3.10 builds the real AI Guided voice picker on top of this same native module.
 */
const TEST_STRING = 'This is a test of on-device speech synthesis for Anthaathi.';

type Status = 'idle' | 'synthesizing' | 'ready' | 'error';

export default function DevTtsTestScreen() {
  const colors = useThemeColors();
  const [status, setStatus] = useState<Status>('idle');
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const player = useAudioPlayer(resultPath);

  async function handleTest() {
    setStatus('synthesizing');
    setError(null);
    setResultPath(null);
    try {
      const outputFile = new File(Paths.document, `tts-test-${Date.now()}.wav`);
      const path = await AnthaathiTts.synthesizeToFile(TEST_STRING, outputFile.uri);
      setResultPath(path);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Synthesis failed.');
      setStatus('error');
    }
  }

  function handlePlay() {
    player.play();
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Dev: on-device TTS test</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>&quot;{TEST_STRING}&quot;</Text>

      <Pressable
        onPress={handleTest}
        disabled={status === 'synthesizing'}
        accessibilityRole="button"
        style={[styles.button, { borderColor: colors.primary }]}
      >
        {status === 'synthesizing' ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={{ color: colors.primary }}>Synthesize</Text>
        )}
      </Pressable>

      {status === 'ready' && resultPath ? (
        <>
          <Text style={[styles.body, { color: colors.success }]}>Synthesized: {resultPath}</Text>
          <Pressable
            onPress={handlePlay}
            accessibilityRole="button"
            style={[styles.button, { borderColor: colors.primary }]}
          >
            <Text style={{ color: colors.primary }}>Play</Text>
          </Pressable>
        </>
      ) : null}

      {error ? <Text style={[styles.body, { color: colors.error }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontWeight: typography.title.fontWeight,
  },
  body: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
  },
  button: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
