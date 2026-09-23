import { fireEvent, render, waitFor } from '@testing-library/react-native';

import NewGoalScreen from '@/app/goal/new';

const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
const mockFileDelete = jest.fn();
const mockFileCopy = jest.fn();
const mockRouterBack = jest.fn();
const mockCreateLocalGoal = jest.fn();

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockRequestMediaLibraryPermissionsAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

jest.mock('expo-file-system', () => ({
  // new File(sourceUri) — the picked image; new File(Paths.document, filename) — the copy destination.
  File: jest.fn().mockImplementation((...args: unknown[]) => ({
    uri: args.length >= 2 ? 'file:///doc/goal-image-123.jpg' : (args[0] as string),
    extension: '.jpg',
    delete: mockFileDelete,
    copy: mockFileCopy,
  })),
  Paths: { document: 'file:///doc' },
}));

jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockRouterBack(...args) },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/lib/goals.local', () => ({
  createLocalGoal: (...args: unknown[]) => mockCreateLocalGoal(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateLocalGoal.mockResolvedValue({});
  mockFileCopy.mockResolvedValue(undefined);
});

describe('NewGoalScreen', () => {
  it('blocks saving with an empty title', async () => {
    const { getByText } = await render(<NewGoalScreen />);

    await fireEvent.press(getByText('Save'));

    await waitFor(() => expect(getByText('Give this goal a title before saving.')).toBeTruthy());
    expect(mockCreateLocalGoal).not.toHaveBeenCalled();
  });

  it('saves a title-only goal and returns', async () => {
    const { getByText, getByPlaceholderText } = await render(<NewGoalScreen />);

    await fireEvent.changeText(getByPlaceholderText('Title'), 'Run a marathon');
    await fireEvent.changeText(getByPlaceholderText('Description'), 'Sub-4 hours');
    await fireEvent.press(getByText('Save'));

    await waitFor(() =>
      expect(mockCreateLocalGoal).toHaveBeenCalledWith({
        userId: 'user-1',
        title: 'Run a marathon',
        description: 'Sub-4 hours',
        imageLocalUri: null,
      }),
    );
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
  });

  it('picks, previews, and saves with an image', async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/photo.jpg' }],
    });

    const { getByText, getByPlaceholderText, queryByText } = await render(<NewGoalScreen />);

    await fireEvent.press(getByText('Add image (optional)'));

    await waitFor(() => expect(mockFileCopy).toHaveBeenCalled());
    expect(queryByText('Add image (optional)')).toBeNull();
    expect(getByText('Remove image')).toBeTruthy();

    await fireEvent.changeText(getByPlaceholderText('Title'), 'Run a marathon');
    await fireEvent.press(getByText('Save'));

    await waitFor(() =>
      expect(mockCreateLocalGoal).toHaveBeenCalledWith(
        expect.objectContaining({ imageLocalUri: 'file:///doc/goal-image-123.jpg' }),
      ),
    );
  });

  it('shows an inline message when photo library permission is denied', async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });

    const { getByText } = await render(<NewGoalScreen />);

    await fireEvent.press(getByText('Add image (optional)'));

    await waitFor(() => expect(getByText('Photo library access is needed to add an image.')).toBeTruthy());
    expect(mockLaunchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('removing the picked image deletes the local file and reverts the UI', async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/photo.jpg' }],
    });

    const { getByText } = await render(<NewGoalScreen />);
    await fireEvent.press(getByText('Add image (optional)'));
    await waitFor(() => expect(getByText('Remove image')).toBeTruthy());

    await fireEvent.press(getByText('Remove image'));

    expect(mockFileDelete).toHaveBeenCalled();
    await waitFor(() => expect(getByText('Add image (optional)')).toBeTruthy());
  });

  it('shows an error message when saving fails', async () => {
    mockCreateLocalGoal.mockRejectedValue(new Error('disk full'));

    const { getByText, getByPlaceholderText } = await render(<NewGoalScreen />);
    await fireEvent.changeText(getByPlaceholderText('Title'), 'Run a marathon');
    await fireEvent.press(getByText('Save'));

    await waitFor(() => expect(getByText('Could not save the goal. Please try again.')).toBeTruthy());
  });
});
