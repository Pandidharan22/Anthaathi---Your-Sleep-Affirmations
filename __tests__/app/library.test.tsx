import { render, waitFor } from '@testing-library/react-native';

import LibraryScreen from '@/app/(tabs)/index';

const mockListLocalAffirmations = jest.fn();
const mockListLocalFolders = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
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

jest.mock('@/lib/folders.local', () => ({
  listLocalFolders: (...args: unknown[]) => mockListLocalFolders(...args),
}));

const mockListLocalPlaybackSessions = jest.fn();
jest.mock('@/lib/playbackSessions.local', () => ({
  listLocalPlaybackSessions: (...args: unknown[]) => mockListLocalPlaybackSessions(...args),
}));

const mockComputeStreak = jest.fn();
jest.mock('@/lib/streak', () => ({
  computeStreak: (...args: unknown[]) => mockComputeStreak(...args),
  getStreakEmoji: jest.requireActual('@/lib/streak').getStreakEmoji,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockListLocalAffirmations.mockResolvedValue([]);
  mockListLocalFolders.mockResolvedValue([]);
  mockListLocalPlaybackSessions.mockResolvedValue([]);
  mockComputeStreak.mockReturnValue(0);
});

describe('LibraryScreen', () => {
  it('shows the empty state when there are no recordings', async () => {
    const { getByText } = await render(<LibraryScreen />);

    await waitFor(() =>
      expect(getByText('No recordings yet — tap Record to make your first affirmation.')).toBeTruthy(),
    );
  });

  it('lists recordings with their folder name, duration, and trimmed marker', async () => {
    mockListLocalFolders.mockResolvedValue([
      { id: 'folder-1', user_id: 'user-1', name: 'Sleep', created_at: '', updated_at: '', synced_at: null },
    ]);
    mockListLocalAffirmations.mockResolvedValue([
      {
        id: 'aff-1',
        title: 'Bedtime affirmation',
        folder_id: 'folder-1',
        duration_ms: 10000,
        trim_start_ms: 0,
        trim_end_ms: 8000,
      },
      {
        id: 'aff-2',
        title: 'Unfiled one',
        folder_id: null,
        duration_ms: 5000,
        trim_start_ms: null,
        trim_end_ms: null,
      },
    ]);

    const { getByText } = await render(<LibraryScreen />);

    await waitFor(() => expect(getByText('Bedtime affirmation')).toBeTruthy());
    expect(getByText('Sleep · 0:08 · trimmed')).toBeTruthy();
    expect(getByText('Unfiled one')).toBeTruthy();
    expect(getByText('0:05')).toBeTruthy();
  });

  it('shows a no-streak message when there are no playback sessions yet', async () => {
    const { getByText } = await render(<LibraryScreen />);

    await waitFor(() => expect(getByText('No streak yet — play tonight to start one')).toBeTruthy());
  });

  it('shows the computed streak with its growth emoji', async () => {
    mockListLocalPlaybackSessions.mockResolvedValue([
      { id: 's1', user_id: 'user-1', played_at: '2026-09-23T22:00:00.000Z', duration_ms: 1000, synced_at: null },
    ]);
    mockComputeStreak.mockReturnValue(4);

    const { getByText } = await render(<LibraryScreen />);

    await waitFor(() => expect(getByText('🌿 4-day streak')).toBeTruthy());
    expect(mockComputeStreak).toHaveBeenCalledWith(['2026-09-23T22:00:00.000Z']);
  });
});
