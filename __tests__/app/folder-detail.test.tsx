import { render, waitFor } from '@testing-library/react-native';

import FolderDetailScreen from '@/app/folder/[id]';

const mockGetLocalFolder = jest.fn();
const mockListLocalAffirmations = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'folder-1' }),
  useFocusEffect: (effect: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, []);
  },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/lib/folders.local', () => ({
  getLocalFolder: (...args: unknown[]) => mockGetLocalFolder(...args),
}));

jest.mock('@/lib/affirmations.local', () => ({
  listLocalAffirmations: (...args: unknown[]) => mockListLocalAffirmations(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockListLocalAffirmations.mockResolvedValue([]);
});

describe('FolderDetailScreen', () => {
  it('shows a not-found message when the folder does not exist', async () => {
    mockGetLocalFolder.mockResolvedValue(null);

    const { getByText } = await render(<FolderDetailScreen />);

    await waitFor(() => expect(getByText('Folder not found')).toBeTruthy());
  });

  it('shows the folder name and an empty state with no recordings in it', async () => {
    mockGetLocalFolder.mockResolvedValue({
      id: 'folder-1',
      user_id: 'user-1',
      name: 'Sleep',
      created_at: '',
      updated_at: '',
      synced_at: null,
    });

    const { getByText } = await render(<FolderDetailScreen />);

    await waitFor(() => expect(getByText('Sleep')).toBeTruthy());
    expect(getByText('No recordings in this folder yet.')).toBeTruthy();
  });

  it('lists only recordings assigned to this folder', async () => {
    mockGetLocalFolder.mockResolvedValue({
      id: 'folder-1',
      user_id: 'user-1',
      name: 'Sleep',
      created_at: '',
      updated_at: '',
      synced_at: null,
    });
    mockListLocalAffirmations.mockResolvedValue([
      {
        id: 'aff-1',
        title: 'In this folder',
        folder_id: 'folder-1',
        duration_ms: 5000,
        trim_start_ms: null,
        trim_end_ms: null,
      },
      {
        id: 'aff-2',
        title: 'In a different folder',
        folder_id: 'folder-2',
        duration_ms: 5000,
        trim_start_ms: null,
        trim_end_ms: null,
      },
      {
        id: 'aff-3',
        title: 'Unfiled',
        folder_id: null,
        duration_ms: 5000,
        trim_start_ms: null,
        trim_end_ms: null,
      },
    ]);

    const { getByText, queryByText } = await render(<FolderDetailScreen />);

    await waitFor(() => expect(getByText('In this folder')).toBeTruthy());
    expect(queryByText('In a different folder')).toBeNull();
    expect(queryByText('Unfiled')).toBeNull();
  });
});
