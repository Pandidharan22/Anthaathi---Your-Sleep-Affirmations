import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useNeuralVoiceStatus } from '@/hooks/useNeuralVoiceStatus';
import { useThemeColors } from '@/hooks/useThemeColors';
import {
  checkInstall,
  deleteModel,
  describeInstallBlocker,
  getInstalledSizeBytes,
  startInstall,
  type InstallProgress,
} from '@/lib/neuralVoice';

/**
 * Settings section for the optional natural (Kokoro) voices: download, progress, installed
 * size, removal. The install itself lives in lib/neuralVoice.ts, so it keeps going if the user
 * leaves Settings.
 */

function toMb(bytes: number): number {
  return Math.round(bytes / 1_000_000);
}

function describeProgress(progress: InstallProgress | null): string {
  if (!progress) return 'Starting…';
  if (progress.stage === 'downloading') {
    if (progress.totalBytes <= 0) return `Downloading… ${toMb(progress.bytesWritten)} MB`;
    const percent = Math.floor((progress.bytesWritten / progress.totalBytes) * 100);
    return `Downloading… ${percent}% (${toMb(progress.bytesWritten)} of ${toMb(progress.totalBytes)} MB)`;
  }
  if (progress.stage === 'verifying') return 'Checking the download…';
  return 'Installing… this can take a few minutes.';
}

export function NaturalVoicesSection() {
  const colors = useThemeColors();
  const status = useNeuralVoiceStatus();
  const [blocked, setBlocked] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function handleDownload() {
    setBlocked(null);
    setChecking(true);
    try {
      const check = await checkInstall();
      if (!check.ok) {
        setBlocked(describeInstallBlocker(check));
        return;
      }
      if (check.network === 'cellular') {
        Alert.alert(
          'Use mobile data?',
          "The download is about 350 MB. If you're on a limited plan, wait for Wi-Fi.",
          [
            { text: 'Wait for Wi-Fi', style: 'cancel' },
            { text: 'Download now', onPress: () => void startInstall() },
          ],
        );
        return;
      }
      void startInstall();
    } finally {
      setChecking(false);
    }
  }

  function confirmRemove() {
    Alert.alert(
      'Remove natural voices?',
      'This frees up space on your phone. Affirmations you already made keep their audio, and you can download the voices again anytime.',
      [
        { text: 'Keep voices', style: 'cancel' },
        {
          text: 'Remove voices',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            setRemoveError(null);
            try {
              await deleteModel();
            } catch {
              setRemoveError("Couldn't remove the voices. Please try again.");
            } finally {
              setRemoving(false);
            }
          },
        },
      ],
    );
  }

  // Walks the model folder (hundreds of files), so only when the install state changes.
  const sizeBytes = useMemo(
    () => (status.state === 'installed' ? getInstalledSizeBytes() : null),
    [status.state],
  );

  return (
    <View style={[styles.section, { borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Natural voices</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        Calmer, more lifelike voices for AI Guided affirmations. They run on your phone, so they
        work offline once downloaded.
      </Text>

      {status.state === 'installing' ? (
        <View style={styles.row}>
          <ActivityIndicator color={colors.primary} />
          <View style={styles.rowText}>
            <Text style={{ color: colors.textPrimary }}>{describeProgress(status.progress)}</Text>
            <Text style={[styles.caption, { color: colors.textSecondary }]}>
              Keep Anthaathi open until it finishes.
            </Text>
          </View>
        </View>
      ) : null}

      {status.state === 'installed' ? (
        <>
          <Text style={{ color: colors.success }}>
            Installed{sizeBytes ? ` · ${toMb(sizeBytes)} MB on this phone` : ''}
          </Text>
          <Pressable
            onPress={confirmRemove}
            disabled={removing}
            accessibilityRole="button"
            style={[styles.button, { borderColor: colors.border, opacity: removing ? 0.5 : 1 }]}
          >
            <Text style={{ color: colors.textPrimary }}>
              {removing ? 'Removing…' : 'Remove voices'}
            </Text>
          </Pressable>
          {removeError ? (
            <Text style={[styles.caption, { color: colors.error }]}>{removeError}</Text>
          ) : null}
        </>
      ) : null}

      {status.state === 'not_installed' || status.state === 'failed' ? (
        <>
          {status.state === 'failed' ? (
            <Text style={[styles.caption, { color: colors.error }]}>{status.message}</Text>
          ) : null}
          {blocked ? (
            <Text style={[styles.caption, { color: colors.error }]}>{blocked}</Text>
          ) : null}
          <Pressable
            onPress={handleDownload}
            disabled={checking}
            accessibilityRole="button"
            style={[
              styles.button,
              { backgroundColor: colors.primary, opacity: checking ? 0.5 : 1 },
            ]}
          >
            <Text style={[styles.primaryLabel, { color: colors.background }]}>
              {status.state === 'failed' ? 'Try again' : 'Download (about 350 MB)'}
            </Text>
          </Pressable>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>
            Best on Wi-Fi. Takes a few minutes.
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: typography.subtitle.fontWeight,
  },
  description: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  caption: {
    fontSize: typography.caption.fontSize,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowText: {
    flexShrink: 1,
    gap: spacing.xs,
  },
  button: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  primaryLabel: {
    fontWeight: '600',
  },
});
