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
let statusListener: ((status: { currentTime: number }) => void) | null = null;

const mockPlayerObj = {
  play: mockPlay,
  pause: mockPause,
  seekTo: mockSeekTo,
  setActiveForLockScreen: mockSetActiveForLockScreen,
  addListener: (event: string, cb: (status: { currentTime: number }) => void) => {
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

  it('Stop pauses playback and returns to the selection screen', async () => {
    const { getByText } = await render(<PlayerScreen />);
    await waitFor(() => expect(getByText('Calm')).toBeTruthy());

    await fireEvent.press(getByText('Calm'));
    await fireEvent.press(getByText('Play (1)'));
    await waitFor(() => expect(getByText('Stop')).toBeTruthy());

    await fireEvent.press(getByText('Stop'));

    expect(mockPause).toHaveBeenCalled();
    await waitFor(() => expect(getByText('Player')).toBeTruthy());
  });

  it('stops playback automatically when the sleep timer elapses', async () => {
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
    jest.useRealTimers();
  });
});
