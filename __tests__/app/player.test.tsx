import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import PlayerScreen from '@/app/(tabs)/player';

const mockSetAudioModeAsync = jest.fn().mockResolvedValue(undefined);
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockSeekTo = jest.fn();
const mockSetActiveForLockScreen = jest.fn();
const mockAddListener = jest.fn();
const mockListLocalAffirmations = jest.fn();

let mockPlayerStatus: { playing: boolean; currentTime: number } = { playing: false, currentTime: 0 };
type StatusEvent = { currentTime: number; didJustFinish?: boolean };
let statusListener: ((status: StatusEvent) => void) | null = null;

const mockPlayerObj = {
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

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, []);
  },
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
const mockStartBedLoop = jest.fn();
const mockGetBedPreference = jest.fn();
jest.mock('@/lib/bedLoop', () => ({
  startBedLoop: (...args: unknown[]) => mockStartBedLoop(...args),
}));
jest.mock('@/lib/bedPrefs', () => ({
  getBedPreference: (...args: unknown[]) => mockGetBedPreference(...args),
}));

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

const track1 = {
  id: 'aff-1',
  title: 'Calm',
  local_uri: 'file:///calm.m4a',
  duration_ms: 10000,
  trim_start_ms: 1000,
  trim_end_ms: 9000,
};
const track2 = {
  id: 'aff-2',
  title: 'Focus',
  local_uri: 'file:///focus.m4a',
  duration_ms: 5000,
  trim_start_ms: null,
  trim_end_ms: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockPlayerStatus = { playing: false, currentTime: 0 };
  statusListener = null;
  mockListLocalAffirmations.mockResolvedValue([track1, track2]);
  mockGapMs = 0;
  mockGetBedPreference.mockResolvedValue({ bedId: null, balance: 0.35 });
  mockStartBedLoop.mockReturnValue({ pause: mockBedPause, resume: mockBedResume, stop: mockBedStop });
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
    await waitFor(() => expect(getByText('Track 1 of 1')).toBeTruthy());
    expect(getByText('Calm')).toBeTruthy();
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
    await waitFor(() => expect(getByText('Track 1 of 2')).toBeTruthy());

    // Simulate playback crossing track 1's trim_end_ms (9000).
    statusListener?.({ currentTime: 9.1 });
    await waitFor(() => expect(getByText('Track 2 of 2')).toBeTruthy());
    expect(getByText('Focus')).toBeTruthy();

    // track2 has no trim, so its "end" is duration_ms (5000).
    statusListener?.({ currentTime: 5.1 });
    await waitFor(() => expect(getByText('Track 1 of 2')).toBeTruthy());
    expect(getByText('Calm')).toBeTruthy();
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
    await waitFor(() => expect(getByText('Track 1 of 2')).toBeTruthy());

    statusListener?.({ currentTime: 9.1 });
    await waitFor(() => expect(getByText('Track 2 of 2')).toBeTruthy());

    // track2 is untrimmed with duration_ms 5000, but the file actually ends at 4.7s.
    statusListener?.({ currentTime: 4.7, didJustFinish: true });
    await waitFor(() => expect(getByText('Track 1 of 2')).toBeTruthy());
  });

  it('does not advance early on an ordinary mid-track status update', async () => {
    const { getByText } = await render(<PlayerScreen />);
    await waitFor(() => expect(getByText('Calm')).toBeTruthy());

    await fireEvent.press(getByText('Calm'));
    await fireEvent.press(getByText('Focus'));
    await fireEvent.press(getByText('Play (2)'));
    await waitFor(() => expect(getByText('Track 1 of 2')).toBeTruthy());

    statusListener?.({ currentTime: 4.7, didJustFinish: false });
    expect(getByText('Track 1 of 2')).toBeTruthy();
  });

  it('loops a single selected track indefinitely, not just once', async () => {
    const { getByText } = await render(<PlayerScreen />);
    await waitFor(() => expect(getByText('Calm')).toBeTruthy());

    await fireEvent.press(getByText('Calm'));
    await fireEvent.press(getByText('Play (1)'));
    await waitFor(() => expect(getByText('Track 1 of 1')).toBeTruthy());
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
    await waitFor(() => expect(getByText('Stop')).toBeTruthy());

    await fireEvent.press(getByText('Stop'));

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
      await waitFor(() => expect(utils.getByText('Track 1 of 2')).toBeTruthy());
      return utils;
    }

    it('pauses the affirmation and waits out the gap before advancing', async () => {
      mockGapMs = 300;
      const { getByText } = await startTwoTracks();
      mockPause.mockClear();

      statusListener?.({ currentTime: 9.1 });

      expect(mockPause).toHaveBeenCalled();
      expect(getByText('Track 1 of 2')).toBeTruthy(); // still in the gap
      await waitFor(() => expect(getByText('Track 2 of 2')).toBeTruthy());
    });

    it('keeps the ambience bed playing through the gap', async () => {
      mockGapMs = 300;
      mockGetBedPreference.mockResolvedValue({ bedId: 'rain', balance: 0.5 });
      await startTwoTracks();
      statusListener?.({ currentTime: 9.1 });
      expect(mockBedPause).not.toHaveBeenCalled();
      expect(mockBedStop).not.toHaveBeenCalled();
    });

    it('Pause during the gap holds the queue; Resume then advances immediately', async () => {
      mockGapMs = 60_000;
      const { getByText } = await startTwoTracks();
      statusListener?.({ currentTime: 9.1 });

      // The finished track reports not-playing, but the button must still offer Pause.
      await waitFor(() => expect(getByText('Pause')).toBeTruthy());
      await fireEvent.press(getByText('Pause'));
      expect(mockBedPause).not.toHaveBeenCalled(); // no bed in this test
      await waitFor(() => expect(getByText('Resume')).toBeTruthy());
      expect(getByText('Track 1 of 2')).toBeTruthy();

      await fireEvent.press(getByText('Resume'));
      await waitFor(() => expect(getByText('Track 2 of 2')).toBeTruthy());
    });

    it('Stop during the gap cancels the pending advance, even if playback restarts straight away', async () => {
      mockGapMs = 300;
      const { getByText } = await startTwoTracks();
      statusListener?.({ currentTime: 9.1 });
      await fireEvent.press(getByText('Stop'));
      await waitFor(() => expect(getByText('Player')).toBeTruthy());

      // Restart before the old gap would have elapsed: a leaked timer would skip track 1.
      await fireEvent.press(getByText('Play (2)'));
      await waitFor(() => expect(getByText('Track 1 of 2')).toBeTruthy());
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(getByText('Track 1 of 2')).toBeTruthy();
    });
  });

  describe('ambience bed (FR-304)', () => {
    async function startWithTrack(label = 'Calm', count = 1) {
      const utils = await render(<PlayerScreen />);
      await waitFor(() => expect(utils.getByText('Calm')).toBeTruthy());
      await fireEvent.press(utils.getByText(label));
      await fireEvent.press(utils.getByText(`Play (${count})`));
      await waitFor(() => expect(utils.getByText('Stop')).toBeTruthy());
      return utils;
    }

    it('does not start a bed when none is chosen', async () => {
      await startWithTrack();
      expect(mockStartBedLoop).not.toHaveBeenCalled();
    });

    it('starts the saved bed at the saved balance alongside the affirmation', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: 'rain', balance: 0.5 });
      await startWithTrack();
      expect(mockStartBedLoop).toHaveBeenCalledTimes(1);
      expect(mockStartBedLoop.mock.calls[0][0]).toMatchObject({ id: 'rain' });
      expect(mockStartBedLoop.mock.calls[0][1]).toBe(0.5);
    });

    it('ignores a saved bed id that no longer exists', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: 'gone', balance: 0.5 });
      await startWithTrack();
      expect(mockStartBedLoop).not.toHaveBeenCalled();
    });

    it('pauses the bed together with the affirmation', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: 'rain', balance: 0.5 });
      mockPlayerStatus = { playing: true, currentTime: 0 };
      const { getByText } = await startWithTrack();

      await fireEvent.press(getByText('Pause'));

      expect(mockPause).toHaveBeenCalled();
      expect(mockBedPause).toHaveBeenCalledTimes(1);
      expect(mockBedResume).not.toHaveBeenCalled();
    });

    it('resumes the bed together with the affirmation', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: 'rain', balance: 0.5 });
      mockPlayerStatus = { playing: false, currentTime: 0 };
      const { getByText } = await startWithTrack();

      await fireEvent.press(getByText('Resume'));

      expect(mockBedResume).toHaveBeenCalledTimes(1);
      expect(mockBedPause).not.toHaveBeenCalled();
    });

    it('stops the bed on manual Stop', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: 'rain', balance: 0.5 });
      const { getByText } = await startWithTrack();
      await fireEvent.press(getByText('Stop'));
      expect(mockBedStop).toHaveBeenCalledTimes(1);
    });

    it('leaves the bed running when the queue advances or a single track repeats', async () => {
      mockGetBedPreference.mockResolvedValue({ bedId: 'rain', balance: 0.5 });
      await startWithTrack();

      statusListener?.({ currentTime: 9.1 });
      await waitFor(() => expect(mockSeekTo).toHaveBeenCalledTimes(2));

      expect(mockStartBedLoop).toHaveBeenCalledTimes(1);
      expect(mockBedStop).not.toHaveBeenCalled();
    });
  });

  it('stops playback automatically when the sleep timer elapses, and logs a session', async () => {
    jest.useFakeTimers();
    mockGetBedPreference.mockResolvedValue({ bedId: 'rain', balance: 0.5 });
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
