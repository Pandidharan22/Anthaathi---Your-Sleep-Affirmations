import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FolderPicker } from '@/components/FolderPicker';
import { TrimEditor } from '@/components/TrimEditor';
import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createLocalAffirmation } from '@/lib/affirmations.local';
import { listLocalFolders, type LocalFolder } from '@/lib/folders.local';

type ScreenState =
  | 'checking'
  | 'permission-needed'
  | 'permission-denied'
  | 'ready'
  | 'recording'
  | 'reviewing'
  | 'saving';

const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, directory: 'document' as const };

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function RecordScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();

  const [state, setState] = useState<ScreenState>('checking');
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDurationMs, setRecordedDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [folders, setFolders] = useState<LocalFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder);

  useEffect(() => {
    getRecordingPermissionsAsync().then(({ granted, canAskAgain }) => {
      setState(granted ? 'ready' : canAskAgain ? 'permission-needed' : 'permission-denied');
    });
  }, []);

  useEffect(() => {
    if (user) listLocalFolders(user.id).then(setFolders);
  }, [user]);

  async function handleRequestPermission() {
    const { granted, canAskAgain } = await requestRecordingPermissionsAsync();
    setState(granted ? 'ready' : canAskAgain ? 'permission-needed' : 'permission-denied');
  }

  async function handleStartRecording() {
    setError(null);
    try {
      await setAudioModeAsync({ allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setState('recording');
    } catch {
      setError('Could not start recording. Please try again.');
    }
  }

  async function handleStopRecording() {
    try {
      const durationMs = recorderState.durationMillis;
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('Recording finished with no file');
      setRecordedUri(uri);
      setRecordedDurationMs(durationMs);
      setTitle(`Recording — ${new Date().toLocaleString()}`);
      setState('reviewing');
    } catch {
      setError('Recording failed. Please try again.');
      setState('ready');
    }
  }

  function cleanupRecordedFile(uri: string) {
    try {
      new File(uri).delete();
    } catch {
      // Best-effort cleanup; a stray file isn't a correctness issue.
    }
  }

  function handleDiscard() {
    if (recordedUri) cleanupRecordedFile(recordedUri);
    setRecordedUri(null);
    setState('ready');
  }

  async function handleReRecord() {
    if (recordedUri) cleanupRecordedFile(recordedUri);
    setRecordedUri(null);
    await handleStartRecording();
  }

  async function handleSave(trimStartMs: number, trimEndMs: number) {
    if (!user || !recordedUri) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Give this recording a title before saving.');
      return;
    }
    setState('saving');
    setError(null);
    try {
      await createLocalAffirmation({
        userId: user.id,
        title: trimmedTitle,
        localUri: recordedUri,
        durationMs: recordedDurationMs,
        source: 'recorded',
        folderId: selectedFolderId,
        trimStartMs,
        trimEndMs,
      });
      router.back();
    } catch {
      setError('Could not save the recording. Please try again.');
      setState('reviewing');
    }
  }

  if (state === 'checking') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (state === 'permission-needed') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Microphone access</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Anthaathi needs the microphone to record affirmations in your own voice. Nothing is
          uploaded unless you choose to back it up.
        </Text>
        <Pressable
          onPress={handleRequestPermission}
          accessibilityRole="button"
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.primaryButtonLabel, { color: colors.background }]}>
            Allow microphone access
          </Text>
        </Pressable>
      </View>
    );
  }

  if (state === 'permission-denied') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Microphone access needed</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Recording is unavailable without microphone access. Enable it for Anthaathi in your
          device Settings, then come back here.
        </Text>
      </View>
    );
  }

  if (state === 'saving') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (state === 'reviewing' && recordedUri) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Review your recording</Text>

        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        <View style={styles.row}>
          <Pressable
            onPress={handleDiscard}
            accessibilityRole="button"
            style={[styles.secondaryButton, { borderColor: colors.error }]}
          >
            <Text style={{ color: colors.error }}>Discard</Text>
          </Pressable>
          <Pressable
            onPress={handleReRecord}
            accessibilityRole="button"
            style={[styles.secondaryButton, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.textPrimary }}>Re-record</Text>
          </Pressable>
        </View>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.titleInput,
            { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        />
        <FolderPicker folders={folders} selectedFolderId={selectedFolderId} onSelect={setSelectedFolderId} />

        <TrimEditor uri={recordedUri} durationMs={recordedDurationMs} onSave={handleSave} saveLabel="Save" />
      </View>
    );
  }

  if (state === 'recording') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Recording…</Text>
        <Text style={[styles.duration, { color: colors.textPrimary }]}>
          {formatDuration(recorderState.durationMillis)}
        </Text>
        <Pressable
          onPress={handleStopRecording}
          accessibilityRole="button"
          style={[styles.primaryButton, { backgroundColor: colors.error }]}
        >
          <Text style={[styles.primaryButtonLabel, { color: colors.background }]}>Stop</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Ready to record</Text>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      <Pressable
        onPress={handleStartRecording}
        accessibilityRole="button"
        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.primaryButtonLabel, { color: colors.background }]}>Tap to record</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
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
  duration: {
    fontSize: typography.display.fontSize,
    lineHeight: typography.display.lineHeight,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  error: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 200,
  },
  primaryButtonLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  titleInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
  },
});
