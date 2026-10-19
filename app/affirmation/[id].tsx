import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FolderPicker } from '@/components/FolderPicker';
import { PauseMarkHint } from '@/components/PauseMarkHint';
import { PlaybackCard } from '@/components/PlaybackCard';
import { TrimScreen } from '@/components/TrimScreen';
import { VoicePicker } from '@/components/VoicePicker';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { NavHeader } from '@/components/ui/NavHeader';
import { TextField } from '@/components/ui/TextField';
import { colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  deleteLocalAffirmation,
  getLocalAffirmation,
  updateAiGuidedAffirmationScript,
  updateLocalAffirmationFolder,
  updateLocalAffirmationTitle,
  updateLocalAffirmationTrim,
  type LocalAffirmation,
} from '@/lib/affirmations.local';
import { getDefaultVoiceId } from '@/lib/aiVoice';
import { listLocalFolders, type LocalFolder } from '@/lib/folders.local';
import { getNeuralVoiceStatus, NeuralModelMissingError } from '@/lib/neuralVoice';
import { describeTrim, findSilenceTrim, type TrimRange } from '@/lib/waveform';
import { getOrBuildWaveform } from '@/lib/waveforms.local';

const ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * A saved recording (self-recorded or AI Guided). There's no mockup for it, so it reuses the
 * Preview layout (R.5b): title, waveform card, folder / Trim silence / Trim chips, and for AI
 * Guided the script, voice and Regenerate. Every change saves as it's made, so Back is all
 * that's needed to leave.
 */
export default function AffirmationScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [affirmation, setAffirmation] = useState<LocalAffirmation | null | undefined>(undefined);
  const [folders, setFolders] = useState<LocalFolder[]>([]);
  const [levels, setLevels] = useState<number[] | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [choosingFolder, setChoosingFolder] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const [nothingToTrim, setNothingToTrim] = useState(false);
  const [scriptText, setScriptText] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  const loadAffirmation = useCallback(() => {
    if (!id) return;
    getLocalAffirmation(id).then((result) => {
      setAffirmation(result);
      if (result) {
        setTitle(result.title);
        setScriptText(result.script_text ?? '');
        setVoiceId(
          result.voice_id ?? getDefaultVoiceId(getNeuralVoiceStatus().state === 'installed'),
        );
      }
    });
  }, [id]);

  useEffect(loadAffirmation, [loadAffirmation]);

  useEffect(() => {
    if (user) listLocalFolders(user.id).then(setFolders);
  }, [user]);

  // Reloaded when Regenerate replaces the audio file. AI Guided audio gets its waveform
  // built from the file the first time it's shown.
  const audioId = affirmation?.id;
  const audioUri = affirmation?.local_uri;
  useEffect(() => {
    if (!audioId || !audioUri) return;
    let cancelled = false;
    getOrBuildWaveform({ id: audioId, local_uri: audioUri }).then((waveform) => {
      if (!cancelled) setLevels(waveform?.levels ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [audioId, audioUri]);

  const durationMs = affirmation?.duration_ms ?? 0;
  const silenceTrim = useMemo(
    () => (levels ? findSilenceTrim(levels, durationMs) : null),
    [levels, durationMs],
  );

  if (affirmation === undefined) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.action} />
      </View>
    );
  }

  if (affirmation === null) {
    return (
      <View style={styles.root}>
        <NavHeader leading="back" onLeadingPress={() => router.back()} />
        <Text style={styles.notFound}>Recording not found</Text>
      </View>
    );
  }

  // Captured for the handlers below, which only run once it has loaded.
  const current = affirmation;
  const trim: TrimRange | null =
    current.trim_start_ms !== null && current.trim_end_ms !== null
      ? { startMs: current.trim_start_ms, endMs: current.trim_end_ms }
      : null;
  // Only the range is saved, so Trim silence counts as on when the range is exactly its cut.
  const isSilenceTrim =
    trim !== null &&
    silenceTrim !== null &&
    trim.startMs === silenceTrim.startMs &&
    trim.endMs === silenceTrim.endMs;
  const folderName = folders.find((f) => f.id === current.folder_id)?.name ?? 'No folder';
  const isAiGuided = current.source === 'ai_generated';

  async function saveTrim(range: TrimRange | null) {
    setError(null);
    try {
      await updateLocalAffirmationTrim(current.id, range?.startMs ?? null, range?.endMs ?? null);
      setAffirmation({
        ...current,
        trim_start_ms: range?.startMs ?? null,
        trim_end_ms: range?.endMs ?? null,
      });
    } catch {
      setError(ERROR_MESSAGE);
    }
  }

  function handleTrimSilence() {
    if (isSilenceTrim) {
      saveTrim(null);
    } else if (silenceTrim) {
      setNothingToTrim(false);
      saveTrim(silenceTrim);
    } else {
      setNothingToTrim(true);
    }
  }

  async function handleFolderSelect(folderId: string | null) {
    setChoosingFolder(false);
    setError(null);
    try {
      await updateLocalAffirmationFolder(current.id, folderId);
      setAffirmation({ ...current, folder_id: folderId });
    } catch {
      setError(ERROR_MESSAGE);
    }
  }

  async function handleTitleBlur() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle === current.title) {
      setTitle(current.title);
      return;
    }
    try {
      await updateLocalAffirmationTitle(current.id, trimmedTitle);
      setAffirmation({ ...current, title: trimmedTitle });
    } catch {
      setError(ERROR_MESSAGE);
      setTitle(current.title);
    }
  }

  async function handleRegenerate() {
    const trimmedScript = scriptText.trim();
    if (!trimmedScript) {
      setError('Enter the affirmation text before regenerating.');
      return;
    }
    setRegenerating(true);
    setError(null);
    try {
      const updated = await updateAiGuidedAffirmationScript(current.id, {
        scriptText: trimmedScript,
        voiceId,
      });
      setAffirmation(updated);
      setScriptText(updated.script_text ?? '');
      setNothingToTrim(false);
    } catch (err) {
      setError(
        err instanceof NeuralModelMissingError
          ? err.message
          : 'Could not regenerate the affirmation. Please try again.',
      );
    } finally {
      setRegenerating(false);
    }
  }

  function handleDelete() {
    Alert.alert('Delete this recording?', 'This cannot be undone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLocalAffirmation(current.id);
            router.back();
          } catch {
            setError(ERROR_MESSAGE);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <NavHeader
        title={isAiGuided ? 'AI Guided' : 'Recording'}
        leading="back"
        onLeadingPress={() => router.back()}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <TextField
            label="Title"
            value={title}
            onChangeText={setTitle}
            onBlur={handleTitleBlur}
            maxLength={80}
          />

          {/* Unmounted while Trim is open (its player goes with it), so only one plays.
              Keyed by file, so Regenerate loads the new audio. */}
          {trimming ? null : (
            <PlaybackCard
              key={current.local_uri}
              uri={current.local_uri}
              durationMs={current.duration_ms}
              levels={levels}
              trimStartMs={trim?.startMs ?? null}
              trimEndMs={trim?.endMs ?? null}
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
              selected={isSilenceTrim}
              onPress={handleTrimSilence}
            />
            <Chip
              icon="scissors"
              label="Trim"
              selected={trim !== null && !isSilenceTrim}
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
              selectedFolderId={current.folder_id}
              onSelect={handleFolderSelect}
            />
          ) : null}

          {nothingToTrim ? (
            <Text accessibilityLiveRegion="polite" style={styles.note}>
              There&apos;s no quiet at the start or end to trim.
            </Text>
          ) : null}

          {trim ? (
            <Text style={styles.note}>
              {describeTrim(trim, current.duration_ms, isSilenceTrim ? 'silence' : 'manual')}
            </Text>
          ) : null}

          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {error}
            </Text>
          ) : null}

          {isAiGuided ? (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Affirmation
              </Text>
              <TextField
                label="What it says"
                variant="script"
                value={scriptText}
                onChangeText={setScriptText}
                multiline
              />
              <PauseMarkHint />
              <VoicePicker value={voiceId} onChange={setVoiceId} />
              <Button
                label="Regenerate"
                variant="secondary"
                loading={regenerating}
                onPress={handleRegenerate}
              />
              <Text style={styles.note}>Regenerating makes new audio and clears its trim.</Text>
            </View>
          ) : null}

          <Button
            label="Delete recording"
            variant="ghost"
            tone="danger"
            icon="trash"
            onPress={handleDelete}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {trimming ? (
        <TrimScreen
          uri={current.local_uri}
          durationMs={current.duration_ms}
          levels={levels}
          initialTrim={trim}
          onCancel={() => setTrimming(false)}
          onDone={(range) => {
            setTrimming(false);
            saveTrim(range);
          }}
        />
      ) : null}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    ...typography.subtitle,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 48,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
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
  note: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
  },
  section: {
    gap: 12,
    marginTop: 8,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
});
