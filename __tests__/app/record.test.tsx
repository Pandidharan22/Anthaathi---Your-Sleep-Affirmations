import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';

import RecordScreen from '@/app/record';

const mockGetRecordingPermissionsAsync = jest.fn();
const mockRequestRecordingPermissionsAsync = jest.fn();
const mockSetAudioModeAsync = jest.fn().mockResolvedValue(undefined);
const mockPrepareToRecordAsync = jest.fn().mockResolvedValue(undefined);
const mockRecord = jest.fn();
const mockStop = jest.fn();
const mockPause = jest.fn();
const mockPlayerPlay = jest.fn();
const mockPlayerPause = jest.fn();
const mockFileDelete = jest.fn();
const mockRouterBack = jest.fn();
const mockCreateLocalAffirmation = jest.fn();

const mockRecorderObj = {
  record: mockRecord,
  stop: mockStop,
  pause: mockPause,
  prepareToRecordAsync: mockPrepareToRecordAsync,
  uri: null as string | null,
};
let mockRecorderState: {
  isRecording: boolean;
  durationMillis: number;
  canRecord: boolean;
  url: null;
  metering?: number;
} = { isRecording: false, durationMillis: 0, canRecord: true, url: null };
let mockPlayerStatus = { playing: false, currentTime: 0, duration: 0 };

jest.mock('expo-audio', () => ({
  RecordingPresets: {
    HIGH_QUALITY: { extension: '.m4a', sampleRate: 44100, numberOfChannels: 2, bitRate: 128000 },
  },
  getRecordingPermissionsAsync: (...args: unknown[]) => mockGetRecordingPermissionsAsync(...args),
  requestRecordingPermissionsAsync: (...args: unknown[]) =>
    mockRequestRecordingPermissionsAsync(...args),
  setAudioModeAsync: (...args: unknown[]) => mockSetAudioModeAsync(...args),
  useAudioRecorder: () => mockRecorderObj,
  useAudioRecorderState: () => mockRecorderState,
  useAudioPlayer: () => ({
    play: mockPlayerPlay,
    pause: mockPlayerPause,
    seekTo: jest.fn().mockResolvedValue(undefined),
  }),
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

let mockSearchParams: { scriptText?: string; suggestedTitle?: string } = {};
jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockRouterBack(...args) },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

const mockSaveWaveform = jest.fn();
jest.mock('@/lib/waveforms.local', () => ({
  saveWaveform: (...args: unknown[]) => mockSaveWaveform(...args),
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
  mockSearchParams = {};
  mockRecorderObj.uri = null;
  mockRecorderState = { isRecording: false, durationMillis: 0, canRecord: true, url: null };
  mockPlayerStatus = { playing: false, currentTime: 0, duration: 0 };
  mockStop.mockResolvedValue(undefined);
  mockCreateLocalAffirmation.mockResolvedValue({ id: 'new-aff' });
  mockSaveWaveform.mockResolvedValue(undefined);
  mockListLocalFolders.mockResolvedValue([
    {
      id: 'folder-1',
      user_id: 'user-1',
      name: 'Sleep',
      created_at: '',
      updated_at: '',
      synced_at: null,
    },
  ]);
});

describe('RecordScreen', () => {
  it('shows the rationale screen and requests permission on tap when not yet granted', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });

    const { getByText, getByRole } = await render(<RecordScreen />);

    await waitFor(() => expect(getByText('Allow microphone access')).toBeTruthy());
    await fireEvent.press(getByText('Allow microphone access'));

    expect(mockRequestRecordingPermissionsAsync).toHaveBeenCalled();
    await waitFor(() => expect(getByRole('button', { name: 'Start recording' })).toBeTruthy());
  });

  it('shows the settings message when permission is denied and cannot be re-asked', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });

    const { getByText, getByRole } = await render(<RecordScreen />);

    await waitFor(() => expect(getByText('Microphone access needed')).toBeTruthy());
  });

  it('Open Settings opens the app page in system Settings', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);

    const { getByText, getByRole } = await render(<RecordScreen />);
    await waitFor(() => expect(getByText('Open Settings')).toBeTruthy());
    await fireEvent.press(getByText('Open Settings'));

    expect(openSettings).toHaveBeenCalled();
    openSettings.mockRestore();
  });

  it('unlocks recording when the user returns from Settings with the mic allowed', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    let onAppStateChange: ((state: string) => void) | undefined;
    const appState = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, listener) => {
        onAppStateChange = listener as (state: string) => void;
        return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
      });

    const { getByText, getByRole } = await render(<RecordScreen />);
    await waitFor(() => expect(getByText('Open Settings')).toBeTruthy());

    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    await act(async () => {
      onAppStateChange?.('active');
    });

    await waitFor(() => expect(getByRole('button', { name: 'Start recording' })).toBeTruthy());
    appState.mockRestore();
  });

  it('goes ready -> recording -> reviewing, and Save persists the affirmation', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });

    const { getByText, getByRole, getByPlaceholderText, rerender } = await render(<RecordScreen />);
    await waitFor(() => expect(getByRole('button', { name: 'Start recording' })).toBeTruthy());

    await fireEvent.press(getByRole('button', { name: 'Start recording' }));

    expect(mockSetAudioModeAsync).toHaveBeenCalledWith({ allowsRecording: true });
    expect(mockPrepareToRecordAsync).toHaveBeenCalled();
    expect(mockRecord).toHaveBeenCalled();
    await waitFor(() => expect(getByRole('button', { name: 'Pause recording' })).toBeTruthy());

    mockRecorderObj.uri = 'file:///doc/rec.m4a';
    mockRecorderState = { ...mockRecorderState, durationMillis: 4200 };
    await rerender(<RecordScreen />);
    await fireEvent.press(getByRole('button', { name: 'Done ✓' }));

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

    const { getByText, getByRole, getByPlaceholderText, rerender } = await render(<RecordScreen />);
    await waitFor(() => expect(getByRole('button', { name: 'Start recording' })).toBeTruthy());
    await fireEvent.press(getByRole('button', { name: 'Start recording' }));
    await waitFor(() => expect(getByRole('button', { name: 'Pause recording' })).toBeTruthy());

    mockRecorderObj.uri = 'file:///doc/rec.m4a';
    mockRecorderState = { ...mockRecorderState, durationMillis: 4200 };
    await rerender(<RecordScreen />);
    await fireEvent.press(getByRole('button', { name: 'Done ✓' }));
    await waitFor(() => expect(getByText('Save')).toBeTruthy());

    await fireEvent.changeText(getByPlaceholderText('Title'), '   ');
    await fireEvent.press(getByText('Save'));

    await waitFor(() =>
      expect(getByText('Give this recording a title before saving.')).toBeTruthy(),
    );
    expect(mockCreateLocalAffirmation).not.toHaveBeenCalled();
  });

  it('pre-fills the title and shows the script when arriving from an AI draft, and saves the script text', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    mockSearchParams = { scriptText: 'I am strong and capable.', suggestedTitle: 'Run a marathon' };

    const { getByText, getByRole, getByDisplayValue, rerender } = await render(<RecordScreen />);
    await waitFor(() => expect(getByRole('button', { name: 'Start recording' })).toBeTruthy());

    expect(getByText('“I am strong and capable.”')).toBeTruthy();

    await fireEvent.press(getByRole('button', { name: 'Start recording' }));
    await waitFor(() => expect(getByRole('button', { name: 'Pause recording' })).toBeTruthy());
    expect(getByText('“I am strong and capable.”')).toBeTruthy();

    mockRecorderObj.uri = 'file:///doc/rec.m4a';
    mockRecorderState = { ...mockRecorderState, durationMillis: 4200 };
    await rerender(<RecordScreen />);
    await fireEvent.press(getByRole('button', { name: 'Done ✓' }));
    await waitFor(() => expect(getByText('Save')).toBeTruthy());

    // The suggested title survived the stop -> reviewing transition unstomped.
    expect(getByDisplayValue('Run a marathon')).toBeTruthy();
    await fireEvent.press(getByText('Save'));

    await waitFor(() =>
      expect(mockCreateLocalAffirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Run a marathon',
          scriptText: 'I am strong and capable.',
        }),
      ),
    );
  });

  it('Discard deletes the file and returns to the ready state', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });

    const { getByText, getByRole } = await render(<RecordScreen />);
    await waitFor(() => expect(getByRole('button', { name: 'Start recording' })).toBeTruthy());
    await fireEvent.press(getByRole('button', { name: 'Start recording' }));
    await waitFor(() => expect(getByRole('button', { name: 'Pause recording' })).toBeTruthy());

    mockRecorderObj.uri = 'file:///doc/rec.m4a';
    await fireEvent.press(getByRole('button', { name: 'Done ✓' }));
    await waitFor(() => expect(getByText('Discard')).toBeTruthy());

    await fireEvent.press(getByText('Discard'));

    expect(mockFileDelete).toHaveBeenCalled();
    await waitFor(() => expect(getByRole('button', { name: 'Start recording' })).toBeTruthy());
    expect(mockCreateLocalAffirmation).not.toHaveBeenCalled();
  });
  it('pauses and resumes with the mic, and holding it stops', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    const { getByRole, getByText } = await render(<RecordScreen />);
    await fireEvent.press(await waitFor(() => getByRole('button', { name: 'Start recording' })));

    await fireEvent.press(getByRole('button', { name: 'Pause recording' }));
    expect(mockPause).toHaveBeenCalled();
    expect(getByText('Paused')).toBeTruthy();

    await fireEvent.press(getByRole('button', { name: 'Resume recording' }));
    expect(mockRecord).toHaveBeenCalledTimes(2);

    mockRecorderObj.uri = 'file:///doc/rec.m4a';
    await fireEvent(getByRole('button', { name: 'Pause recording' }), 'longPress');
    expect(mockStop).toHaveBeenCalled();
    await waitFor(() => expect(getByText('Review your recording')).toBeTruthy());
  });

  it('Done is disabled until recording starts', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    const { getByRole } = await render(<RecordScreen />);

    await waitFor(() =>
      expect(getByRole('button', { name: 'Done ✓' }).props.accessibilityState).toMatchObject({
        disabled: true,
      }),
    );
  });

  it('Cancel during a take stops it, deletes the file, and leaves', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    const { getByRole } = await render(<RecordScreen />);
    await fireEvent.press(await waitFor(() => getByRole('button', { name: 'Start recording' })));

    mockRecorderObj.uri = 'file:///doc/rec.m4a';
    await fireEvent.press(getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
    expect(mockStop).toHaveBeenCalled();
    expect(mockFileDelete).toHaveBeenCalled();
    expect(mockCreateLocalAffirmation).not.toHaveBeenCalled();
  });

  it('samples loudness while recording and saves it as the waveform', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    const { getByRole, getByText, rerender } = await render(<RecordScreen />);
    await fireEvent.press(await waitFor(() => getByRole('button', { name: 'Start recording' })));

    for (const metering of [-25, -50, 0]) {
      mockRecorderState = {
        ...mockRecorderState,
        isRecording: true,
        durationMillis: 4200,
        metering,
      };
      await rerender(<RecordScreen />);
    }
    mockRecorderObj.uri = 'file:///doc/rec.m4a';
    await fireEvent.press(getByRole('button', { name: 'Done ✓' }));
    await waitFor(() => expect(getByText('Save')).toBeTruthy());
    await fireEvent.press(getByText('Save'));

    await waitFor(() => expect(mockCreateLocalAffirmation).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockSaveWaveform).toHaveBeenCalledWith('new-aff', {
        intervalMs: 100,
        levels: [0.5, 0, 1],
      }),
    );
  });
});
