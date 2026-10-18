import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FolderPicker } from '@/components/FolderPicker';
import { TrimEditor } from '@/components/TrimEditor';
import { Button } from '@/components/ui/Button';
import { DuskBackground } from '@/components/ui/DuskBackground';
import { GlowButton } from '@/components/ui/GlowButton';
import { GradientText } from '@/components/ui/GradientText';
import { NavHeader } from '@/components/ui/NavHeader';
import { colors as palette, fonts, radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createLocalAffirmation } from '@/lib/affirmations.local';
import { formatDuration } from '@/lib/format';
import { listLocalFolders, type LocalFolder } from '@/lib/folders.local';
import { levelFromDb, METER_INTERVAL_MS } from '@/lib/waveform';
import { saveWaveform } from '@/lib/waveforms.local';

type ScreenState =
  | 'checking'
  | 'permission-needed'
  | 'permission-denied'
  | 'ready'
  | 'recording'
  | 'paused'
  | 'reviewing'
  | 'saving';

// Metering on: the recorder reports loudness, sampled every METER_INTERVAL_MS for the
// recording's waveform (step R.5).
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document' as const,
  isMeteringEnabled: true,
};

export default function RecordScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { scriptText, suggestedTitle, folderId } = useLocalSearchParams<{
    scriptText?: string;
    suggestedTitle?: string;
    /** Preselects the folder when started from inside one (Mode Choice passes it on). */
    folderId?: string;
  }>();

  const [state, setState] = useState<ScreenState>('checking');
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDurationMs, setRecordedDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(suggestedTitle ?? '');
  const [folders, setFolders] = useState<LocalFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(folderId ?? null);
  // Loudness samples for the take in progress (0–1), saved with the recording.
  const levelsRef = useRef<number[]>([]);

  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, METER_INTERVAL_MS);
  const liveLevel = state === 'recording' ? levelFromDb(recorderState.metering) : 0;

  useEffect(() => {
    getRecordingPermissionsAsync().then(({ granted, canAskAgain }) => {
      setState(granted ? 'ready' : canAskAgain ? 'permission-needed' : 'permission-denied');
    });
  }, []);

  // After "Open Settings", the user comes back to the app: re-check, so turning the
  // microphone on there unlocks this screen without leaving and reopening it.
  useEffect(() => {
    if (state !== 'permission-denied' && state !== 'permission-needed') return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      getRecordingPermissionsAsync().then(({ granted, canAskAgain }) => {
        if (granted) setState('ready');
        else if (!canAskAgain) setState('permission-denied');
      });
    });
    return () => subscription.remove();
  }, [state]);

  // One loudness sample per recorder poll while actually recording (not while paused),
  // so the waveform lines up with the audio.
  useEffect(() => {
    if (state === 'recording' && recorderState.isRecording) {
      levelsRef.current.push(levelFromDb(recorderState.metering));
    }
  }, [state, recorderState]);

  useEffect(() => {
    if (user) listLocalFolders(user.id).then(setFolders);
  }, [user]);

  async function handleRequestPermission() {
    const { granted, canAskAgain } = await requestRecordingPermissionsAsync();
    setState(granted ? 'ready' : canAskAgain ? 'permission-needed' : 'permission-denied');
  }

  async function handleStartRecording() {
    setError(null);
    levelsRef.current = [];
    try {
      await setAudioModeAsync({ allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setState('recording');
    } catch {
      setError('Could not start recording. Please try again.');
    }
  }

  function handlePause() {
    recorder.pause();
    setState('paused');
  }

  function handleResume() {
    recorder.record();
    setState('recording');
  }

  async function handleStopRecording() {
    try {
      const durationMs = recorderState.durationMillis;
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('Recording finished with no file');
      setRecordedUri(uri);
      setRecordedDurationMs(durationMs);
      setTitle((current) => current || `Recording — ${new Date().toLocaleString()}`);
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

  /** Leaves without saving; a take in progress is stopped and its file deleted. */
  async function handleCancel() {
    if (state === 'recording' || state === 'paused') {
      try {
        await recorder.stop();
        if (recorder.uri) cleanupRecordedFile(recorder.uri);
      } catch {
        // Leaving anyway; a stray file isn't a correctness issue.
      }
    }
    router.back();
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

  async function handleSave(trimStartMs: number | null, trimEndMs: number | null) {
    if (!user || !recordedUri) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Give this recording a title before saving.');
      return;
    }
    setState('saving');
    setError(null);
    try {
      const created = await createLocalAffirmation({
        userId: user.id,
        title: trimmedTitle,
        localUri: recordedUri,
        durationMs: recordedDurationMs,
        source: 'recorded',
        folderId: selectedFolderId,
        trimStartMs,
        trimEndMs,
        scriptText: scriptText || null,
      });
      try {
        await saveWaveform(created.id, {
          intervalMs: METER_INTERVAL_MS,
          levels: levelsRef.current,
        });
      } catch {
        // The recording is saved; without a waveform it just draws as a flat line.
      }
      router.back();
    } catch {
      setError('Could not save the recording. Please try again.');
      setState('reviewing');
    }
  }

  if (state === 'checking' || state === 'saving') {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.action} />
      </View>
    );
  }

  if (state === 'permission-needed' || state === 'permission-denied') {
    const denied = state === 'permission-denied';
    return (
      <View style={styles.root}>
        <NavHeader leading="back" onLeadingPress={() => router.back()} />
        <View style={styles.permission}>
          <Text accessibilityRole="header" style={styles.permissionTitle}>
            {denied ? 'Microphone access needed' : 'Microphone access'}
          </Text>
          <Text style={styles.permissionBody}>
            {denied
              ? 'Recording needs microphone access. Tap Open Settings, then Permissions → Microphone → Allow, and come back here.'
              : 'Anthaathi needs the microphone to record affirmations in your own voice. Your recordings stay on this phone.'}
          </Text>
          {/* Android won't show the permission prompt again once it's been refused, so
              the only way forward is the app's page in system Settings. */}
          {denied ? (
            <Button label="Open Settings" onPress={() => Linking.openSettings()} />
          ) : (
            <Button label="Allow microphone access" onPress={handleRequestPermission} />
          )}
        </View>
      </View>
    );
  }

  if (state === 'reviewing' && recordedUri) {
    // Restyled in step R.5b (Preview mockup).
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
            {
              color: colors.textPrimary,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        />
        <FolderPicker
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelect={setSelectedFolderId}
        />

        <TrimEditor
          uri={recordedUri}
          durationMs={recordedDurationMs}
          onSave={handleSave}
          saveLabel="Save"
        />
      </View>
    );
  }

  // ready / recording / paused: the Record mockup.
  const live = state === 'recording' || state === 'paused';
  const folderName = folders.find((f) => f.id === selectedFolderId)?.name;
  const micLabel =
    state === 'recording'
      ? 'Pause recording'
      : state === 'paused'
        ? 'Resume recording'
        : 'Start recording';
  const micAction =
    state === 'recording' ? handlePause : state === 'paused' ? handleResume : handleStartRecording;
  const hint =
    state === 'recording'
      ? 'Tap to pause · hold to stop'
      : state === 'paused'
        ? 'Tap to resume · hold to stop'
        : 'Tap the mic to start';

  return (
    <View style={styles.root}>
      <DuskBackground opacity={0.7} />
      <NavHeader
        title={folderName ?? 'New recording'}
        titleStyle="quiet"
        leading="back"
        onLeadingPress={handleCancel}
      />

      <View style={styles.top}>
        {state === 'recording' ? (
          <Text style={styles.recordingLabel}>● Recording</Text>
        ) : state === 'paused' ? (
          <Text style={styles.pausedLabel}>Paused</Text>
        ) : null}
        <Text style={styles.script}>
          {scriptText
            ? `“${scriptText}”`
            : 'Speak slowly and softly, as if you were already drifting off.'}
        </Text>
        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {error}
          </Text>
        ) : null}
      </View>

      <View style={styles.mic}>
        <GlowButton
          icon="mic"
          size={90}
          haloSize={220}
          // The halo breathes with your voice while recording.
          haloScale={0.88 + liveLevel * 0.28}
          accessibilityLabel={micLabel}
          accessibilityHint={live ? 'Hold to stop recording' : undefined}
          onPress={micAction}
          onLongPress={live ? handleStopRecording : undefined}
        />
      </View>

      <View style={styles.timer}>
        <GradientText style={styles.time}>
          {formatDuration(recorderState.durationMillis)}
        </GradientText>
        <Text style={styles.hint}>{hint}</Text>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 40 }]}>
        <Button label="Cancel" variant="ghost" onPress={handleCancel} />
        <Button label="Done ✓" onPress={handleStopRecording} disabled={!live} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permission: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  permissionTitle: {
    ...typography.title,
    color: palette.textPrimary,
    textAlign: 'center',
  },
  permissionBody: {
    ...typography.body,
    color: palette.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  top: {
    paddingHorizontal: 32,
    paddingTop: 36,
    alignItems: 'center',
    gap: 20,
  },
  recordingLabel: {
    ...typography.caption,
    fontFamily: fonts.sansBold,
    color: palette.selected,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  pausedLabel: {
    ...typography.caption,
    fontFamily: fonts.sansBold,
    color: palette.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  script: {
    ...typography.quote,
    fontSize: 22,
    lineHeight: 31,
    color: palette.textPrimary,
    textAlign: 'center',
  },
  errorText: {
    ...typography.caption,
    color: palette.error,
    textAlign: 'center',
  },
  mic: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 40,
  },
  time: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 42,
    lineHeight: 50,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  // Styles for the review step until R.5b restyles it.
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
    fontFamily: typography.title.fontFamily,
    textAlign: 'center',
  },
  error: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
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
