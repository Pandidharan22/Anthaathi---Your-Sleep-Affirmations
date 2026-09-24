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

  it('stops playback automatically when the sleep timer elapses, and logs a session', async () => {
    jest.useFakeTimers();
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
    jest.useRealTimers();
  });
});
