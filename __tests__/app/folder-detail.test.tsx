import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import FolderDetailScreen from '@/app/folder/[id]';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockId = 'folder-1';
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    back: () => mockBack(),
  },
  useLocalSearchParams: () => ({ id: mockId }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]);
  },
}));

// One stable user object, like the real AuthProvider (a new object per render would
// re-run the screen's focus effect forever).
const mockUser = { id: 'user-1' };
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockGetLocalFolder = jest.fn();
const mockRenameLocalFolder = jest.fn();
const mockDeleteLocalFolder = jest.fn();
jest.mock('@/lib/folders.local', () => ({
  getLocalFolder: (...args: unknown[]) => mockGetLocalFolder(...args),
  renameLocalFolder: (...args: unknown[]) => mockRenameLocalFolder(...args),
  deleteLocalFolder: (...args: unknown[]) => mockDeleteLocalFolder(...args),
}));

const mockListLocalAffirmations = jest.fn();
jest.mock('@/lib/affirmations.local', () => ({
  listLocalAffirmations: (...args: unknown[]) => mockListLocalAffirmations(...args),
}));

jest.mock('@/lib/aiVoice', () => ({
  getVoiceOption: (id: string) => (id === 'kokoro:af_nicole' ? { label: 'Nicole' } : undefined),
}));

const mockToggle = jest.fn();
const mockStop = jest.fn();
let mockPlayingId: string | null = null;
jest.mock('@/hooks/usePreviewPlayer', () => ({
  usePreviewPlayer: () => ({ playingId: mockPlayingId, toggle: mockToggle, stop: mockStop }),
}));

const today = new Date().toISOString();
const recording = (overrides: Record<string, unknown>) => ({
  id: 'a1',
  user_id: 'user-1',
  folder_id: 'folder-1',
  title: 'I release the day gently',
  local_uri: 'file:///a1.m4a',
  storage_path: null,
  duration_ms: 32000,
  trim_start_ms: null,
  trim_end_ms: null,
  source: 'recorded',
  voice_id: null,
  script_text: null,
  created_at: today,
  updated_at: today,
  synced_at: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockId = 'folder-1';
  mockPlayingId = null;
  mockGetLocalFolder.mockResolvedValue({ id: 'folder-1', name: 'Sleep & calm' });
  mockListLocalAffirmations.mockResolvedValue([]);
  mockRenameLocalFolder.mockResolvedValue(undefined);
  mockDeleteLocalFolder.mockResolvedValue(undefined);
});

describe('FolderDetailScreen', () => {
  it('shows the folder name and its recordings with source, length and when', async () => {
    mockListLocalAffirmations.mockResolvedValue([
      recording({}),
      recording({
        id: 'a2',
        title: 'My body knows how to rest',
        source: 'ai_generated',
        voice_id: 'kokoro:af_nicole',
        duration_ms: 48000,
      }),
      recording({ id: 'a3', folder_id: 'other-folder', title: 'Not in this folder' }),
    ]);
    await render(<FolderDetailScreen />);

    expect(await screen.findByRole('header', { name: 'Sleep & calm' })).toBeTruthy();
    expect(screen.getByText('2 recordings · 1m 20s total')).toBeTruthy();
    expect(screen.getByText('Self-Recorded · 32s · Today')).toBeTruthy();
    expect(screen.getByText('AI Guided · Nicole · 48s · Today')).toBeTruthy();
    expect(screen.queryByText('Not in this folder')).toBeNull();
  });

  it('the play button previews in place; the row opens the recording', async () => {
    mockListLocalAffirmations.mockResolvedValue([recording({})]);
    await render(<FolderDetailScreen />);

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Play I release the day gently' }),
    );
    expect(mockToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'I release the day gently, Self-Recorded · 32s · Today',
      }),
    );
    expect(mockPush).toHaveBeenCalledWith('/affirmation/a1');
  });

  it('labels the playing recording as Stop', async () => {
    mockPlayingId = 'a1';
    mockListLocalAffirmations.mockResolvedValue([recording({})]);
    await render(<FolderDetailScreen />);

    expect(
      await screen.findByRole('button', { name: 'Stop I release the day gently' }),
    ).toBeTruthy();
  });

  it('the mic starts a new affirmation in this folder', async () => {
    await render(<FolderDetailScreen />);

    await fireEvent.press(
      await screen.findByRole('button', { name: 'New affirmation in Sleep & calm' }),
    );

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/new-affirmation',
      params: { folderId: 'folder-1' },
    });
  });

  it('renames the folder from the ⋯ menu', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await render(<FolderDetailScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Folder options' }));
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    await act(async () => buttons.find((b) => b.text === 'Rename')?.onPress?.());
    await fireEvent.changeText(screen.getByLabelText('Folder name'), 'Calm nights');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockRenameLocalFolder).toHaveBeenCalledWith('folder-1', 'Calm nights'),
    );
    expect(await screen.findByRole('header', { name: 'Calm nights' })).toBeTruthy();
    alert.mockRestore();
  });

  it('deletes the folder after confirming, then goes back', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await render(<FolderDetailScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Folder options' }));
    const menu = alert.mock.calls[0][2] as AlertButton[];
    await act(async () => menu.find((b) => b.text === 'Delete')?.onPress?.());
    expect(alert.mock.calls[1][1]).toBe('Recordings in "Sleep & calm" will move to Unfiled.');
    const confirm = alert.mock.calls[1][2] as AlertButton[];
    await act(async () => confirm.find((b) => b.text === 'Delete')?.onPress?.());

    expect(mockDeleteLocalFolder).toHaveBeenCalledWith('folder-1');
    expect(mockBack).toHaveBeenCalled();
    alert.mockRestore();
  });

  it('Unfiled lists recordings with no folder and has no ⋯ menu', async () => {
    mockId = 'unfiled';
    mockListLocalAffirmations.mockResolvedValue([
      recording({ id: 'u1', folder_id: null, title: 'Tomorrow can wait' }),
      recording({ id: 'f1', title: 'Filed one' }),
    ]);
    await render(<FolderDetailScreen />);

    expect(await screen.findByText('Tomorrow can wait')).toBeTruthy();
    expect(screen.queryByText('Filed one')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Folder options' })).toBeNull();
    expect(mockGetLocalFolder).not.toHaveBeenCalled();
  });

  it('says so when the folder no longer exists', async () => {
    mockGetLocalFolder.mockResolvedValue(null);
    await render(<FolderDetailScreen />);

    expect(await screen.findByText('This folder no longer exists.')).toBeTruthy();
  });
});
