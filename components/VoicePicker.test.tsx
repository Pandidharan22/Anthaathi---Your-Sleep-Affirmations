import { fireEvent, render } from '@testing-library/react-native';

import { VoicePicker } from '@/components/VoicePicker';

// Real voice catalogue (lib/aiVoice.ts); only its engine dependencies are stubbed out.
jest.mock('@/modules/anthaathi-tts', () => ({ __esModule: true, default: {} }));
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn() }));
jest.mock('@/lib/neuralVoice', () => ({
  NEURAL_VOICES: [
    { name: 'af_bella', label: 'Bella', speakerId: 2, speed: 0.8 },
    { name: 'af_nicole', label: 'Nicole', speakerId: 6, speed: 1 },
    { name: 'am_echo', label: 'Echo', speakerId: 12, speed: 1 },
    { name: 'am_michael', label: 'Michael', speakerId: 16, speed: 1 },
  ],
  synthesizeNeural: jest.fn(),
}));

let mockState: 'installed' | 'not_installed' = 'installed';
jest.mock('@/hooks/useNeuralVoiceStatus', () => ({
  useNeuralVoiceStatus: () => ({ state: mockState }),
}));

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

function stateOf(getByText: (t: string) => { parent: unknown }, label: string) {
  return (getByText(label).parent as { props: { accessibilityState: object } }).props
    .accessibilityState;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState = 'installed';
});

describe('VoicePicker', () => {
  it('offers the four natural voices and the basic voices when installed', async () => {
    const onChange = jest.fn();
    const { getByText, queryByText } = await render(
      <VoicePicker value="kokoro:af_nicole" onChange={onChange} />,
    );

    for (const label of ['Nicole', 'Bella', 'Michael', 'Echo', 'Basic male', 'Basic female']) {
      expect(getByText(label)).toBeTruthy();
    }
    expect(stateOf(getByText, 'Nicole')).toEqual({ selected: true, disabled: false });
    expect(queryByText(/Download the natural voices/)).toBeNull();

    await fireEvent.press(getByText('Michael'));
    expect(onChange).toHaveBeenCalledWith('kokoro:am_michael');
  });

  it('disables natural voices until downloaded, pointing to Settings', async () => {
    mockState = 'not_installed';
    const onChange = jest.fn();
    const { getByText } = await render(
      <VoicePicker value="en-gb-x-gbd-local" onChange={onChange} />,
    );

    expect(stateOf(getByText, 'Nicole')).toEqual({ selected: false, disabled: true });
    await fireEvent.press(getByText('Nicole'));
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.press(getByText('Download the natural voices in Settings to use them.'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');

    await fireEvent.press(getByText('Basic female'));
    expect(onChange).toHaveBeenCalledWith('en-us-x-tpc-local');
  });

  it('warns when the selected natural voice is no longer installed', async () => {
    mockState = 'not_installed';
    const { getByText } = await render(
      <VoicePicker value="kokoro:af_nicole" onChange={jest.fn()} />,
    );
    expect(getByText(/This voice needs the natural voices/)).toBeTruthy();
  });
});
