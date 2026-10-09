import { fireEvent, render, waitFor } from '@testing-library/react-native';

import RecordAiGuidedScreen from '@/app/record-ai-guided';

const mockCreateAiGuidedAffirmation = jest.fn();
const mockListLocalFolders = jest.fn();
const mockRouterBack = jest.fn();

let mockSearchParams: { scriptText?: string; suggestedTitle?: string } = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockSearchParams,
  router: { back: (...args: unknown[]) => mockRouterBack(...args) },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/lib/affirmations.local', () => ({
  createAiGuidedAffirmation: (...args: unknown[]) => mockCreateAiGuidedAffirmation(...args),
}));

jest.mock('@/lib/aiVoice', () => ({
  getDefaultVoiceId: (naturalInstalled: boolean) =>
    naturalInstalled ? 'kokoro:af_nicole' : 'en-gb-x-gbd-local',
}));

let mockNeuralState: 'installed' | 'not_installed' = 'not_installed';
jest.mock('@/lib/neuralVoice', () => ({
  getNeuralVoiceStatus: () => ({ state: mockNeuralState }),
  NeuralModelMissingError: class NeuralModelMissingError extends Error {},
}));

// The real VoicePicker has its own tests; this stand-in keeps the same contract (value/onChange).
jest.mock('@/components/VoicePicker', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text, View } = require('react-native');
  const voices = [
    { id: 'kokoro:af_nicole', label: 'Nicole' },
    { id: 'en-gb-x-gbd-local', label: 'Male' },
    { id: 'en-us-x-tpc-local', label: 'Female' },
  ];
  return {
    VoicePicker: ({ value, onChange }: { value: string; onChange: (id: string) => void }) => (
      <View>
        {voices.map((v) => (
          <Pressable
            key={v.id}
            onPress={() => onChange(v.id)}
            accessibilityState={{ selected: v.id === value }}
          >
            <Text>{v.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});

jest.mock('@/lib/folders.local', () => ({
  listLocalFolders: (...args: unknown[]) => mockListLocalFolders(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = {};
  mockNeuralState = 'not_installed';
  mockListLocalFolders.mockResolvedValue([
    { id: 'folder-1', user_id: 'user-1', name: 'Sleep', created_at: '', updated_at: '', synced_at: null },
  ]);
});

describe('RecordAiGuidedScreen', () => {
  it('explains the / pause mark under the script field', async () => {
    const { getByText } = await render(<RecordAiGuidedScreen />);
    expect(getByText(/add \/ where you'd like a short pause/)).toBeTruthy();
  });

  it('defaults to Nicole once the natural voices are installed', async () => {
    mockNeuralState = 'installed';
    const { getByText } = await render(<RecordAiGuidedScreen />);
    expect(getByText('Nicole').parent?.props.accessibilityState).toEqual({ selected: true });
  });

  it('explains when the chosen natural voice is not installed', async () => {
    mockNeuralState = 'installed';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NeuralModelMissingError } = require('@/lib/neuralVoice');
    const missing = new NeuralModelMissingError(
      'The natural voices are not installed. Download them in Settings.',
    );
    mockCreateAiGuidedAffirmation.mockRejectedValue(missing);

    const { getByPlaceholderText, getByText, findByText } = await render(<RecordAiGuidedScreen />);
    await fireEvent.changeText(getByPlaceholderText('Title'), 'Bedtime');
    await fireEvent.changeText(getByPlaceholderText('What should this affirmation say?'), 'I am calm.');
    await fireEvent.press(getByText('Generate'));

    expect(await findByText('The natural voices are not installed. Download them in Settings.')).toBeTruthy();
  });


  it('pre-fills title and script from route params, and defaults to a basic voice without the natural voices', async () => {
    mockSearchParams = { scriptText: 'I am calm.', suggestedTitle: 'Morning calm' };

    const { getByDisplayValue, getByText } = await render(<RecordAiGuidedScreen />);

    await waitFor(() => expect(getByDisplayValue('Morning calm')).toBeTruthy());
    expect(getByDisplayValue('I am calm.')).toBeTruthy();
    expect(getByText('Male').parent?.props.accessibilityState).toEqual({ selected: true });
    expect(getByText('Female').parent?.props.accessibilityState).toEqual({ selected: false });
  });

  it('generates with the selected voice, title, script, and folder, then navigates back', async () => {
    mockCreateAiGuidedAffirmation.mockResolvedValue({ id: 'aff-1' });

    const { getByPlaceholderText, getByText } = await render(<RecordAiGuidedScreen />);
    await waitFor(() => expect(getByText('Sleep')).toBeTruthy());

    await fireEvent.changeText(getByPlaceholderText('Title'), 'Bedtime');
    await fireEvent.changeText(
      getByPlaceholderText('What should this affirmation say?'),
      'I am calm and capable.',
    );
    await fireEvent.press(getByText('Female'));
    await fireEvent.press(getByText('Sleep'));
    await fireEvent.press(getByText('Generate'));

    await waitFor(() =>
      expect(mockCreateAiGuidedAffirmation).toHaveBeenCalledWith({
        userId: 'user-1',
        title: 'Bedtime',
        folderId: 'folder-1',
        scriptText: 'I am calm and capable.',
        voiceId: 'en-us-x-tpc-local',
      }),
    );
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
  });

  it('blocks generating with an empty title', async () => {
    const { getByPlaceholderText, getByText } = await render(<RecordAiGuidedScreen />);

    await fireEvent.changeText(
      getByPlaceholderText('What should this affirmation say?'),
      'I am calm.',
    );
    await fireEvent.press(getByText('Generate'));

    await waitFor(() =>
      expect(getByText('Give this affirmation a title before generating.')).toBeTruthy(),
    );
    expect(mockCreateAiGuidedAffirmation).not.toHaveBeenCalled();
  });

  it('blocks generating with an empty script', async () => {
    const { getByPlaceholderText, getByText } = await render(<RecordAiGuidedScreen />);

    await fireEvent.changeText(getByPlaceholderText('Title'), 'Bedtime');
    await fireEvent.press(getByText('Generate'));

    await waitFor(() =>
      expect(getByText('Enter the affirmation text before generating.')).toBeTruthy(),
    );
    expect(mockCreateAiGuidedAffirmation).not.toHaveBeenCalled();
  });

  it('shows an error and lets the user retry if generation fails', async () => {
    mockCreateAiGuidedAffirmation.mockRejectedValue(new Error('boom'));

    const { getByPlaceholderText, getByText } = await render(<RecordAiGuidedScreen />);

    await fireEvent.changeText(getByPlaceholderText('Title'), 'Bedtime');
    await fireEvent.changeText(
      getByPlaceholderText('What should this affirmation say?'),
      'I am calm.',
    );
    await fireEvent.press(getByText('Generate'));

    await waitFor(() =>
      expect(getByText('Could not generate the affirmation. Please try again.')).toBeTruthy(),
    );
    expect(mockRouterBack).not.toHaveBeenCalled();
    // Screen is usable again, not stuck in the "Generating…" state.
    expect(getByText('Generate')).toBeTruthy();
  });
});
