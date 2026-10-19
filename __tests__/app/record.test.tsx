import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, AppState, Linking, type AlertButton } from 'react-native';

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

    const { getByText, getByRole, getByLabelText, rerender } = await render(<RecordScreen />);
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
    await waitFor(() => expect(getByText('Save recording')).toBeTruthy());

    await fireEvent.changeText(getByLabelText('Title'), 'My affirmation');
    await fireEvent.press(getByRole('button', { name: 'Folder: No folder. Change folder' }));
    await fireEvent.press(getByText('Sleep'));
    await fireEvent.press(getByText('Save recording'));

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

    const { getByText, getByRole, getByLabelText, rerender } = await render(<RecordScreen />);
    await waitFor(() => expect(getByRole('button', { name: 'Start recording' })).toBeTruthy());
    await fireEvent.press(getByRole('button', { name: 'Start recording' }));
    await waitFor(() => expect(getByRole('button', { name: 'Pause recording' })).toBeTruthy());

    mockRecorderObj.uri = 'file:///doc/rec.m4a';
    mockRecorderState = { ...mockRecorderState, durationMillis: 4200 };
    await rerender(<RecordScreen />);
    await fireEvent.press(getByRole('button', { name: 'Done ✓' }));
    await waitFor(() => expect(getByText('Save recording')).toBeTruthy());

    await fireEvent.changeText(getByLabelText('Title'), '   ');
    await fireEvent.press(getByText('Save recording'));

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
    await waitFor(() => expect(getByText('Save recording')).toBeTruthy());

    // The suggested title survived the stop -> reviewing transition unstomped.
    expect(getByDisplayValue('Run a marathon')).toBeTruthy();
    await fireEvent.press(getByText('Save recording'));

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
    await waitFor(() => expect(getByText('Save recording')).toBeTruthy());
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
    await waitFor(() => expect(getByText('Save recording')).toBeTruthy());
    await fireEvent.press(getByText('Save recording'));

    await waitFor(() => expect(mockCreateLocalAffirmation).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockSaveWaveform).toHaveBeenCalledWith('new-aff', {
        intervalMs: 100,
        levels: [0.5, 0, 1],
      }),
    );
  });
  it('offers Trim silence when the take has quiet ends, and saves the trim', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    const { getByRole, getByText, rerender } = await render(<RecordScreen />);
    await fireEvent.press(await waitFor(() => getByRole('button', { name: 'Start recording' })));

    // 20 samples over 2 s: 1 s of quiet, 0.2 s of speech, then quiet.
    const take = [...Array(10).fill(-60), -10, -10, ...Array(8).fill(-60)];
    for (const metering of take) {
      mockRecorderState = {
        ...mockRecorderState,
        isRecording: true,
        durationMillis: 2000,
        metering,
      };
      await rerender(<RecordScreen />);
    }
    mockRecorderObj.uri = 'file:///doc/rec.m4a';
    await fireEvent.press(getByRole('button', { name: 'Done ✓' }));

    const chip = await waitFor(() => getByRole('button', { name: 'Trim silence' }));
    expect(chip.props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(chip);
    expect(getByText('Trims 0.7 s of quiet at the start and 0.5 s at the end.')).toBeTruthy();

    await fireEvent.press(getByText('Save recording'));
    await waitFor(() =>
      expect(mockCreateLocalAffirmation).toHaveBeenCalledWith(
        expect.objectContaining({ trimStartMs: 700, trimEndMs: 1500 }),
      ),
    );
  });

  it('Trim silence says so when there is no quiet to cut', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    const { getByRole, getByText } = await render(<RecordScreen />);
    await fireEvent.press(await waitFor(() => getByRole('button', { name: 'Start recording' })));

    mockRecorderObj.uri = 'file:///doc/rec.m4a';
    mockRecorderState = { ...mockRecorderState, durationMillis: 4200 };
    await fireEvent.press(getByRole('button', { name: 'Done ✓' }));

    await fireEvent.press(await waitFor(() => getByRole('button', { name: 'Trim silence' })));
    expect(getByText("There's no quiet at the start or end to trim.")).toBeTruthy();
    expect(getByRole('button', { name: 'Trim silence' }).props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('Trim opens the Trim screen and saves the range set there', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    const { getByRole, getByLabelText, getByTestId, getByText, queryByLabelText, rerender } =
      await render(<RecordScreen />);
    await fireEvent.press(await waitFor(() => getByRole('button', { name: 'Start recording' })));

    mockRecorderObj.uri = 'file:///doc/rec.m4a';
    mockRecorderState = { ...mockRecorderState, isRecording: true, durationMillis: 4200 };
    await rerender(<RecordScreen />);
    await fireEvent.press(getByRole('button', { name: 'Done ✓' }));

    await fireEvent.press(
      await waitFor(() => getByRole('button', { name: 'Trim the start and end' })),
    );
    await fireEvent(getByTestId('trim-waveform'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 120 } },
    });
    // Two screen-reader swipes move the start handle to 1 s.
    for (let i = 0; i < 2; i++) {
      await fireEvent(getByLabelText('Trim start'), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      });
    }
    await fireEvent.press(getByRole('button', { name: 'Done' }));

    expect(queryByLabelText('Trim start')).toBeNull();
    expect(getByText('Cuts 1.0 s from the start.')).toBeTruthy();
    expect(
      getByRole('button', { name: 'Trim the start and end' }).props.accessibilityState,
    ).toMatchObject({ selected: true });

    await fireEvent.press(getByText('Save recording'));
    await waitFor(() =>
      expect(mockCreateLocalAffirmation).toHaveBeenCalledWith(
        expect.objectContaining({ trimStartMs: 1000, trimEndMs: 4200 }),
      ),
    );
  });

  it('Back from Preview asks before discarding the unsaved take', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    const alert = jest.spyOn(Alert, 'alert');
    const { getByRole, getByText } = await render(<RecordScreen />);
    await fireEvent.press(await waitFor(() => getByRole('button', { name: 'Start recording' })));
    mockRecorderObj.uri = 'file:///doc/rec.m4a';
    mockRecorderState = { ...mockRecorderState, durationMillis: 4200 };
    await fireEvent.press(getByRole('button', { name: 'Done ✓' }));
    await waitFor(() => expect(getByText('Save recording')).toBeTruthy());

    await fireEvent.press(getByRole('button', { name: 'Back' }));

    expect(alert.mock.calls[0][0]).toBe('Discard this recording?');
    expect(mockFileDelete).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    await act(async () => buttons.find((b) => b.text === 'Discard')?.onPress?.());
    expect(mockFileDelete).toHaveBeenCalled();
    alert.mockRestore();
  });
});
