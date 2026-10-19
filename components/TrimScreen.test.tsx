import { fireEvent, render, screen } from '@testing-library/react-native';

import { TrimScreen } from './TrimScreen';

const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockSeekTo = jest.fn();
let mockStatus = { playing: false, currentTime: 0 };

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: mockPlay, pause: mockPause, seekTo: mockSeekTo }),
  useAudioPlayerStatus: () => mockStatus,
}));

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = { playing: false, currentTime: 0 };
});

const base = {
  uri: 'file:///a.m4a',
  durationMs: 10000,
  levels: null,
  onCancel: jest.fn(),
  onDone: jest.fn(),
};

/** Gives the waveform a 300-wide layout, so drags have a scale. */
async function layOutWaveform() {
  await fireEvent(screen.getByTestId('trim-waveform'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 120 } },
  });
}

describe('TrimScreen', () => {
  it('starts from the whole recording and hands back no trim when left alone', async () => {
    const onDone = jest.fn();
    await render(<TrimScreen {...base} initialTrim={null} onDone={onDone} />);

    expect(screen.getByLabelText('Keeping 0:00 to 0:10')).toBeTruthy();
    expect(screen.getByText('Drag the handles to cut the start or end.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledWith(null);
  });

  it('starts from an existing trim and says what it cuts', async () => {
    await render(<TrimScreen {...base} initialTrim={{ startMs: 2000, endMs: 6000 }} />);

    expect(screen.getByLabelText('Keeping 0:02 to 0:06')).toBeTruthy();
    expect(screen.getByText('Cuts 2.0 s from the start and 4.0 s from the end.')).toBeTruthy();
  });

  it('drags the nearer handle by the distance moved', async () => {
    const onDone = jest.fn();
    await render(<TrimScreen {...base} initialTrim={null} onDone={onDone} />);
    await layOutWaveform();
    const wave = screen.getByTestId('trim-waveform');

    // A touch at 30 of 300 (1 s) is nearer the start handle; 60 more is +2 s.
    await fireEvent(wave, 'responderGrant', { nativeEvent: { pageX: 30 } });
    await fireEvent(wave, 'responderMove', { nativeEvent: { pageX: 90 } });
    await fireEvent(wave, 'responderRelease', { nativeEvent: { pageX: 90 } });

    expect(screen.getByLabelText('Keeping 0:02 to 0:10')).toBeTruthy();
    expect(mockPause).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledWith({ startMs: 2000, endMs: 10000 });
  });

  it('moves a handle half a second per screen-reader swipe', async () => {
    await render(<TrimScreen {...base} initialTrim={null} />);
    await layOutWaveform();

    await fireEvent(screen.getByLabelText('Trim end'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    await fireEvent(screen.getByLabelText('Trim end'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });

    expect(screen.getByLabelText('Keeping 0:00 to 0:09')).toBeTruthy();
    expect(screen.getByText('Cuts 1.0 s from the end.')).toBeTruthy();
  });

  it('previews just inside each handle', async () => {
    await render(<TrimScreen {...base} initialTrim={{ startMs: 2000, endMs: 6000 }} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Preview the start' }));
    expect(mockSeekTo).toHaveBeenLastCalledWith(2);
    expect(mockPlay).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Preview the end' }));
    expect(mockSeekTo).toHaveBeenLastCalledWith(3);
  });

  it('stops a start preview after three seconds', async () => {
    const { rerender } = await render(
      <TrimScreen {...base} initialTrim={{ startMs: 2000, endMs: 9000 }} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Preview the start' }));

    mockStatus = { playing: true, currentTime: 5 };
    await rerender(<TrimScreen {...base} initialTrim={{ startMs: 2000, endMs: 9000 }} />);
    expect(mockPause).toHaveBeenCalled();
  });

  it('plays the kept part from the start handle', async () => {
    await render(<TrimScreen {...base} initialTrim={{ startMs: 2000, endMs: 6000 }} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Play the kept part' }));
    expect(mockSeekTo).toHaveBeenCalledWith(2);
    expect(mockPlay).toHaveBeenCalled();
  });

  it('Cancel hands nothing back', async () => {
    const onCancel = jest.fn();
    const onDone = jest.fn();
    await render(<TrimScreen {...base} initialTrim={null} onCancel={onCancel} onDone={onDone} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
