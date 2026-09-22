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
  it('defaults trim range to the full duration, and saving an untouched range reports null (not trimmed)', async () => {
    const onSave = jest.fn();
    const { getByText } = await render(
      <TrimEditor uri="file:///rec.m4a" durationMs={10000} onSave={onSave} />,
    );

    expect(getByText('Trim: 0:00 – 0:10')).toBeTruthy();
    await fireEvent.press(getByText('Save trim'));
    expect(onSave).toHaveBeenCalledWith(null, null);
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

  it('Play seeks to the trim start when the current position is outside the trim range', async () => {
    mockStatus = { ...mockStatus, currentTime: 9 };

    const { getByText } = await render(
      <TrimEditor
        uri="file:///rec.m4a"
        durationMs={10000}
        initialTrimStartMs={2000}
        initialTrimEndMs={6000}
        onSave={jest.fn()}
      />,
    );

    await fireEvent.press(getByText('Play'));

    expect(mockSeekTo).toHaveBeenCalledWith(2);
    expect(mockPlay).toHaveBeenCalled();
  });

  it('Play does not re-seek when the current position is already inside the trim range', async () => {
    mockStatus = { ...mockStatus, currentTime: 3 };

    const { getByText } = await render(
      <TrimEditor
        uri="file:///rec.m4a"
        durationMs={10000}
        initialTrimStartMs={2000}
        initialTrimEndMs={6000}
        onSave={jest.fn()}
      />,
    );

    await fireEvent.press(getByText('Play'));

    expect(mockSeekTo).not.toHaveBeenCalled();
    expect(mockPlay).toHaveBeenCalled();
  });

  it('pauses automatically once playback reaches the trim end', async () => {
    mockStatus = { playing: true, currentTime: 5, duration: 10 };

    const { rerender } = await render(
      <TrimEditor
        uri="file:///rec.m4a"
        durationMs={10000}
        initialTrimStartMs={2000}
        initialTrimEndMs={6000}
        onSave={jest.fn()}
      />,
    );
    expect(mockPause).not.toHaveBeenCalled();

    mockStatus = { playing: true, currentTime: 6, duration: 10 };
    await rerender(
      <TrimEditor
        uri="file:///rec.m4a"
        durationMs={10000}
        initialTrimStartMs={2000}
        initialTrimEndMs={6000}
        onSave={jest.fn()}
      />,
    );

    expect(mockPause).toHaveBeenCalled();
  });

  it('reports null when an existing trim is reset back to the full range', async () => {
    const onSave = jest.fn();
    mockStatus = { ...mockStatus, currentTime: 0 };

    const { getByText, rerender } = await render(
      <TrimEditor
        uri="file:///rec.m4a"
        durationMs={10000}
        initialTrimStartMs={1000}
        initialTrimEndMs={9000}
        onSave={onSave}
      />,
    );
    await fireEvent.press(getByText('Set start here'));

    mockStatus = { ...mockStatus, currentTime: 10 };
    await rerender(
      <TrimEditor
        uri="file:///rec.m4a"
        durationMs={10000}
        initialTrimStartMs={1000}
        initialTrimEndMs={9000}
        onSave={onSave}
      />,
    );
    await fireEvent.press(getByText('Set end here'));
    await waitFor(() => expect(getByText('Trim: 0:00 – 0:10')).toBeTruthy());

    await fireEvent.press(getByText('Save trim'));
    expect(onSave).toHaveBeenCalledWith(null, null);
  });
});
