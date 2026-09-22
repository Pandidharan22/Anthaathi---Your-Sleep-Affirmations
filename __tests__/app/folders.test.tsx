import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import FoldersScreen from '@/app/folders';

const mockListLocalFolders = jest.fn();
const mockCreateLocalFolder = jest.fn();
const mockRenameLocalFolder = jest.fn();
const mockDeleteLocalFolder = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
  useFocusEffect: (effect: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, []);
  },
}));

jest.mock('@/lib/folders.local', () => ({
  listLocalFolders: (...args: unknown[]) => mockListLocalFolders(...args),
  createLocalFolder: (...args: unknown[]) => mockCreateLocalFolder(...args),
  renameLocalFolder: (...args: unknown[]) => mockRenameLocalFolder(...args),
  deleteLocalFolder: (...args: unknown[]) => mockDeleteLocalFolder(...args),
}));

const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

beforeEach(() => {
  jest.clearAllMocks();
  mockListLocalFolders.mockResolvedValue([]);
  mockCreateLocalFolder.mockResolvedValue(undefined);
  mockRenameLocalFolder.mockResolvedValue(undefined);
  mockDeleteLocalFolder.mockResolvedValue(undefined);
});

describe('FoldersScreen', () => {
  it('shows an empty state, then lists folders once loaded', async () => {
    mockListLocalFolders.mockResolvedValue([
      { id: 'f1', user_id: 'user-1', name: 'Sleep', created_at: '', updated_at: '', synced_at: null },
    ]);

    const { getByText } = await render(<FoldersScreen />);

    await waitFor(() => expect(getByText('Sleep')).toBeTruthy());
  });

  it('creates a folder from the name field and refreshes the list', async () => {
    const { getByPlaceholderText, getByText } = await render(<FoldersScreen />);

    await fireEvent.changeText(getByPlaceholderText('New folder name'), 'Focus');
    await fireEvent.press(getByText('Create'));

    await waitFor(() => expect(mockCreateLocalFolder).toHaveBeenCalledWith('user-1', 'Focus'));
    expect(mockListLocalFolders).toHaveBeenCalledTimes(2); // initial load + refresh after create
  });

  it('navigates to the folder contents screen when a row is tapped', async () => {
    mockListLocalFolders.mockResolvedValue([
      { id: 'f1', user_id: 'user-1', name: 'Sleep', created_at: '', updated_at: '', synced_at: null },
    ]);

    const { getByText } = await render(<FoldersScreen />);
    await waitFor(() => expect(getByText('Sleep')).toBeTruthy());

    await fireEvent.press(getByText('Sleep'));

    expect(mockRouterPush).toHaveBeenCalledWith('/folder/f1');
  });

  it('does not navigate when tapping Rename or Delete on a row', async () => {
    mockListLocalFolders.mockResolvedValue([
      { id: 'f1', user_id: 'user-1', name: 'Sleep', created_at: '', updated_at: '', synced_at: null },
    ]);

    const { getByText } = await render(<FoldersScreen />);
    await waitFor(() => expect(getByText('Rename')).toBeTruthy());

    await fireEvent.press(getByText('Rename'));

    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('renames a folder inline', async () => {
    mockListLocalFolders.mockResolvedValue([
      { id: 'f1', user_id: 'user-1', name: 'Sleep', created_at: '', updated_at: '', synced_at: null },
    ]);

    const { getByText, getByDisplayValue } = await render(<FoldersScreen />);
    await waitFor(() => expect(getByText('Rename')).toBeTruthy());

    await fireEvent.press(getByText('Rename'));
    await fireEvent.changeText(getByDisplayValue('Sleep'), 'Bedtime');
    await fireEvent.press(getByText('Save'));

    await waitFor(() => expect(mockRenameLocalFolder).toHaveBeenCalledWith('f1', 'Bedtime'));
  });

  it('deletes a folder after confirming', async () => {
    mockListLocalFolders.mockResolvedValue([
      { id: 'f1', user_id: 'user-1', name: 'Sleep', created_at: '', updated_at: '', synced_at: null },
    ]);
    mockAlert.mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.();
    });

    const { getByText } = await render(<FoldersScreen />);
    await waitFor(() => expect(getByText('Delete')).toBeTruthy());

    await fireEvent.press(getByText('Delete'));

    await waitFor(() => expect(mockDeleteLocalFolder).toHaveBeenCalledWith('f1'));
  });

  it('shows an error message when creating a folder fails', async () => {
    mockCreateLocalFolder.mockRejectedValue(new Error('disk full'));

    const { getByPlaceholderText, getByText } = await render(<FoldersScreen />);

    await fireEvent.changeText(getByPlaceholderText('New folder name'), 'Focus');
    await fireEvent.press(getByText('Create'));

    await waitFor(() => expect(getByText('Something went wrong. Please try again.')).toBeTruthy());
  });

  it('shows an error message when renaming a folder fails', async () => {
    mockListLocalFolders.mockResolvedValue([
      { id: 'f1', user_id: 'user-1', name: 'Sleep', created_at: '', updated_at: '', synced_at: null },
    ]);
    mockRenameLocalFolder.mockRejectedValue(new Error('disk full'));

    const { getByText, getByDisplayValue } = await render(<FoldersScreen />);
    await waitFor(() => expect(getByText('Rename')).toBeTruthy());

    await fireEvent.press(getByText('Rename'));
    await fireEvent.changeText(getByDisplayValue('Sleep'), 'Bedtime');
    await fireEvent.press(getByText('Save'));

    await waitFor(() => expect(getByText('Something went wrong. Please try again.')).toBeTruthy());
  });

  it('shows an error message when deleting a folder fails', async () => {
    mockListLocalFolders.mockResolvedValue([
      { id: 'f1', user_id: 'user-1', name: 'Sleep', created_at: '', updated_at: '', synced_at: null },
    ]);
    mockDeleteLocalFolder.mockRejectedValue(new Error('disk full'));
    mockAlert.mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.();
    });

    const { getByText } = await render(<FoldersScreen />);
    await waitFor(() => expect(getByText('Delete')).toBeTruthy());

    await fireEvent.press(getByText('Delete'));

    await waitFor(() => expect(getByText('Something went wrong. Please try again.')).toBeTruthy());
  });
});
