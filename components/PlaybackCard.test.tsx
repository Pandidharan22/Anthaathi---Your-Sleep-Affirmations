import { fireEvent, render, screen } from '@testing-library/react-native';

import { PlaybackCard } from './PlaybackCard';

const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockSeekTo = jest.fn();
let mockStatus = { playing: false, currentTime: 0 };

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: mockPlay, pause: mockPause, seekTo: mockSeekTo }),
  useAudioPlayerStatus: () => mockStatus,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = { playing: false, currentTime: 0 };
});

const trimmed = {
  uri: 'file:///a.m4a',
  durationMs: 10000,
  levels: null,
  trimStartMs: 2000,
  trimEndMs: 6000,
};

describe('PlaybackCard', () => {
  it('shows time within the kept part', async () => {
    mockStatus = { playing: false, currentTime: 3 };
    await render(<PlaybackCard {...trimmed} />);

    expect(screen.getByText('0:01 / 0:04')).toBeTruthy();
  });

  it('Play starts from the trim start when outside the kept part', async () => {
    await render(<PlaybackCard {...trimmed} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));

    expect(mockSeekTo).toHaveBeenCalledWith(2);
    expect(mockPlay).toHaveBeenCalled();
  });

  it('pauses on reaching the trim end', async () => {
    mockStatus = { playing: true, currentTime: 6 };
    await render(<PlaybackCard {...trimmed} />);

    expect(mockPause).toHaveBeenCalled();
  });

  it('skips 5 seconds without leaving the kept part', async () => {
    mockStatus = { playing: false, currentTime: 3 };
    await render(<PlaybackCard {...trimmed} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Forward 5 seconds' }));
    expect(mockSeekTo).toHaveBeenLastCalledWith(6);

    await fireEvent.press(screen.getByRole('button', { name: 'Back 5 seconds' }));
    expect(mockSeekTo).toHaveBeenLastCalledWith(2);
  });

  it('plays the whole recording when there is no trim', async () => {
    await render(
      <PlaybackCard
        uri="file:///a.m4a"
        durationMs={4200}
        levels={null}
        trimStartMs={null}
        trimEndMs={null}
      />,
    );

    expect(screen.getByText('0:00 / 0:04')).toBeTruthy();
  });
});
