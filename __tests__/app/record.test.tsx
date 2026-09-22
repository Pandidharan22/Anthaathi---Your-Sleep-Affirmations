import { fireEvent, render, waitFor } from '@testing-library/react-native';

import RecordScreen from '@/app/record';

const mockGetRecordingPermissionsAsync = jest.fn();
const mockRequestRecordingPermissionsAsync = jest.fn();
const mockSetAudioModeAsync = jest.fn().mockResolvedValue(undefined);
const mockPrepareToRecordAsync = jest.fn().mockResolvedValue(undefined);
const mockRecord = jest.fn();
const mockStop = jest.fn();
const mockPlayerPlay = jest.fn();
const mockPlayerPause = jest.fn();
const mockFileDelete = jest.fn();
const mockRouterBack = jest.fn();
const mockCreateLocalAffirmation = jest.fn();

const mockRecorderObj = { record: mockRecord, stop: mockStop, prepareToRecordAsync: mockPrepareToRecordAsync, uri: null as string | null };
let mockRecorderState = { isRecording: false, durationMillis: 0, canRecord: true, url: null };
let mockPlayerStatus = { playing: false, currentTime: 0, duration: 0 };

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: { extension: '.m4a', sampleRate: 44100, numberOfChannels: 2, bitRate: 128000 } },
  getRecordingPermissionsAsync: (...args: unknown[]) => mockGetRecordingPermissionsAsync(...args),
  requestRecordingPermissionsAsync: (...args: unknown[]) => mockRequestRecordingPermissionsAsync(...args),
  setAudioModeAsync: (...args: unknown[]) => mockSetAudioModeAsync(...args),
  useAudioRecorder: () => mockRecorderObj,
  useAudioRecorderState: () => mockRecorderState,
  useAudioPlayer: () => ({ play: mockPlayerPlay, pause: mockPlayerPause, seekTo: jest.fn().mockResolvedValue(undefined) }),
  useAudioPlayerStatus: () => mockPlayerStatus,
}));

jest.mock('@react-native-community/slider', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { __esModule: true, default: (props: object) => <View {...props} /> };
});

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ delete: mockFileDelete })),
}));

jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockRouterBack(...args) },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/lib/affirmations.local', () => ({
  createLocalAffirmation: (...args: unknown[]) => mockCreateLocalAffirmation(...args),
}));

const mockListLocalFolders = jest.fn().mockResolvedValue([]);
jest.mock('@/lib/folders.local', () => ({
  listLocalFolders: (...args: unknown[]) => mockListLocalFolders(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRecorderObj.uri = null;
  mockRecorderState = { isRecording: false, durationMillis: 0, canRecord: true, url: null };
  mockPlayerStatus = { playing: false, currentTime: 0, duration: 0 };
  mockStop.mockResolvedValue(undefined);
  mockCreateLocalAffirmation.mockResolvedValue({});
  mockListLocalFolders.mockResolvedValue([
    { id: 'folder-1', user_id: 'user-1', name: 'Sleep', created_at: '', updated_at: '', synced_at: null },
  ]);
});

describe('RecordScreen', () => {
  it('shows the rationale screen and requests permission on tap when not yet granted', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });

    const { getByText } = await render(<RecordScreen />);

    await waitFor(() => expect(getByText('Allow microphone access')).toBeTruthy());
    await fireEvent.press(getByText('Allow microphone access'));

    expect(mockRequestRecordingPermissionsAsync).toHaveBeenCalled();
    await waitFor(() => expect(getByText('Tap to record')).toBeTruthy());
  });

  it('shows the settings message when permission is denied and cannot be re-asked', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });

    const { getByText } = await render(<RecordScreen />);

    await waitFor(() => expect(getByText('Microphone access needed')).toBeTruthy());
  });

  it('goes ready -> recording -> reviewing, and Save persists the affirmation', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });

    const { getByText, getByPlaceholderText, rerender } = await render(<RecordScreen />);
    await waitFor(() => expect(getByText('Tap to record')).toBeTruthy());

    await fireEvent.press(getByText('Tap to record'));

    expect(mockSetAudioModeAsync).toHaveBeenCalledWith({ allowsRecording: true });
    expect(mockPrepareToRecordAsync).toHaveBeenCalled();
    expect(mockRecord).toHaveBeenCalled();
    await waitFor(() => expect(getByText('Stop')).toBeTruthy());

    mockRecorderObj.uri = 'file:///doc/rec.m4a';
    mockRecorderState = { ...mockRecorderState, durationMillis: 4200 };
    await rerender(<RecordScreen />);
    await fireEvent.press(getByText('Stop'));

    expect(mockStop).toHaveBeenCalled();
    await waitFor(() => expect(getByText('Save')).toBeTruthy());

    await fireEvent.changeText(getByPlaceholderText('Title'), 'My affirmation');
    await fireEvent.press(getByText('Sleep'));
    await fireEvent.press(getByText('Save'));

    await waitFor(() =>
      expect(mockCreateLocalAffirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          title: 'My affirmation',
          localUri: 'file:///doc/rec.m4a',
          durationMs: 4200,
          source: 'recorded',
          folderId: 'folder-1',
        }),
      ),
    );
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
  });

  it('blocks saving with an empty title', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });

    const { getByText, getByPlaceholderText, rerender } = await render(<RecordScreen />);
    await waitFor(() => expect(getByText('Tap to record')).toBeTruthy());
    await fireEvent.press(getByText('Tap to record'));
    await waitFor(() => expect(getByText('Stop')).toBeTruthy());

    mockRecorderObj.uri = 'file:///doc/rec.m4a';
    mockRecorderState = { ...mockRecorderState, durationMillis: 4200 };
    await rerender(<RecordScreen />);
    await fireEvent.press(getByText('Stop'));
    await waitFor(() => expect(getByText('Save')).toBeTruthy());

    await fireEvent.changeText(getByPlaceholderText('Title'), '   ');
    await fireEvent.press(getByText('Save'));

    await waitFor(() => expect(getByText('Give this recording a title before saving.')).toBeTruthy());
    expect(mockCreateLocalAffirmation).not.toHaveBeenCalled();
  });

  it('Discard deletes the file and returns to the ready state', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });

    const { getByText } = await render(<RecordScreen />);
    await waitFor(() => expect(getByText('Tap to record')).toBeTruthy());
    await fireEvent.press(getByText('Tap to record'));
    await waitFor(() => expect(getByText('Stop')).toBeTruthy());

    mockRecorderObj.uri = 'file:///doc/rec.m4a';
    await fireEvent.press(getByText('Stop'));
    await waitFor(() => expect(getByText('Discard')).toBeTruthy());

    await fireEvent.press(getByText('Discard'));

    expect(mockFileDelete).toHaveBeenCalled();
    await waitFor(() => expect(getByText('Tap to record')).toBeTruthy());
    expect(mockCreateLocalAffirmation).not.toHaveBeenCalled();
  });
});
