import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioPlayer,
} from 'expo-audio';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BedPicker, CHIP_HIT_SLOP, CHIP_ROW_PADDING } from '@/components/BedPicker';
import { NowPlaying } from '@/components/NowPlaying';
import { Chip } from '@/components/ui/Chip';
import { Sheet } from '@/components/ui/Sheet';
import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePlaybackProgress } from '@/hooks/usePlaybackProgress';
import { useThemeColors } from '@/hooks/useThemeColors';
import { listLocalAffirmations, type LocalAffirmation } from '@/lib/affirmations.local';
import { startBedLoop, type BedLoop } from '@/lib/bedLoop';
import { DEFAULT_MIX, getBedPreference, mixGains, setBedPreference } from '@/lib/bedPrefs';
import { getBed, type Bed } from '@/lib/beds';
import { logLocalPlaybackSession } from '@/lib/playbackSessions.local';
import { AFFIRMATION_GAP_MS } from '@/lib/voiceStyle';
import { getOrBuildWaveform } from '@/lib/waveforms.local';

const SLEEP_TIMER_OPTIONS = [15, 30, 45, 60] as const;
/** Tapping a bed before Play lets you hear it for this long. */
const PREVIEW_MS = 8000;
const AUDIO_MODE = {
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  interruptionMode: 'doNotMix',
} as const;

/** When a sleep timer of `minutes`, set now, ends; null for no timer. */
function timerEndFromNow(minutes: number | null): number | null {
  return minutes ? Date.now() + minutes * 60_000 : null;
}

// A plain function so the mix can be applied from event handlers: the React Compiler's lint
// rules forbid assigning to a hook's return value inline.
function setVoiceVolume(player: AudioPlayer, volume: number) {
  player.volume = volume;
}

export default function PlayerScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();

  const [affirmations, setAffirmations] = useState<LocalAffirmation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);

  const [screenState, setScreenState] = useState<'selecting' | 'playing'>('selecting');
  const [queue, setQueue] = useState<LocalAffirmation[]>([]);
  const [playCount, setPlayCount] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  // When the sleep timer ends the session (ms since epoch), or null without one. State, not a
  // ref, so setting a timer partway through a session starts the countdown (R.7a).
  const [timerEndAt, setTimerEndAt] = useState<number | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  // The ambience bed (FR-304) lives for the whole session: queue advances and single-track
  // repeats never touch it, only start/pause/resume/stop do.
  const bedRef = useRef<BedLoop | null>(null);
  // The studio settings (FR-304): saved per device, applied live while playing. Mirrored in refs
  // so the track-start effect can read the current mix without re-running on every slider move.
  const [bedId, setBedId] = useState<string | null>(null);
  const [mix, setMix] = useState(DEFAULT_MIX);
  const bedIdRef = useRef<string | null>(null);
  const mixRef = useRef(DEFAULT_MIX);
  // A bed heard on its own before Play. The token makes a quick second tap (or Play) win over a
  // preview still waiting for the audio mode to be set.
  const previewRef = useRef<{ loop: BedLoop; timer: ReturnType<typeof setTimeout> } | null>(null);
  const previewTokenRef = useRef(0);
  // Silence between affirmations: after a track ends the affirmation player waits here (the bed
  // keeps playing) before the queue advances. 'paused' means the user paused during the gap,
  // so Resume should advance straight away rather than replay the finished track.
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gapState, setGapState] = useState<'none' | 'waiting' | 'paused'>('none');
  // R.7a: Back shows the chooser while the session keeps playing; a card there comes back.
  const [showNowPlaying, setShowNowPlaying] = useState(true);
  // Loop on repeats the selection all night. Off finishes the pass in progress, then ends the
  // session: it ends once the play count reaches stopAtRef (the end of that pass).
  const [loopOn, setLoopOn] = useState(true);
  const stopAtRef = useRef<number | null>(null);
  // Lets the advance listener end the session without depending on handleStop's identity.
  const endSessionRef = useRef<() => void>(() => {});
  const [sheet, setSheet] = useState<'timer' | 'ambience' | null>(null);
  const [levels, setLevels] = useState<number[] | null>(null);

  const clearGapTimer = useCallback(() => {
    if (gapTimerRef.current !== null) clearTimeout(gapTimerRef.current);
    gapTimerRef.current = null;
  }, []);

  const stopPreview = useCallback(() => {
    previewTokenRef.current++;
    const preview = previewRef.current;
    if (!preview) return;
    clearTimeout(preview.timer);
    preview.loop.stop();
    previewRef.current = null;
  }, []);

  useEffect(
    () => () => {
      bedRef.current?.stop();
      stopPreview();
      clearGapTimer();
    },
    [clearGapTimer, stopPreview],
  );

  useEffect(() => {
    getBedPreference().then((pref) => {
      bedIdRef.current = pref.bedId;
      mixRef.current = pref.mix;
      setBedId(pref.bedId);
      setMix(pref.mix);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) listLocalAffirmations(user.id).then(setAffirmations);
    }, [user]),
  );

  // Leaving the Player tab ends a preview.
  useFocusEffect(useCallback(() => stopPreview, [stopPreview]));

  const currentIndex = queue.length ? playCount % queue.length : 0;
  const currentTrack = queue[currentIndex];

  const player = useAudioPlayer(currentTrack?.local_uri);
  const status = useAudioPlayerStatus(player);

  // The current track's waveform (R.7a), built from the file for AI Guided audio.
  const trackId = currentTrack?.id;
  const trackUri = currentTrack?.local_uri;
  useEffect(() => {
    if (!trackId || !trackUri) return;
    let cancelled = false;
    getOrBuildWaveform({ id: trackId, local_uri: trackUri }).then((waveform) => {
      if (!cancelled) setLevels(waveform?.levels ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [trackId, trackUri]);

  const trackDurationMs = currentTrack?.duration_ms ?? 0;
  const progress = usePlaybackProgress({
    playing: status.playing,
    positionMs: Math.min(Math.max(status.currentTime * 1000, 0), trackDurationMs),
    stopMs: currentTrack ? (currentTrack.trim_end_ms ?? currentTrack.duration_ms) : 0,
    durationMs: trackDurationMs,
  });

  // Start (or restart, for a single-track loop) the current queue position:
  // seek past any trim start, claim lock-screen controls (required on Android
  // for sustained background playback beyond ~3 minutes), and play.
  useEffect(() => {
    if (screenState !== 'playing' || !currentTrack) return;
    const trimStartSec = (currentTrack.trim_start_ms ?? 0) / 1000;
    setVoiceVolume(player, mixGains(mixRef.current, bedIdRef.current !== null).voice);
    player.seekTo(trimStartSec);
    player.setActiveForLockScreen(true, { title: currentTrack.title });
    player.play();
  }, [playCount, screenState, currentTrack, player]);

  // Advance the queue when the track reaches its trim end or its natural end.
  // `didJustFinish` matters for untrimmed tracks: `duration_ms` is the
  // recorder's clock at Stop, and the encoded file is often a few tens of ms
  // shorter — so the file can end before `currentTime` ever reaches the
  // threshold, leaving the player sitting at end-of-media (where play() is a
  // no-op) instead of advancing.
  // A real event listener (not a useAudioPlayerStatus-driven effect) so the
  // advance-once guard lives in the closure, not in state/renders. `playCount`
  // is in the deps (even though it isn't read in the body) so this resubscribes
  // — and its `advanced` guard resets — on every loop iteration, including
  // repeats of the same single track, where `currentTrack`/`player` never
  // change identity on their own.
  useEffect(() => {
    if (screenState !== 'playing' || !currentTrack) return;
    const trimEndMs = currentTrack.trim_end_ms ?? currentTrack.duration_ms;
    let advanced = false;
    const subscription = player.addListener('playbackStatusUpdate', (s) => {
      if (!advanced && (s.didJustFinish || s.currentTime * 1000 >= trimEndMs - 50)) {
        advanced = true;
        player.pause();
        if (stopAtRef.current !== null && playCount + 1 >= stopAtRef.current) {
          endSessionRef.current();
          return;
        }
        setGapState('waiting');
        gapTimerRef.current = setTimeout(() => {
          gapTimerRef.current = null;
          setGapState('none');
          setPlayCount((count) => count + 1);
        }, AFFIRMATION_GAP_MS);
      }
    });
    return () => subscription.remove();
  }, [playCount, screenState, currentTrack, player]);

  // Depends on `player` so this identity changes whenever the current track
  // does — the sleep-timer effect below resubscribes to match, instead of a
  // stale closure pausing whichever track was playing when the timer started.
  const handleStop = useCallback(() => {
    player.pause();
    bedRef.current?.stop();
    bedRef.current = null;
    clearGapTimer();
    setGapState('none');
    // Logs the session however it ends (manual Stop or sleep-timer expiry) —
    // FR-601 counts a session as "completed" once playback stops, not just
    // on a specific ending path. played_at is the session's *start* time so
    // a session spanning midnight still belongs to the night it started.
    if (sessionStartRef.current !== null && user) {
      const startedAt = sessionStartRef.current;
      logLocalPlaybackSession(user.id, new Date(startedAt).toISOString(), Date.now() - startedAt);
    }
    setScreenState('selecting');
    setPlayCount(0);
    setRemainingSeconds(null);
    setTimerEndAt(null);
    setSheet(null);
    sessionStartRef.current = null;
    stopAtRef.current = null;
  }, [player, user, clearGapTimer]);

  useEffect(() => {
    endSessionRef.current = handleStop;
  });

  // Sleep timer countdown.
  useEffect(() => {
    if (screenState !== 'playing' || timerEndAt === null) return;
    const interval = setInterval(() => {
      const remainingMs = timerEndAt - Date.now();
      if (remainingMs <= 0) {
        handleStop();
        return;
      }
      setRemainingSeconds(Math.round(remainingMs / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [screenState, timerEndAt, handleStop]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function startPreview(bed: Bed) {
    stopPreview();
    const token = previewTokenRef.current;
    await setAudioModeAsync(AUDIO_MODE);
    if (token !== previewTokenRef.current) return;
    const loop = startBedLoop(bed, mixGains(mixRef.current, true).bed);
    previewRef.current = { loop, timer: setTimeout(stopPreview, PREVIEW_MS) };
  }

  const isPaused = !(status.playing || gapState === 'waiting');

  // The now-playing screen has the whole display (user, R.7a): no "Player" header, no tab
  // bar. Back (the arrow or Android's gesture) returns to the chooser, which brings them back.
  const nowPlayingShown = screenState === 'playing' && currentTrack !== undefined && showNowPlaying;
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({
      headerShown: !nowPlayingShown,
      tabBarStyle: nowPlayingShown ? { display: 'none' } : undefined,
    });
  }, [navigation, nowPlayingShown]);
  useEffect(() => {
    if (!nowPlayingShown) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowNowPlaying(false);
      return true;
    });
    return () => subscription.remove();
  }, [nowPlayingShown]);

  function handleBedChange(nextBedId: string | null) {
    bedIdRef.current = nextBedId;
    setBedId(nextBedId);
    void setBedPreference({ bedId: nextBedId, mix: mixRef.current });
    const bed = getBed(nextBedId);
    const gains = mixGains(mixRef.current, bed !== null);
    if (screenState === 'playing') {
      // The old bed fades out as the new one fades in.
      bedRef.current?.stop();
      bedRef.current = bed ? startBedLoop(bed, gains.bed) : null;
      if (isPaused) bedRef.current?.pause();
      setVoiceVolume(player, gains.voice);
    } else if (bed) {
      void startPreview(bed);
    } else {
      stopPreview();
    }
  }

  function handleMixChange(nextMix: number) {
    mixRef.current = nextMix;
    setMix(nextMix);
    const gains = mixGains(nextMix, bedIdRef.current !== null);
    bedRef.current?.setVolume(gains.bed);
    previewRef.current?.loop.setVolume(gains.bed);
    if (screenState === 'playing') setVoiceVolume(player, gains.voice);
  }

  function handleMixCommit(nextMix: number) {
    void setBedPreference({ bedId: bedIdRef.current, mix: nextMix });
  }

  const bedPicker = (
    <BedPicker
      bedId={bedId}
      mix={mix}
      onBedChange={handleBedChange}
      onMixChange={handleMixChange}
      onMixCommit={handleMixCommit}
    />
  );

  async function handleStart() {
    const selected = affirmations.filter((a) => selectedIds.has(a.id));
    if (selected.length === 0) return;

    // Starting from the chooser while a session plays replaces it (and logs the old one).
    if (screenState === 'playing') handleStop();
    stopPreview();
    await setAudioModeAsync(AUDIO_MODE);

    const bed = getBed(bedIdRef.current);
    bedRef.current?.stop();
    bedRef.current = bed ? startBedLoop(bed, mixGains(mixRef.current, true).bed) : null;

    sessionStartRef.current = Date.now();
    stopAtRef.current = loopOn ? null : selected.length;
    setTimerEndAt(timerEndFromNow(sleepTimerMinutes));
    setRemainingSeconds(sleepTimerMinutes ? sleepTimerMinutes * 60 : null);
    setQueue(selected);
    setPlayCount(0);
    setShowNowPlaying(true);
    setScreenState('playing');
  }

  function handleTogglePause() {
    if (!isPaused) {
      player.pause();
      bedRef.current?.pause();
      if (gapState === 'waiting') {
        clearGapTimer();
        setGapState('paused');
      }
      return;
    }
    bedRef.current?.resume();
    if (gapState === 'paused') {
      setGapState('none');
      if (stopAtRef.current !== null && playCount + 1 >= stopAtRef.current) {
        handleStop();
        return;
      }
      setPlayCount((count) => count + 1);
    } else {
      player.play();
    }
  }

  function handleToggleLoop() {
    const next = !loopOn;
    setLoopOn(next);
    stopAtRef.current =
      next || queue.length === 0 ? null : (Math.floor(playCount / queue.length) + 1) * queue.length;
  }

  function handleTimerChoice(minutes: number | null) {
    setSleepTimerMinutes(minutes);
    setSheet(null);
    if (screenState !== 'playing') return;
    // A timer chosen mid-session counts from now.
    setTimerEndAt(timerEndFromNow(minutes));
    setRemainingSeconds(minutes ? minutes * 60 : null);
  }

  if (nowPlayingShown) {
    return (
      <>
        <NowPlaying
          track={currentTrack}
          levels={levels}
          progress={progress}
          paused={isPaused}
          loopNumber={queue.length ? Math.floor(playCount / queue.length) + 1 : 1}
          loopOn={loopOn}
          remainingSeconds={remainingSeconds}
          timerMinutes={sleepTimerMinutes}
          ambienceOn={bedId !== null}
          onTogglePause={handleTogglePause}
          onEnd={handleStop}
          onBack={() => setShowNowPlaying(false)}
          onToggleLoop={handleToggleLoop}
          onOpenTimer={() => setSheet('timer')}
          onOpenAmbience={() => setSheet('ambience')}
        />
        <Sheet visible={sheet === 'timer'} title="Sleep timer" onClose={() => setSheet(null)}>
          <View style={styles.sheetChips}>
            {[...SLEEP_TIMER_OPTIONS, null].map((minutes) => (
              <Chip
                key={minutes ?? 'off'}
                label={minutes ? `${minutes} min` : 'No timer'}
                selected={sleepTimerMinutes === minutes}
                onPress={() => handleTimerChoice(minutes)}
              />
            ))}
          </View>
        </Sheet>
        <Sheet visible={sheet === 'ambience'} title="Ambience" onClose={() => setSheet(null)}>
          <BedPicker
            bedId={bedId}
            mix={mix}
            onBedChange={handleBedChange}
            onMixChange={handleMixChange}
            onMixCommit={handleMixCommit}
            showTitle={false}
          />
        </Sheet>
      </>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, justifyContent: 'flex-start' },
      ]}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>Player</Text>

      {screenState === 'playing' && currentTrack ? (
        <Pressable
          onPress={() => setShowNowPlaying(true)}
          accessibilityRole="button"
          accessibilityLabel={`Now playing: ${currentTrack.title}. Open`}
          style={[styles.nowPlayingCard, { backgroundColor: colors.surface }]}
        >
          <Text style={[styles.sectionLabel, { color: colors.accent }]}>Now playing</Text>
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {currentTrack.title}
          </Text>
        </Pressable>
      ) : null}

      {affirmations.length === 0 ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          No recordings yet — make one in the Library tab first.
        </Text>
      ) : (
        <FlatList
          data={affirmations}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const selected = selectedIds.has(item.id);
            return (
              <Pressable
                onPress={() => toggleSelected(item.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.row,
                  { borderColor: selected ? colors.selected : colors.border },
                  selected && { backgroundColor: colors.surface },
                ]}
              >
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                <Text style={{ color: colors.selected }}>{selected ? '✓' : ''}</Text>
              </Pressable>
            );
          }}
        />
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Sleep timer</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
        >
          {[...SLEEP_TIMER_OPTIONS, null].map((minutes) => {
            const selected = sleepTimerMinutes === minutes;
            return (
              <Pressable
                key={minutes ?? 'off'}
                onPress={() => setSleepTimerMinutes(minutes)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                hitSlop={CHIP_HIT_SLOP}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? colors.selected : colors.border,
                    backgroundColor: selected ? colors.selected : 'transparent',
                  },
                ]}
              >
                <Text style={{ color: selected ? colors.background : colors.textPrimary }}>
                  {minutes ? `${minutes} min` : 'No timer'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {bedPicker}

      <Pressable
        onPress={handleStart}
        disabled={selectedIds.size === 0}
        accessibilityRole="button"
        style={[
          styles.primaryButton,
          { backgroundColor: colors.action, opacity: selectedIds.size === 0 ? 0.5 : 1 },
        ]}
      >
        <Text style={[styles.primaryButtonLabel, { color: colors.background }]}>
          Play {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  nowPlayingCard: {
    alignSelf: 'stretch',
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 2,
  },
  sheetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    // Room for the chips' extended touch area (hit slop can't reach past the parent).
    paddingVertical: 10,
  },
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
    fontFamily: typography.title.fontFamily,
    textAlign: 'center',
  },
  description: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
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
  list: {
    width: '100%',
    flexGrow: 0,
    maxHeight: '45%',
  },
  listContent: {
    gap: spacing.sm,
  },
  row: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: typography.body.fontSize,
    flexShrink: 1,
  },
  // Matches BedPicker's label-to-chips spacing.
  section: {
    alignSelf: 'stretch',
    gap: spacing.xs,
  },
  sectionLabel: {
    fontSize: typography.caption.fontSize,
    alignSelf: 'flex-start',
  },
  chipScroll: {
    flexGrow: 0,
    alignSelf: 'stretch',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...CHIP_ROW_PADDING,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
});
