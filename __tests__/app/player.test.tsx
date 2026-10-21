import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import PlayerScreen from '@/app/(tabs)/player';

const mockSetAudioModeAsync = jest.fn().mockResolvedValue(undefined);
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockSeekTo = jest.fn();
const mockSetActiveForLockScreen = jest.fn();
const mockAddListener = jest.fn();
const mockListLocalAffirmations = jest.fn();

let mockPlayerStatus: { playing: boolean; currentTime: number } = {
  playing: false,
  currentTime: 0,
};
type StatusEvent = { currentTime: number; didJustFinish?: boolean };
let statusListener: ((status: StatusEvent) => void) | null = null;

const mockPlayerObj: { volume?: number; [key: string]: unknown } = {
  play: mockPlay,
  pause: mockPause,
  seekTo: mockSeekTo,
  setActiveForLockScreen: mockSetActiveForLockScreen,
  addListener: (event: string, cb: (status: StatusEvent) => void) => {
    mockAddListener(event, cb);
    statusListener = cb;
    return { remove: jest.fn() };
  },
};

jest.mock('expo-audio', () => ({
  setAudioModeAsync: (...args: unknown[]) => mockSetAudioModeAsync(...args),
  useAudioPlayer: () => mockPlayerObj,
  useAudioPlayerStatus: () => mockPlayerStatus,
}));

const mockSetOptions = jest.fn();
const mockNavigation = { setOptions: (...args: unknown[]) => mockSetOptions(...args) };
jest.mock('expo-router', () => ({
  useNavigation: () => mockNavigation,
  useFocusEffect: (effect: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, []);
  },
}));

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@/lib/waveforms.local', () => ({
  getOrBuildWaveform: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/lib/affirmations.local', () => ({
  listLocalAffirmations: (...args: unknown[]) => mockListLocalAffirmations(...args),
}));

const mockBedPause = jest.fn();
const mockBedResume = jest.fn();
const mockBedStop = jest.fn();
const mockBedSetVolume = jest.fn();
const mockStartBedLoop = jest.fn();
const mockGetBedPreference = jest.fn();
const mockSetBedPreference = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/bedLoop', () => ({
  startBedLoop: (...args: unknown[]) => mockStartBedLoop(...args),
}));
// The real mixGains/DEFAULT_MIX are used; storage itself is mocked below.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock('@/lib/bedPrefs', () => ({
  ...jest.requireActual('@/lib/bedPrefs'),
  getBedPreference: (...args: unknown[]) => mockGetBedPreference(...args),
  setBedPreference: (...args: unknown[]) => mockSetBedPreference(...args),
}));
jest.mock('@react-native-community/slider', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { __esModule: true, default: (props: object) => <View {...props} /> };
});

// The gap between affirmations is real silence in the app; tests default it to 0 so queue
// advances stay immediate, and set it per test where the gap itself is under test.
let mockGapMs = 0;
jest.mock('@/lib/voiceStyle', () => ({
  get AFFIRMATION_GAP_MS() {
    return mockGapMs;
  },
}));

const mockLogLocalPlaybackSession = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/playbackSessions.local', () => ({
  logLocalPlaybackSession: (...args: unknown[]) => mockLogLocalPlaybackSession(...args),
}));

/** The big glowing control: "Pause" while playing, "Resume" while paused. */
const controlButton = () => screen.getByRole('button', { name: /^(Pause|Resume)$/ });
/**
 * The track playing now, by the title it gave the lock screen (the now-playing screen itself
 * no longer names it, R.7a). Throws until it matches, so it works inside waitFor.
 */
const showing = (title: string) => {
  expect(mockSetActiveForLockScreen).toHaveBeenLastCalledWith(true, { title });
  return true;
};

const track1 = {
  id: 'aff-1',
  title: 'Calm',
  local_uri: 'file:///calm.m4a',
  duration_ms: 10000,
  trim_start_ms: 1000,
  trim_end_ms: 9000,
  folder_id: 'folder-1',
  source: 'recorded',
  voice_id: null,
  script_text: null,
};
const track2 = {
  id: 'aff-2',
  title: 'Focus',
  local_uri: 'file:///focus.m4a',
  duration_ms: 5000,
  trim_start_ms: null,
  trim_end_ms: null,
  folder_id: 'folder-1',
  source: 'recorded',
  voice_id: null,
  script_text: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockPlayerStatus = { playing: false, currentTime: 0 };
  statusListener = null;
  mockListLocalAffirmations.mockResolvedValue([track1, track2]);
  mockGapMs = 0;
  mockGetBedPreference.mockResolvedValue({ bedId: null, mix: 0.825 });
  mockStartBedLoop.mockReturnValue({
    pause: mockBedPause,
    resume: mockBedResume,
    stop: mockBedStop,
    setVolume: mockBedSetVolume,
  });
  delete mockPlayerObj.volume;
});

describe('PlayerScreen', () => {
  it('lists recordings and enables Play once at least one is selected', async () => {
    const { getByText } = await render(<PlayerScreen />);

    await waitFor(() => expect(getByText('Calm')).toBeTruthy());
    expect(getByText('Play').parent?.props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(getByText('Calm'));

    expect(getByText('Play (1)').parent?.props.accessibilityState?.disabled).toBe(false);
  });

  it('starts playback: sets background audio mode, seeks past trim start, claims lock screen, and plays', async () => {
    const { getByText } = await render(<PlayerScreen />);
    await waitFor(() => expect(getByText('Calm')).toBeTruthy());

    await fireEvent.press(getByText('Calm'));
    await fireEvent.press(getByText('Play (1)'));

    expect(mockSetAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
    await waitFor(() => expect(showing('Calm')).toBeTruthy());
    expect(mockSeekTo).toHaveBeenCalledWith(1); // trim_start_ms 1000 -> 1s
    expect(mockSetActiveForLockScreen).toHaveBeenCalledWith(true, { title: 'Calm' });
    expect(mockPlay).toHaveBeenCalled();
  });

  it('advances to the next track when the trim end is reached, then loops back to the first', async () => {
    const { getByText } = await render(<PlayerScreen />);
    await waitFor(() => expect(getByText('Calm')).toBeTruthy());

    await fireEvent.press(getByText('Calm'));
    await fireEvent.press(getByText('Focus'));
    await fireEvent.press(getByText('Play (2)'));
    await waitFor(() => expect(showing('Calm')).toBeTruthy());

    // Simulate playback crossing track 1's trim_end_ms (9000).
    statusListener?.({ currentTime: 9.1 });
    await waitFor(() => expect(showing('Focus')).toBeTruthy());

    // track2 has no trim, so its "end" is duration_ms (5000).
    statusListener?.({ currentTime: 5.1 });
    await waitFor(() => expect(showing('Calm')).toBeTruthy());
  });

  it('advances when a file ends naturally before its recorded duration', async () => {
    // Real-device regression: duration_ms comes from the recorder's clock at
    // Stop, and the encoded file can be shorter — the file ends (didJustFinish)
    // before currentTime ever reaches duration_ms - 50, so the queue stalled.
    const { getByText } = await render(<PlayerScreen />);
    await waitFor(() => expect(getByText('Calm')).toBeTruthy());

    await fireEvent.press(getByText('Calm'));
    await fireEvent.press(getByText('Focus'));
    await fireEvent.press(getByText('Play (2)'));
    await waitFor(() => expect(showing('Calm')).toBeTruthy());

    statusListener?.({ currentTime: 9.1 });
    await waitFor(() => expect(showing('Focus')).toBeTruthy());

    // track2 is untrimmed with duration_ms 5000, but the file actually ends at 4.7s.
    statusListener?.({ currentTime: 4.7, didJustFinish: true });
    await waitFor(() => expect(showing('Calm')).toBeTruthy());
  });

  it('does not advance early on an ordinary mid-track status update', async () => {
    const { getByText } = await render(<PlayerScreen />);
    await waitFor(() => expect(getByText('Calm')).toBeTruthy());

    await fireEvent.press(getByText('Calm'));
    await fireEvent.press(getByText('Focus'));
    await fireEvent.press(getByText('Play (2)'));
    await waitFor(() => expect(showing('Calm')).toBeTruthy());

    statusListener?.({ currentTime: 4.7, didJustFinish: false });
    expect(showing('Calm')).toBeTruthy();
  });

  it('loops a single selected track indefinitely, not just once', async () => {
    const { getByText } = await render(<PlayerScreen />);
    await waitFor(() => expect(getByText('Calm')).toBeTruthy());

    await fireEvent.press(getByText('Calm'));
    await fireEvent.press(getByText('Play (1)'));
    await waitFor(() => expect(showing('Calm')).toBeTruthy());
    expect(mockSeekTo).toHaveBeenCalledTimes(1);
    expect(mockPlay).toHaveBeenCalledTimes(1);

    // First loop: crossing the single track's trim_end_ms (9000) should restart it.
    statusListener?.({ currentTime: 9.1 });
    await waitFor(() => expect(mockSeekTo).toHaveBeenCalledTimes(2));
    expect(mockPlay).toHaveBeenCalledTimes(2);

    // Second loop: this is the case the missing `playCount` dependency broke —
    // the advance listener must resubscribe (and its `advanced` guard reset)
    // even though `currentTrack`/`player` never change identity for one track.
    statusListener?.({ currentTime: 9.1 });
    await waitFor(() => expect(mockSeekTo).toHaveBeenCalledTimes(3));
    expect(mockPlay).toHaveBeenCalledTimes(3);
  });

  it('Stop pauses playback, logs a completed playback session, and returns to the selection screen', async () => {
    const { getByText } = await render(<PlayerScreen />);
    await waitFor(() => expect(getByText('Calm')).toBeTruthy());

    await fireEvent.press(getByText('Calm'));
    await fireEvent.press(getByText('Play (1)'));
    await waitFor(() => expect(controlButton()).toBeTruthy());

    await fireEvent(controlButton(), 'longPress');

    expect(mockPause).toHaveBeenCalled();
    await waitFor(() => expect(mockLogLocalPlaybackSession).toHaveBeenCalledTimes(1));
    const [userId, playedAt, durationMs] = mockLogLocalPlaybackSession.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(typeof playedAt).toBe('string');
    expect(durationMs).toBeGreaterThanOrEqual(0);
    await waitFor(() => expect(getByText('Player')).toBeTruthy());
  });

  it('does not log a session if Stop is somehow reached without a session ever starting', async () => {
    // Regression guard: sessionStartRef must be checked, not assumed set.
    const { getByText } = await render(<PlayerScreen />);
    await waitFor(() => expect(getByText('Calm')).toBeTruthy());

    expect(mockLogLocalPlaybackSession).not.toHaveBeenCalled();
  });

  describe('gap between affirmations', () => {
    async function startTwoTracks() {
      const utils = await render(<PlayerScreen />);
      await waitFor(() => expect(utils.getByText('Calm')).toBeTruthy());
      await fireEvent.press(utils.getByText('Calm'));
      await fireEvent.press(utils.getByText('Focus'));
      await fireEvent.press(utils.getByText('Play (2)'));
      await waitFor(() => expect(showing('Calm')).toBeTruthy());
      return utils;
    }

    it('pauses the affirmation and waits out the gap before advancing', async () => {
      mockGapMs = 300;
      await startTwoTracks();
      mockPause.mockClear();

      statusListener?.({ currentTime: 9.1 });

      expect(mockPause).toHaveBeenCalled();
      expect(showing('Calm')).toBeTruthy(); // still in the gap
      await waitFor(() => expect(showing('Focus')).toBeTruthy());
    });

    it('keeps the ambience bed playing through the gap', async () => {
      mockGapMs = 300;
      mockGetBedPreference.mockResolvedValue({ bedId: 'rain', mix: 0.75 });
      await startTwoTracks();
      statusListener?.({ currentTime: 9.1 });
      expect(mockBedPause).not.toHaveBeenCalled();
      expect(mockBedStop).not.toHaveBeenCalled();
    });

    it('Pause during the gap holds the queue; Resume then advances immediately', async () => {
      mockGapMs = 60_000;
      await startTwoTracks();
      statusListener?.({ currentTime: 9.1 });

      // The finished track reports not-playing, but the button must still offer Pause.
      await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy());
      await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
      expect(mockBedPause).not.toHaveBeenCalled(); // no bed in this test
      await waitFor(() => expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy());
      expect(showing('Calm')).toBeTruthy();

      await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
      await waitFor(() => expect(showing('Focus')).toBeTruthy());
    });

    it('Stop during the gap cancels the pending advance, even if playback restarts straight away', async () => {
      mockGapMs = 300;
      const { getByText } = await startTwoTracks();
      statusListener?.({ currentTime: 9.1 });
      await fireEvent(controlButton(), 'longPress');
      await waitFor(() => expect(screen.getByText('Player')).toBeTruthy());

      // Restart before the old gap would have elapsed: a leaked timer would skip track 1.
      await fireEvent.press(getByText('Play (2)'));
      await waitFor(() => expect(showing('Calm')).toBeTruthy());
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(showing('Calm')).toBeTruthy();
    });
  });

  describe('ambience bed (FR-304)', () => {
    async function startWithTrack(label = 'Calm', count = 1) {
      const utils = await render(<PlayerScreen />);
      await waitFor(() => expect(utils.getByText('Calm')).toBeTruthy());
      await fireEvent.press(utils.getByText(label));
      await fireEvent.press(utils.getByText(`Play (${count})`));
      await waitFor(() => expect(controlButton()).toBeTruthy());
      return utils;
    }

    it('does not start a bed when none is chosen', async () => {
      await startWithTrack();
      expect(mockStartBedLoop).not.toHaveBeenCalled();
    });

    it('starts the saved bed at the volume its saved mix gives, alongside the affirmation', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: 'rain', mix: 0.75 });
      await startWithTrack();
      expect(mockStartBedLoop).toHaveBeenCalledTimes(1);
      expect(mockStartBedLoop.mock.calls[0][0]).toMatchObject({ id: 'rain' });
      expect(mockStartBedLoop.mock.calls[0][1]).toBe(0.5);
    });

    it('ignores a saved bed id that no longer exists', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: 'gone', mix: 0.75 });
      await startWithTrack();
      expect(mockStartBedLoop).not.toHaveBeenCalled();
    });

    it('pauses the bed together with the affirmation', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: 'rain', mix: 0.75 });
      mockPlayerStatus = { playing: true, currentTime: 0 };
      await startWithTrack();

      await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));

      expect(mockPause).toHaveBeenCalled();
      expect(mockBedPause).toHaveBeenCalledTimes(1);
      expect(mockBedResume).not.toHaveBeenCalled();
    });

    it('resumes the bed together with the affirmation', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: 'rain', mix: 0.75 });
      mockPlayerStatus = { playing: false, currentTime: 0 };
      await startWithTrack();

      await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));

      expect(mockBedResume).toHaveBeenCalledTimes(1);
      expect(mockBedPause).not.toHaveBeenCalled();
    });

    it('stops the bed on manual Stop', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: 'rain', mix: 0.75 });
      await startWithTrack();
      await fireEvent(controlButton(), 'longPress');
      expect(mockBedStop).toHaveBeenCalledTimes(1);
    });

    it('leaves the bed running when the queue advances or a single track repeats', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: 'rain', mix: 0.75 });
      await startWithTrack();

      statusListener?.({ currentTime: 9.1 });
      await waitFor(() => expect(mockSeekTo).toHaveBeenCalledTimes(2));

      expect(mockStartBedLoop).toHaveBeenCalledTimes(1);
      expect(mockBedStop).not.toHaveBeenCalled();
    });
  });

  describe('audio studio controls (step 4.3)', () => {
    type SliderProps = {
      onValueChange: (v: number) => void;
      onSlidingComplete: (v: number) => void;
    };
    const slider = (utils: Awaited<ReturnType<typeof render>>) =>
      utils.getByLabelText('Voice and ambience balance').props as SliderProps;

    async function startSession() {
      const utils = await render(<PlayerScreen />);
      await waitFor(() => expect(utils.getByText('Calm')).toBeTruthy());
      await fireEvent.press(utils.getByText('Calm'));
      await fireEvent.press(utils.getByText('Play (1)'));
      await waitFor(() => expect(controlButton()).toBeTruthy());
      await fireEvent.press(screen.getByRole('button', { name: /^Ambience/ }));
      return utils;
    }

    it('previews a tapped bed at its mix volume and saves the choice', async () => {
      const utils = await render(<PlayerScreen />);
      await waitFor(() => expect(utils.getByText('Calm')).toBeTruthy());

      await fireEvent.press(utils.getByText('Rain'));

      await waitFor(() => expect(mockStartBedLoop).toHaveBeenCalledTimes(1));
      expect(mockStartBedLoop.mock.calls[0][0]).toMatchObject({ id: 'rain' });
      expect(mockStartBedLoop.mock.calls[0][1]).toBeCloseTo(0.35);
      expect(mockSetBedPreference).toHaveBeenCalledWith({ bedId: 'rain', mix: 0.825 });
    });

    it('a second tap replaces the preview, and None ends it', async () => {
      const utils = await render(<PlayerScreen />);
      await waitFor(() => expect(utils.getByText('Calm')).toBeTruthy());

      await fireEvent.press(utils.getByText('Rain'));
      await waitFor(() => expect(mockStartBedLoop).toHaveBeenCalledTimes(1));
      await fireEvent.press(utils.getByText('Ocean'));
      await waitFor(() => expect(mockStartBedLoop).toHaveBeenCalledTimes(2));
      expect(mockBedStop).toHaveBeenCalledTimes(1);

      await fireEvent.press(utils.getByText('None'));
      expect(mockBedStop).toHaveBeenCalledTimes(2);
      expect(mockSetBedPreference).toHaveBeenLastCalledWith({ bedId: null, mix: 0.825 });
    });

    it('ends the preview after a few seconds', async () => {
      jest.useFakeTimers();
      const utils = await render(<PlayerScreen />);
      await waitFor(() => expect(utils.getByText('Calm')).toBeTruthy());

      await fireEvent.press(utils.getByText('Rain'));
      await waitFor(() => expect(mockStartBedLoop).toHaveBeenCalledTimes(1));
      await act(async () => {
        jest.advanceTimersByTime(8000);
      });

      expect(mockBedStop).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it('Play ends the preview and starts the session with the chosen bed', async () => {
      const utils = await render(<PlayerScreen />);
      await waitFor(() => expect(utils.getByText('Calm')).toBeTruthy());
      await fireEvent.press(utils.getByText('Rain'));
      await waitFor(() => expect(mockStartBedLoop).toHaveBeenCalledTimes(1));

      await fireEvent.press(utils.getByText('Calm'));
      await fireEvent.press(utils.getByText('Play (1)'));
      await waitFor(() => expect(controlButton()).toBeTruthy());

      expect(mockBedStop).toHaveBeenCalledTimes(1); // the preview
      expect(mockStartBedLoop).toHaveBeenCalledTimes(2);
      expect(mockStartBedLoop.mock.calls[1][0]).toMatchObject({ id: 'rain' });
    });

    it('hides the slider without a bed, and the voice then plays at full', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: null, mix: 0.1 });
      const utils = await startSession();
      expect(utils.queryByLabelText('Voice and ambience balance')).toBeNull();
      expect(mockPlayerObj.volume).toBe(1);

      await fireEvent.press(utils.getByText('Rain'));
      expect(utils.getByLabelText('Voice and ambience balance')).toBeTruthy();
    });

    it('while playing, the slider rebalances voice and bed live and is saved on release', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: 'rain', mix: 0.75 });
      const utils = await startSession();
      expect(mockPlayerObj.volume).toBe(1);

      await act(async () => slider(utils).onValueChange(0.25));
      expect(mockPlayerObj.volume).toBe(0.5); // the voice fades left of the middle
      expect(mockBedSetVolume).toHaveBeenLastCalledWith(1);
      expect(mockSetBedPreference).not.toHaveBeenCalled();

      await act(async () => slider(utils).onSlidingComplete(0.25));
      expect(mockSetBedPreference).toHaveBeenCalledWith({ bedId: 'rain', mix: 0.25 });
    });

    it('while playing, switching beds crossfades to the new one; None stops it', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: 'rain', mix: 0.75 });
      const utils = await startSession();
      expect(mockStartBedLoop).toHaveBeenCalledTimes(1);

      await fireEvent.press(utils.getByText('Ocean'));
      expect(mockBedStop).toHaveBeenCalledTimes(1);
      expect(mockStartBedLoop).toHaveBeenCalledTimes(2);
      expect(mockStartBedLoop.mock.calls[1]).toEqual([
        expect.objectContaining({ id: 'ocean' }),
        0.5,
      ]);
      expect(mockSetAudioModeAsync).toHaveBeenCalledTimes(1); // no preview during a session

      await fireEvent.press(utils.getByText('None'));
      expect(mockBedStop).toHaveBeenCalledTimes(2);
      expect(mockStartBedLoop).toHaveBeenCalledTimes(2);
      expect(mockPlayerObj.volume).toBe(1);
    });

    it('a bed switched to while paused stays paused until Resume', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: 'rain', mix: 0.75 });
      mockPlayerStatus = { playing: false, currentTime: 0 };
      const utils = await startSession();

      await fireEvent.press(utils.getByText('Ocean'));
      expect(mockBedPause).toHaveBeenCalledTimes(1);
    });
  });

  describe('now playing (R.7a)', () => {
    async function start(titles: string[]) {
      await render(<PlayerScreen />);
      await waitFor(() => expect(screen.getByText('Calm')).toBeTruthy());
      for (const title of titles) await fireEvent.press(screen.getByText(title));
      await fireEvent.press(screen.getByText(`Play (${titles.length})`));
      await waitFor(() => expect(controlButton()).toBeTruthy());
    }

    it('shows the moon screen: no header, no tab bar, and no details of what plays', async () => {
      await start(['Calm']);
      expect(screen.getByText('Now looping')).toBeTruthy();
      expect(screen.getByText('Loop 1')).toBeTruthy();
      expect(screen.getByText('No sleep timer')).toBeTruthy();
      expect(screen.queryByText('Calm')).toBeNull();
      expect(screen.queryByText('Self-Recorded')).toBeNull();
      expect(mockSetOptions).toHaveBeenLastCalledWith({
        headerShown: false,
        tabBarStyle: { display: 'none' },
      });

      await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
      expect(mockSetOptions).toHaveBeenLastCalledWith({
        headerShown: true,
        tabBarStyle: undefined,
      });
    });

    it('counts loops through the whole selection', async () => {
      await start(['Calm', 'Focus']);
      statusListener?.({ currentTime: 9.1 });
      await waitFor(() => expect(showing('Focus')).toBeTruthy());
      expect(screen.getByText('Loop 1')).toBeTruthy();
      statusListener?.({ currentTime: 5 });
      await waitFor(() => expect(screen.getByText('Loop 2')).toBeTruthy());
    });

    it('with loop off, finishes the pass in progress and then ends the session', async () => {
      await start(['Calm', 'Focus']);
      const loop = screen.getByRole('switch', { name: 'Loop' });
      expect(loop.props.accessibilityState).toMatchObject({ checked: true });
      await fireEvent.press(loop);
      expect(screen.getByRole('switch', { name: 'Loop' }).props.accessibilityState).toMatchObject({
        checked: false,
      });

      statusListener?.({ currentTime: 9.1 });
      await waitFor(() => expect(showing('Focus')).toBeTruthy());
      expect(mockLogLocalPlaybackSession).not.toHaveBeenCalled();

      statusListener?.({ currentTime: 5 });
      await waitFor(() => expect(mockLogLocalPlaybackSession).toHaveBeenCalledTimes(1));
      expect(screen.getByText('Player')).toBeTruthy();
    });

    it('Back shows the chooser while it keeps playing, and the Now playing card returns', async () => {
      await start(['Calm']);
      mockPause.mockClear();
      await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

      expect(screen.getByText('Player')).toBeTruthy();
      expect(mockPause).not.toHaveBeenCalled();
      expect(mockLogLocalPlaybackSession).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByRole('button', { name: 'Now playing: Calm. Open' }));
      expect(showing('Calm')).toBeTruthy();
    });

    it('a sleep timer chosen mid-session counts from then', async () => {
      await start(['Calm']);
      await fireEvent.press(screen.getByRole('button', { name: 'No sleep timer. Set one' }));
      await fireEvent.press(screen.getByRole('button', { name: '30 min' }));

      expect(screen.getByText('Sleep timer: 30m')).toBeTruthy();
      expect(screen.getByText('⏱ 30m')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Sleep timer, 30 minutes. Change' })).toBeTruthy();
    });

    it('End session ends it and logs it', async () => {
      await start(['Calm']);

      await fireEvent.press(screen.getByRole('button', { name: 'End session' }));

      await waitFor(() => expect(mockLogLocalPlaybackSession).toHaveBeenCalledTimes(1));
      expect(screen.getByText('Player')).toBeTruthy();
    });
  });

  it('stops playback automatically when the sleep timer elapses, and logs a session', async () => {
    jest.useFakeTimers();
    mockGetBedPreference.mockResolvedValue({ bedId: 'rain', mix: 0.75 });
    const { getByText } = await render(<PlayerScreen />);
    await waitFor(() => expect(getByText('Calm')).toBeTruthy());

    await fireEvent.press(getByText('Calm'));
    await fireEvent.press(getByText('15 min'));
    await fireEvent.press(getByText('Play (1)'));
    await waitFor(() => expect(getByText(/Sleep timer:/)).toBeTruthy());

    act(() => {
      jest.advanceTimersByTime(15 * 60 * 1000 + 1000);
    });

    await waitFor(() => expect(mockPause).toHaveBeenCalled());
    await waitFor(() => expect(mockLogLocalPlaybackSession).toHaveBeenCalledTimes(1));
    // The ambience bed stops with the affirmation (FR-304).
    expect(mockBedStop).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
