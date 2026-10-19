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
  Alert,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FolderPicker } from '@/components/FolderPicker';
import { PlaybackCard } from '@/components/PlaybackCard';
import { TrimScreen } from '@/components/TrimScreen';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { DuskBackground } from '@/components/ui/DuskBackground';
import { GlowButton } from '@/components/ui/GlowButton';
import { GradientText } from '@/components/ui/GradientText';
import { NavHeader } from '@/components/ui/NavHeader';
import { TextField } from '@/components/ui/TextField';
import { colors as palette, fonts, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { createLocalAffirmation } from '@/lib/affirmations.local';
import { formatDuration } from '@/lib/format';
import { listLocalFolders, type LocalFolder } from '@/lib/folders.local';
import {
  describeTrim,
  findSilenceTrim,
  levelFromDb,
  METER_INTERVAL_MS,
  type TrimRange,
} from '@/lib/waveform';
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
  // Preview (after Done): the take's levels, its quiet start/end, and the user's choices.
  const [recordedLevels, setRecordedLevels] = useState<number[]>([]);
  const [silenceTrim, setSilenceTrim] = useState<TrimRange | null>(null);
  const [trimSilence, setTrimSilence] = useState(false);
  // Shown after tapping Trim silence on a take with no quiet ends to cut.
  const [nothingToTrim, setNothingToTrim] = useState(false);
  // A trim set by hand on the Trim screen; it replaces Trim silence, and vice versa.
  const [manualTrim, setManualTrim] = useState<TrimRange | null>(null);
  const [trimming, setTrimming] = useState(false);
  const [choosingFolder, setChoosingFolder] = useState(false);

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
      const levels = [...levelsRef.current];
      setRecordedUri(uri);
      setRecordedDurationMs(durationMs);
      setRecordedLevels(levels);
      setSilenceTrim(findSilenceTrim(levels, durationMs));
      setTrimSilence(false);
      setNothingToTrim(false);
      setManualTrim(null);
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

  /** Back from Preview: the take isn't saved yet, so confirm before throwing it away. */
  function confirmDiscard() {
    Alert.alert('Discard this recording?', "It hasn't been saved yet.", [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: handleDiscard },
    ]);
  }

  async function handleSave() {
    if (!user || !recordedUri) return;
    const trim = manualTrim ?? (trimSilence ? silenceTrim : null);
    const trimStartMs = trim ? trim.startMs : null;
    const trimEndMs = trim ? trim.endMs : null;
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
          levels: recordedLevels,
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
    const folderName = folders.find((f) => f.id === selectedFolderId)?.name ?? 'No folder';
    const activeTrim = manualTrim ?? (trimSilence ? silenceTrim : null);
    return (
      <View style={styles.root}>
        <NavHeader title="Preview" leading="back" onLeadingPress={confirmDiscard} />
        <ScrollView contentContainerStyle={styles.preview} keyboardShouldPersistTaps="handled">
          <TextField label="Title" value={title} onChangeText={setTitle} maxLength={80} />

          {/* Unmounted while Trim is open (its player goes with it), so only one plays. */}
          {trimming ? null : (
            <PlaybackCard
              uri={recordedUri}
              durationMs={recordedDurationMs}
              levels={recordedLevels}
              trimStartMs={activeTrim?.startMs ?? null}
              trimEndMs={activeTrim?.endMs ?? null}
            />
          )}

          <View style={styles.chips}>
            <Chip
              icon="folder"
              label={folderName}
              selected={choosingFolder}
              accessibilityLabel={`Folder: ${folderName}. Change folder`}
              onPress={() => setChoosingFolder((open) => !open)}
            />
            <Chip
              icon="check"
              label="Trim silence"
              selected={trimSilence}
              onPress={() => {
                if (!silenceTrim) {
                  setNothingToTrim(true);
                  return;
                }
                setManualTrim(null);
                setTrimSilence((on) => !on);
              }}
            />
            <Chip
              icon="scissors"
              label="Trim"
              selected={manualTrim !== null}
              accessibilityLabel="Trim the start and end"
              onPress={() => {
                setNothingToTrim(false);
                setTrimming(true);
              }}
            />
          </View>

          {choosingFolder ? (
            <FolderPicker
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelect={(id) => {
                setSelectedFolderId(id);
                setChoosingFolder(false);
              }}
            />
          ) : null}

          {nothingToTrim ? (
            <Text accessibilityLiveRegion="polite" style={styles.trimNote}>
              There&apos;s no quiet at the start or end to trim.
            </Text>
          ) : null}

          {activeTrim ? (
            <Text style={styles.trimNote}>
              {describeTrim(activeTrim, recordedDurationMs, manualTrim ? 'manual' : 'silence')}
            </Text>
          ) : null}

          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {error}
            </Text>
          ) : null}
        </ScrollView>

        {trimming ? (
          <TrimScreen
            uri={recordedUri}
            durationMs={recordedDurationMs}
            levels={recordedLevels}
            initialTrim={activeTrim}
            onCancel={() => setTrimming(false)}
            onDone={(trim) => {
              setManualTrim(trim);
              setTrimSilence(false);
              setTrimming(false);
            }}
          />
        ) : null}

        <View style={[styles.previewActions, { paddingBottom: insets.bottom + 24 }]}>
          <Button label="Save recording" onPress={handleSave} />
          <View style={styles.previewRow}>
            <Button
              label="Discard"
              variant="ghost"
              tone="danger"
              onPress={handleDiscard}
              style={styles.flexButton}
            />
            <Button
              label="Re-record"
              variant="secondary"
              onPress={handleReRecord}
              style={styles.flexButton}
            />
          </View>
        </View>
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
    ...typography.script,
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
  preview: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 18,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    // Room for the chips' extended touch area (hit slop can't reach past the parent).
    paddingVertical: 10,
    marginVertical: -10,
  },
  trimNote: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  previewActions: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 12,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexButton: {
    flex: 1,
  },
});
