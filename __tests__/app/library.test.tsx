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

beforeEach(() => {
  jest.clearAllMocks();
  mockListLocalAffirmations.mockResolvedValue([]);
  mockListLocalFolders.mockResolvedValue([]);
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
    expect(getByText('Sleep · 0:10 · trimmed')).toBeTruthy();
    expect(getByText('Unfiled one')).toBeTruthy();
    expect(getByText('0:05')).toBeTruthy();
  });
});
