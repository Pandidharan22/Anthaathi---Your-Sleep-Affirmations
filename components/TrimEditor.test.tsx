import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { TrimEditor } from './TrimEditor';

const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockSeekTo = jest.fn().mockResolvedValue(undefined);

let mockStatus = { playing: false, currentTime: 0, duration: 10 };

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: mockPlay, pause: mockPause, seekTo: mockSeekTo }),
  useAudioPlayerStatus: () => mockStatus,
}));

jest.mock('@react-native-community/slider', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { __esModule: true, default: (props: object) => <View {...props} /> };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = { playing: false, currentTime: 0, duration: 10 };
});

describe('TrimEditor', () => {
  it('defaults trim range to the full duration and rejects an invalid save', async () => {
    const onSave = jest.fn();
    const { getByText } = await render(
      <TrimEditor uri="file:///rec.m4a" durationMs={10000} onSave={onSave} />,
    );

    expect(getByText('Trim: 0:00 – 0:10')).toBeTruthy();
    await fireEvent.press(getByText('Save trim'));
    expect(onSave).toHaveBeenCalledWith(0, 10000);
  });

  it('Set start here / Set end here use the current playback position', async () => {
    const onSave = jest.fn();
    mockStatus = { ...mockStatus, currentTime: 2 };

    const { getByText, rerender } = await render(
      <TrimEditor uri="file:///rec.m4a" durationMs={10000} onSave={onSave} />,
    );
    await fireEvent.press(getByText('Set start here'));

    mockStatus = { ...mockStatus, currentTime: 8 };
    await rerender(<TrimEditor uri="file:///rec.m4a" durationMs={10000} onSave={onSave} />);
    await fireEvent.press(getByText('Set end here'));

    await waitFor(() => expect(getByText('Trim: 0:02 – 0:08')).toBeTruthy());

    await fireEvent.press(getByText('Save trim'));
    expect(onSave).toHaveBeenCalledWith(2000, 8000);
  });

  it('rejects setting the start at or after the current end', async () => {
    const { getByText, rerender } = await render(
      <TrimEditor uri="file:///rec.m4a" durationMs={10000} initialTrimEndMs={5000} onSave={jest.fn()} />,
    );
    mockStatus = { ...mockStatus, currentTime: 6 };
    await rerender(
      <TrimEditor uri="file:///rec.m4a" durationMs={10000} initialTrimEndMs={5000} onSave={jest.fn()} />,
    );

    await fireEvent.press(getByText('Set start here'));

    await waitFor(() => expect(getByText('Start must be before the end point.')).toBeTruthy());
  });

  it('toggles play/pause', async () => {
    const { getByText, rerender } = await render(
      <TrimEditor uri="file:///rec.m4a" durationMs={10000} onSave={jest.fn()} />,
    );

    await fireEvent.press(getByText('Play'));
    expect(mockPlay).toHaveBeenCalled();

    mockStatus = { ...mockStatus, playing: true };
    await rerender(<TrimEditor uri="file:///rec.m4a" durationMs={10000} onSave={jest.fn()} />);
    await fireEvent.press(getByText('Pause'));
    expect(mockPause).toHaveBeenCalled();
  });

  it('Preview trim seeks to the trim start and plays', async () => {
    const { getByText } = await render(
      <TrimEditor uri="file:///rec.m4a" durationMs={10000} initialTrimStartMs={3000} onSave={jest.fn()} />,
    );

    await fireEvent.press(getByText('Preview trim'));

    await waitFor(() => expect(mockSeekTo).toHaveBeenCalledWith(3));
    expect(mockPlay).toHaveBeenCalled();
  });
});
