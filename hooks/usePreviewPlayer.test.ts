import { act, renderHook } from '@testing-library/react-native';

import type { LocalAffirmation } from '@/lib/affirmations.local';

import { usePreviewPlayer } from './usePreviewPlayer';

type StatusListener = (status: { currentTime: number; didJustFinish: boolean }) => void;

const mockPlayer = {
  replace: jest.fn(),
  seekTo: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  remove: jest.fn(),
  listener: null as StatusListener | null,
  addListener: jest.fn((_event: string, listener: StatusListener) => {
    mockPlayer.listener = listener;
    return { remove: jest.fn() };
  }),
};

jest.mock('expo-audio', () => ({
  createAudioPlayer: () => mockPlayer,
}));

const recording = (overrides: Partial<LocalAffirmation> = {}): LocalAffirmation => ({
  id: 'a1',
  user_id: 'u',
  folder_id: null,
  title: 'One',
  local_uri: 'file:///a1.m4a',
  storage_path: null,
  duration_ms: 30000,
  source: 'recorded',
  voice_id: null,
  script_text: null,
  trim_start_ms: null,
  trim_end_ms: null,
  created_at: '',
  updated_at: '',
  synced_at: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayer.listener = null;
});

describe('usePreviewPlayer', () => {
  it('plays a recording from its trim start and stops at its trim end', async () => {
    const { result } = await renderHook(() => usePreviewPlayer());

    await act(async () =>
      result.current.toggle(recording({ trim_start_ms: 2000, trim_end_ms: 5000 })),
    );

    expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: 'file:///a1.m4a' });
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(2);
    expect(mockPlayer.play).toHaveBeenCalled();
    expect(result.current.playingId).toBe('a1');

    await act(async () => mockPlayer.listener?.({ currentTime: 4.9, didJustFinish: false }));
    expect(result.current.playingId).toBe('a1');

    await act(async () => mockPlayer.listener?.({ currentTime: 5.0, didJustFinish: false }));
    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(result.current.playingId).toBeNull();
  });

  it('stops when an untrimmed recording finishes', async () => {
    const { result } = await renderHook(() => usePreviewPlayer());
    await act(async () => result.current.toggle(recording()));

    await act(async () => mockPlayer.listener?.({ currentTime: 30, didJustFinish: true }));

    expect(result.current.playingId).toBeNull();
  });

  it('tapping the playing recording again stops it', async () => {
    const { result } = await renderHook(() => usePreviewPlayer());
    await act(async () => result.current.toggle(recording()));

    await act(async () => result.current.toggle(recording()));

    expect(result.current.playingId).toBeNull();
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('tapping another recording switches to it', async () => {
    const { result } = await renderHook(() => usePreviewPlayer());
    await act(async () => result.current.toggle(recording()));

    await act(async () =>
      result.current.toggle(recording({ id: 'a2', local_uri: 'file:///a2.m4a' })),
    );

    expect(mockPlayer.replace).toHaveBeenLastCalledWith({ uri: 'file:///a2.m4a' });
    expect(result.current.playingId).toBe('a2');
  });

  it('releases the player when unmounted', async () => {
    const { unmount } = await renderHook(() => usePreviewPlayer());

    await unmount();

    expect(mockPlayer.remove).toHaveBeenCalled();
  });
});
