import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import LibraryScreen from '@/app/(tabs)/index';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useFocusEffect: (effect: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, []);
  },
}));

let mockDisplayName: string | undefined = 'Maya';
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', user_metadata: { display_name: mockDisplayName } } }),
}));

const mockListLocalAffirmations = jest.fn();
jest.mock('@/lib/affirmations.local', () => ({
  listLocalAffirmations: (...args: unknown[]) => mockListLocalAffirmations(...args),
}));

const mockListLocalFolders = jest.fn();
const mockCreateLocalFolder = jest.fn();
jest.mock('@/lib/folders.local', () => ({
  listLocalFolders: (...args: unknown[]) => mockListLocalFolders(...args),
  createLocalFolder: (...args: unknown[]) => mockCreateLocalFolder(...args),
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

const folder = (id: string, name: string) => ({
  id,
  user_id: 'user-1',
  name,
  created_at: '',
  updated_at: '',
  synced_at: null,
});

const recording = (id: string, folderId: string | null, durationMs: number) => ({
  id,
  folder_id: folderId,
  duration_ms: durationMs,
  trim_start_ms: null,
  trim_end_ms: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDisplayName = 'Maya';
  mockListLocalAffirmations.mockResolvedValue([]);
  mockListLocalFolders.mockResolvedValue([]);
  mockListLocalPlaybackSessions.mockResolvedValue([]);
  mockComputeStreak.mockReturnValue(0);
  mockCreateLocalFolder.mockResolvedValue(folder('new', 'New'));
});

describe('LibraryScreen', () => {
  it('greets the user by the name given at sign-up', async () => {
    await render(<LibraryScreen />);

    expect(await screen.findByText(/^Good (morning|afternoon|evening), Maya\.$/)).toBeTruthy();
  });

  it('shows one card per folder with its recording count and total length', async () => {
    mockListLocalFolders.mockResolvedValue([
      folder('f1', 'Sleep & calm'),
      folder('f2', 'Confidence'),
    ]);
    mockListLocalAffirmations.mockResolvedValue([
      recording('a', 'f1', 32000),
      recording('b', 'f1', 28000),
    ]);
    await render(<LibraryScreen />);

    expect(
      await screen.findByRole('button', { name: 'Sleep & calm, 2 recordings · 1m 00s' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confidence, No recordings yet' })).toBeTruthy();
  });

  it('shows an Unfiled card only when some recordings have no folder', async () => {
    mockListLocalAffirmations.mockResolvedValue([recording('a', null, 5000)]);
    await render(<LibraryScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Unfiled, 1 recording · 5s' }));
    expect(mockPush).toHaveBeenCalledWith('/folder/unfiled');
  });

  it('has no Unfiled card when everything is filed', async () => {
    mockListLocalFolders.mockResolvedValue([folder('f1', 'Sleep')]);
    mockListLocalAffirmations.mockResolvedValue([recording('a', 'f1', 5000)]);
    await render(<LibraryScreen />);

    await screen.findByRole('button', { name: 'Sleep, 1 recording · 5s' });
    expect(screen.queryByText('Unfiled')).toBeNull();
  });

  it('opens a folder from its card', async () => {
    mockListLocalFolders.mockResolvedValue([folder('f1', 'Sleep')]);
    await render(<LibraryScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Sleep, No recordings yet' }));
    expect(mockPush).toHaveBeenCalledWith('/folder/f1');
  });

  it('creates a folder from the dashed card', async () => {
    await render(<LibraryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Create a new folder' }));
    await fireEvent.changeText(screen.getByLabelText('Folder name'), '  Letting go  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(mockCreateLocalFolder).toHaveBeenCalledWith('user-1', 'Letting go'));
  });

  it('the + button also creates a folder', async () => {
    await render(<LibraryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'New folder' }));

    expect(screen.getByLabelText('Folder name')).toBeTruthy();
  });

  it('the mic starts a new affirmation', async () => {
    await render(<LibraryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'New affirmation' }));

    expect(mockPush).toHaveBeenCalledWith('/new-affirmation');
  });

  it('shows the streak as a pill with its growth stage', async () => {
    mockListLocalPlaybackSessions.mockResolvedValue([
      { id: 's1', played_at: '2026-09-23T22:00:00.000Z' },
    ]);
    mockComputeStreak.mockReturnValue(4);
    await render(<LibraryScreen />);

    expect(await screen.findByLabelText('4 night streak')).toBeTruthy();
    expect(screen.getByText('🌿')).toBeTruthy();
    expect(mockComputeStreak).toHaveBeenCalledWith(['2026-09-23T22:00:00.000Z']);
  });

  it('shows a quiet line when there is no streak yet', async () => {
    await render(<LibraryScreen />);

    expect(await screen.findByText('No streak yet — play tonight to start one.')).toBeTruthy();
  });
});
