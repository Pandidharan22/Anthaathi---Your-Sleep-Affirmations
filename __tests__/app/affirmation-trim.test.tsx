import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import AffirmationTrimScreen from '@/app/affirmation/[id]/trim';

const mockGetLocalAffirmation = jest.fn();
const mockUpdateLocalAffirmationTrim = jest.fn();
const mockUpdateLocalAffirmationFolder = jest.fn();
const mockUpdateLocalAffirmationTitle = jest.fn();
const mockDeleteLocalAffirmation = jest.fn();
const mockListLocalFolders = jest.fn();
const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'aff-1' }),
  router: { back: (...args: unknown[]) => mockRouterBack(...args) },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/lib/affirmations.local', () => ({
  getLocalAffirmation: (...args: unknown[]) => mockGetLocalAffirmation(...args),
  updateLocalAffirmationTrim: (...args: unknown[]) => mockUpdateLocalAffirmationTrim(...args),
  updateLocalAffirmationFolder: (...args: unknown[]) => mockUpdateLocalAffirmationFolder(...args),
  updateLocalAffirmationTitle: (...args: unknown[]) => mockUpdateLocalAffirmationTitle(...args),
  deleteLocalAffirmation: (...args: unknown[]) => mockDeleteLocalAffirmation(...args),
}));

jest.mock('@/lib/folders.local', () => ({
  listLocalFolders: (...args: unknown[]) => mockListLocalFolders(...args),
}));

jest.mock('@/components/TrimEditor', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text } = require('react-native');
  return {
    TrimEditor: ({ onSave }: { onSave: (start: number, end: number) => void }) => (
      <Pressable onPress={() => onSave(1000, 5000)} accessibilityRole="button">
        <Text>Save trim (stub)</Text>
      </Pressable>
    ),
  };
});

const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const baseAffirmation = {
  id: 'aff-1',
  title: 'Bedtime affirmation',
  local_uri: 'file:///rec.m4a',
  duration_ms: 10000,
  folder_id: null,
  trim_start_ms: null,
  trim_end_ms: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListLocalFolders.mockResolvedValue([
    { id: 'folder-1', user_id: 'user-1', name: 'Sleep', created_at: '', updated_at: '', synced_at: null },
  ]);
});

describe('AffirmationTrimScreen', () => {
  it('shows a loading state, then the affirmation title once loaded', async () => {
    mockGetLocalAffirmation.mockResolvedValue(baseAffirmation);

    const { getByDisplayValue } = await render(<AffirmationTrimScreen />);

    expect(mockGetLocalAffirmation).toHaveBeenCalledWith('aff-1');
    await waitFor(() => expect(getByDisplayValue('Bedtime affirmation')).toBeTruthy());
  });

  it('renames the recording when the title field is edited and loses focus', async () => {
    mockGetLocalAffirmation.mockResolvedValue(baseAffirmation);
    mockUpdateLocalAffirmationTitle.mockResolvedValue(undefined);

    const { getByDisplayValue } = await render(<AffirmationTrimScreen />);
    const titleInput = await waitFor(() => getByDisplayValue('Bedtime affirmation'));

    await fireEvent.changeText(titleInput, 'New name');
    await fireEvent(titleInput, 'blur');

    await waitFor(() =>
      expect(mockUpdateLocalAffirmationTitle).toHaveBeenCalledWith('aff-1', 'New name'),
    );
  });

  it('reverts the title on blur if left empty, without saving', async () => {
    mockGetLocalAffirmation.mockResolvedValue(baseAffirmation);

    const { getByDisplayValue } = await render(<AffirmationTrimScreen />);
    const titleInput = await waitFor(() => getByDisplayValue('Bedtime affirmation'));

    await fireEvent.changeText(titleInput, '   ');
    await fireEvent(titleInput, 'blur');

    await waitFor(() => expect(getByDisplayValue('Bedtime affirmation')).toBeTruthy());
    expect(mockUpdateLocalAffirmationTitle).not.toHaveBeenCalled();
  });

  it('shows a not-found message when the affirmation does not exist', async () => {
    mockGetLocalAffirmation.mockResolvedValue(null);

    const { getByText } = await render(<AffirmationTrimScreen />);

    await waitFor(() => expect(getByText('Recording not found')).toBeTruthy());
  });

  it('saves the trim and navigates back', async () => {
    mockGetLocalAffirmation.mockResolvedValue(baseAffirmation);
    mockUpdateLocalAffirmationTrim.mockResolvedValue(undefined);

    const { getByText } = await render(<AffirmationTrimScreen />);
    await waitFor(() => expect(getByText('Save trim (stub)')).toBeTruthy());

    await fireEvent.press(getByText('Save trim (stub)'));

    await waitFor(() =>
      expect(mockUpdateLocalAffirmationTrim).toHaveBeenCalledWith('aff-1', 1000, 5000),
    );
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
  });

  it('reassigns the folder via the folder picker', async () => {
    mockGetLocalAffirmation.mockResolvedValue(baseAffirmation);
    mockUpdateLocalAffirmationFolder.mockResolvedValue(undefined);

    const { getByText } = await render(<AffirmationTrimScreen />);
    await waitFor(() => expect(getByText('Sleep')).toBeTruthy());

    await fireEvent.press(getByText('Sleep'));

    await waitFor(() =>
      expect(mockUpdateLocalAffirmationFolder).toHaveBeenCalledWith('aff-1', 'folder-1'),
    );
  });

  it('deletes the recording after confirming and navigates back', async () => {
    mockGetLocalAffirmation.mockResolvedValue(baseAffirmation);
    mockDeleteLocalAffirmation.mockResolvedValue(undefined);
    mockAlert.mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.();
    });

    const { getByText } = await render(<AffirmationTrimScreen />);
    await waitFor(() => expect(getByText('Delete recording')).toBeTruthy());

    await fireEvent.press(getByText('Delete recording'));

    await waitFor(() => expect(mockDeleteLocalAffirmation).toHaveBeenCalledWith('aff-1'));
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
  });
});
