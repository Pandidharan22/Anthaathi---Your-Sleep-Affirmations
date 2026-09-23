import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import GoalDetailScreen from '@/app/goal/[id]';

const mockGetLocalGoal = jest.fn();
const mockUpdateLocalGoalText = jest.fn();
const mockUpdateLocalGoalImage = jest.fn();
const mockUpdateLocalGoalStatus = jest.fn();
const mockDeleteLocalGoal = jest.fn();
const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
const mockFileDelete = jest.fn();
const mockFileCopy = jest.fn();
const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'goal-1' }),
  router: { back: (...args: unknown[]) => mockRouterBack(...args) },
}));

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

jest.mock('@/lib/goals.local', () => ({
  getLocalGoal: (...args: unknown[]) => mockGetLocalGoal(...args),
  updateLocalGoalText: (...args: unknown[]) => mockUpdateLocalGoalText(...args),
  updateLocalGoalImage: (...args: unknown[]) => mockUpdateLocalGoalImage(...args),
  updateLocalGoalStatus: (...args: unknown[]) => mockUpdateLocalGoalStatus(...args),
  deleteLocalGoal: (...args: unknown[]) => mockDeleteLocalGoal(...args),
}));

const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const baseGoal = {
  id: 'goal-1',
  user_id: 'user-1',
  title: 'Run a marathon',
  description: 'Sub-4 hours',
  image_local_uri: null,
  image_path: null,
  status: 'active',
  created_at: '',
  achieved_at: null,
  updated_at: '',
  synced_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFileCopy.mockResolvedValue(undefined);
});

describe('GoalDetailScreen', () => {
  it('shows a not-found message when the goal does not exist', async () => {
    mockGetLocalGoal.mockResolvedValue(null);

    const { getByText } = await render(<GoalDetailScreen />);

    await waitFor(() => expect(getByText('Goal not found')).toBeTruthy());
  });

  it('shows the goal once loaded', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);

    const { getByDisplayValue } = await render(<GoalDetailScreen />);

    expect(mockGetLocalGoal).toHaveBeenCalledWith('goal-1');
    await waitFor(() => expect(getByDisplayValue('Run a marathon')).toBeTruthy());
    expect(getByDisplayValue('Sub-4 hours')).toBeTruthy();
  });

  it('saves title/description edits on blur', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockUpdateLocalGoalText.mockResolvedValue(undefined);

    const { getByDisplayValue } = await render(<GoalDetailScreen />);
    const titleInput = await waitFor(() => getByDisplayValue('Run a marathon'));

    await fireEvent.changeText(titleInput, 'Run an ultramarathon');
    await fireEvent(titleInput, 'blur');

    await waitFor(() =>
      expect(mockUpdateLocalGoalText).toHaveBeenCalledWith('goal-1', 'Run an ultramarathon', 'Sub-4 hours'),
    );
  });

  it('reverts the title on blur if left empty, without saving', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);

    const { getByDisplayValue } = await render(<GoalDetailScreen />);
    const titleInput = await waitFor(() => getByDisplayValue('Run a marathon'));

    await fireEvent.changeText(titleInput, '   ');
    await fireEvent(titleInput, 'blur');

    await waitFor(() => expect(getByDisplayValue('Run a marathon')).toBeTruthy());
    expect(mockUpdateLocalGoalText).not.toHaveBeenCalled();
  });

  it('marks the goal achieved, then back to active', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockUpdateLocalGoalStatus.mockResolvedValue(undefined);

    const { getByText } = await render(<GoalDetailScreen />);
    await waitFor(() => expect(getByText('Mark achieved')).toBeTruthy());

    await fireEvent.press(getByText('Mark achieved'));

    await waitFor(() => expect(mockUpdateLocalGoalStatus).toHaveBeenCalledWith('goal-1', 'achieved'));
    await waitFor(() => expect(getByText('Move back to active')).toBeTruthy());

    await fireEvent.press(getByText('Move back to active'));

    await waitFor(() => expect(mockUpdateLocalGoalStatus).toHaveBeenCalledWith('goal-1', 'active'));
  });

  it('picks and saves an image', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockUpdateLocalGoalImage.mockResolvedValue(undefined);
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/photo.jpg' }],
    });

    const { getByText } = await render(<GoalDetailScreen />);
    await waitFor(() => expect(getByText('Add image (optional)')).toBeTruthy());

    await fireEvent.press(getByText('Add image (optional)'));

    await waitFor(() =>
      expect(mockUpdateLocalGoalImage).toHaveBeenCalledWith('goal-1', 'file:///doc/goal-image-123.jpg'),
    );
    await waitFor(() => expect(getByText('Replace image')).toBeTruthy());
  });

  it('removes an existing image', async () => {
    mockGetLocalGoal.mockResolvedValue({ ...baseGoal, image_local_uri: 'file:///doc/existing.jpg' });
    mockUpdateLocalGoalImage.mockResolvedValue(undefined);

    const { getByText } = await render(<GoalDetailScreen />);
    await waitFor(() => expect(getByText('Remove image')).toBeTruthy());

    await fireEvent.press(getByText('Remove image'));

    await waitFor(() => expect(mockUpdateLocalGoalImage).toHaveBeenCalledWith('goal-1', null));
    await waitFor(() => expect(getByText('Add image (optional)')).toBeTruthy());
  });

  it('deletes the goal after confirming and navigates back', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockDeleteLocalGoal.mockResolvedValue(undefined);
    mockAlert.mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.();
    });

    const { getByText } = await render(<GoalDetailScreen />);
    await waitFor(() => expect(getByText('Delete goal')).toBeTruthy());

    await fireEvent.press(getByText('Delete goal'));

    await waitFor(() => expect(mockDeleteLocalGoal).toHaveBeenCalledWith('goal-1'));
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
  });
});
