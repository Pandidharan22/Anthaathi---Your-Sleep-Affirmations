import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import VoiceScreen from '@/app/ai-guided/voice';

const mockDismiss = jest.fn();
const mockPush = jest.fn();
const mockCreateAiGuidedAffirmation = jest.fn();
const mockSynthesize = jest.fn();
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockReplace = jest.fn();
let mockNeuralState = 'installed';
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  router: {
    dismiss: (...args: unknown[]) => mockDismiss(...args),
    push: (...args: unknown[]) => mockPush(...args),
    back: jest.fn(),
    navigate: jest.fn(),
  },
}));

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({
    play: mockPlay,
    pause: mockPause,
    replace: mockReplace,
    addListener: () => ({ remove: jest.fn() }),
  }),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ delete: jest.fn() })),
}));

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('@/hooks/useNeuralVoiceStatus', () => ({
  useNeuralVoiceStatus: () => ({ state: mockNeuralState }),
}));

jest.mock('@/lib/neuralVoice', () => ({
  NeuralModelMissingError: class NeuralModelMissingError extends Error {},
}));

jest.mock('@/lib/affirmations.local', () => {
  class GenerationCancelledError extends Error {}
  return {
    GenerationCancelledError,
    createAiGuidedAffirmation: (...args: unknown[]) => mockCreateAiGuidedAffirmation(...args),
  };
});

jest.mock('@/lib/aiVoice', () => {
  const natural = [
    {
      engine: 'natural',
      id: 'kokoro:af_nicole',
      gender: 'female',
      label: 'Nicole',
      description: 'Soft · hushed',
    },
    {
      engine: 'natural',
      id: 'kokoro:am_michael',
      gender: 'male',
      label: 'Michael',
      description: 'Low · steady',
    },
  ];
  const system = [
    {
      engine: 'system',
      id: 'en-gb-x-gbd-local',
      gender: 'male',
      label: 'Basic male',
      description: 'Built in · plain',
    },
  ];
  return {
    NATURAL_VOICE_OPTIONS: natural,
    SYSTEM_VOICE_OPTIONS: system,
    getVoiceOption: (id: string) => [...natural, ...system].find((v) => v.id === id),
    getDefaultVoiceId: (installed: boolean) => (installed ? natural[0].id : system[0].id),
    synthesizeAffirmationAudio: (...args: unknown[]) => mockSynthesize(...args),
  };
});

const script = 'I am calm and ready for rest. I let go.';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  mockNeuralState = 'installed';
  mockParams = { scriptText: script, title: 'I am calm and ready for rest', folderId: 'f1' };
  mockSynthesize.mockResolvedValue({ localUri: 'file:///cache/preview.wav', durationMs: 2000 });
});

describe('AI Guided voice step', () => {
  it('starts on the default voice and names it on Continue', async () => {
    await render(<VoiceScreen />);

    expect(screen.getByLabelText('Step 2 of 3')).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'Nicole, Female, Soft · hushed' }).props.accessibilityState,
    ).toMatchObject({ checked: true });
    expect(screen.getByRole('button', { name: 'Continue with Nicole' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Michael, Male, Low · steady' }));
    expect(screen.getByRole('button', { name: 'Continue with Michael' })).toBeTruthy();
  });

  it('previews a voice reading the first sentence of the script, and stops it', async () => {
    await render(<VoiceScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Preview Michael' }));

    expect(mockSynthesize).toHaveBeenCalledWith(
      'I am calm and ready for rest.',
      'kokoro:am_michael',
    );
    await waitFor(() => expect(mockPlay).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith('file:///cache/preview.wav');
    expect(screen.getByRole('button', { name: 'Continue with Michael' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Stop preview' }));
    expect(mockPause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Preview Michael' })).toBeTruthy();
  });

  it('plays a voice preview again from its clip, without making it twice', async () => {
    await render(<VoiceScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Preview Nicole' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Stop preview' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Preview Nicole' }));

    expect(mockSynthesize).toHaveBeenCalledTimes(1);
    expect(mockPlay).toHaveBeenCalledTimes(2);
  });

  it('offers only the basic voices until the natural ones are downloaded', async () => {
    mockNeuralState = 'not_installed';
    await render(<VoiceScreen />);

    expect(
      screen.getByRole('radio', { name: 'Nicole, Female, Soft · hushed' }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
    expect(screen.getByRole('link')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with Basic male' })).toBeTruthy();
  });

  it('generates, then closes the flow and opens the new recording', async () => {
    mockCreateAiGuidedAffirmation.mockResolvedValue({ id: 'aff-9' });
    await render(<VoiceScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Nicole' }));

    expect(mockCreateAiGuidedAffirmation).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        title: 'I am calm and ready for rest',
        folderId: 'f1',
        scriptText: script,
        voiceId: 'kokoro:af_nicole',
      },
      { isCancelled: expect.any(Function) },
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/affirmation/aff-9'));
    expect(mockDismiss).toHaveBeenCalledWith(2);
  });

  it('shows the Generating step, and Cancel drops the result when it arrives', async () => {
    let finish: (value: { id: string }) => void = () => {};
    mockCreateAiGuidedAffirmation.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await render(<VoiceScreen />);

    // Not awaited: fireEvent hands back the handler's promise, which only settles once the
    // (still pending) generation does.
    void fireEvent.press(screen.getByRole('button', { name: 'Continue with Nicole' }));
    expect(await screen.findByText('Creating your affirmation…')).toBeTruthy();
    expect(screen.getByText('Nicole is settling into your words.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Continue with Nicole' })).toBeTruthy();

    const { isCancelled } = mockCreateAiGuidedAffirmation.mock.calls[0][1];
    expect(isCancelled()).toBe(true);
    await act(async () => finish({ id: 'aff-9' }));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('keeps the script after a failure and can try again', async () => {
    mockCreateAiGuidedAffirmation.mockRejectedValueOnce(new Error('engine busy'));
    await render(<VoiceScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Nicole' }));

    expect(await screen.findByText("Couldn't generate audio")).toBeTruthy();
    mockCreateAiGuidedAffirmation.mockResolvedValue({ id: 'aff-9' });
    await fireEvent.press(screen.getByRole('button', { name: '↻ Try again' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/affirmation/aff-9'));
    expect(mockCreateAiGuidedAffirmation.mock.calls[1][0]).toMatchObject({ scriptText: script });
  });

  it('suggests another voice when the natural voices have gone missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NeuralModelMissingError } = require('@/lib/neuralVoice');
    mockCreateAiGuidedAffirmation.mockRejectedValue(new NeuralModelMissingError('missing'));
    await render(<VoiceScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Nicole' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose another voice' }));

    expect(screen.getByLabelText('Step 2 of 3')).toBeTruthy();
  });
});
