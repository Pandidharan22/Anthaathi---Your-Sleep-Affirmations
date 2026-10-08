import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import AffirmationTrimScreen from '@/app/affirmation/[id]/trim';

const mockGetLocalAffirmation = jest.fn();
const mockUpdateLocalAffirmationTrim = jest.fn();
const mockUpdateLocalAffirmationFolder = jest.fn();
const mockUpdateLocalAffirmationTitle = jest.fn();
const mockUpdateAiGuidedAffirmationScript = jest.fn();
const mockDeleteLocalAffirmation = jest.fn();
const mockListLocalFolders = jest.fn();
const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'aff-1' }),
  router: { back: (...args: unknown[]) => mockRouterBack(...args) },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/lib/affirmations.local', () => ({
  getLocalAffirmation: (...args: unknown[]) => mockGetLocalAffirmation(...args),
  updateLocalAffirmationTrim: (...args: unknown[]) => mockUpdateLocalAffirmationTrim(...args),
  updateLocalAffirmationFolder: (...args: unknown[]) => mockUpdateLocalAffirmationFolder(...args),
  updateLocalAffirmationTitle: (...args: unknown[]) => mockUpdateLocalAffirmationTitle(...args),
  updateAiGuidedAffirmationScript: (...args: unknown[]) => mockUpdateAiGuidedAffirmationScript(...args),
  deleteLocalAffirmation: (...args: unknown[]) => mockDeleteLocalAffirmation(...args),
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

jest.mock('@/components/TrimEditor', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text } = require('react-native');
  return {
    TrimEditor: ({ onSave }: { onSave: (start: number, end: number) => void }) => (
      <Pressable onPress={() => onSave(1000, 5000)} accessibilityRole="button">
        <Text>Save trim (stub)</Text>
      </Pressable>
    ),
  };
});

const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const baseAffirmation = {
  id: 'aff-1',
  title: 'Bedtime affirmation',
  local_uri: 'file:///rec.m4a',
  duration_ms: 10000,
  folder_id: null,
  trim_start_ms: null,
  trim_end_ms: null,
  source: 'recorded',
  voice_id: null,
  script_text: null,
};

const aiGuidedAffirmation = {
  ...baseAffirmation,
  id: 'aff-2',
  title: 'AI Guided affirmation',
  source: 'ai_generated',
  voice_id: 'en-gb-x-gbd-local',
  script_text: 'I am calm and capable.',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNeuralState = 'not_installed';
  mockListLocalFolders.mockResolvedValue([
    { id: 'folder-1', user_id: 'user-1', name: 'Sleep', created_at: '', updated_at: '', synced_at: null },
  ]);
});

describe('AffirmationTrimScreen', () => {
  it('shows a loading state, then the affirmation title once loaded', async () => {
    mockGetLocalAffirmation.mockResolvedValue(baseAffirmation);

    const { getByDisplayValue } = await render(<AffirmationTrimScreen />);

    expect(mockGetLocalAffirmation).toHaveBeenCalledWith('aff-1');
    await waitFor(() => expect(getByDisplayValue('Bedtime affirmation')).toBeTruthy());
  });

  it('renames the recording when the title field is edited and loses focus', async () => {
    mockGetLocalAffirmation.mockResolvedValue(baseAffirmation);
    mockUpdateLocalAffirmationTitle.mockResolvedValue(undefined);

    const { getByDisplayValue } = await render(<AffirmationTrimScreen />);
    const titleInput = await waitFor(() => getByDisplayValue('Bedtime affirmation'));

    await fireEvent.changeText(titleInput, 'New name');
    await fireEvent(titleInput, 'blur');

    await waitFor(() =>
      expect(mockUpdateLocalAffirmationTitle).toHaveBeenCalledWith('aff-1', 'New name'),
    );
  });

  it('reverts the title on blur if left empty, without saving', async () => {
    mockGetLocalAffirmation.mockResolvedValue(baseAffirmation);

    const { getByDisplayValue } = await render(<AffirmationTrimScreen />);
    const titleInput = await waitFor(() => getByDisplayValue('Bedtime affirmation'));

    await fireEvent.changeText(titleInput, '   ');
    await fireEvent(titleInput, 'blur');

    await waitFor(() => expect(getByDisplayValue('Bedtime affirmation')).toBeTruthy());
    expect(mockUpdateLocalAffirmationTitle).not.toHaveBeenCalled();
  });

  it('shows a not-found message when the affirmation does not exist', async () => {
    mockGetLocalAffirmation.mockResolvedValue(null);

    const { getByText } = await render(<AffirmationTrimScreen />);

    await waitFor(() => expect(getByText('Recording not found')).toBeTruthy());
  });

  it('saves the trim and navigates back', async () => {
    mockGetLocalAffirmation.mockResolvedValue(baseAffirmation);
    mockUpdateLocalAffirmationTrim.mockResolvedValue(undefined);

    const { getByText } = await render(<AffirmationTrimScreen />);
    await waitFor(() => expect(getByText('Save trim (stub)')).toBeTruthy());

    await fireEvent.press(getByText('Save trim (stub)'));

    await waitFor(() =>
      expect(mockUpdateLocalAffirmationTrim).toHaveBeenCalledWith('aff-1', 1000, 5000),
    );
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
  });

  it('reassigns the folder via the folder picker', async () => {
    mockGetLocalAffirmation.mockResolvedValue(baseAffirmation);
    mockUpdateLocalAffirmationFolder.mockResolvedValue(undefined);

    const { getByText } = await render(<AffirmationTrimScreen />);
    await waitFor(() => expect(getByText('Sleep')).toBeTruthy());

    await fireEvent.press(getByText('Sleep'));

    await waitFor(() =>
      expect(mockUpdateLocalAffirmationFolder).toHaveBeenCalledWith('aff-1', 'folder-1'),
    );
  });

  it('deletes the recording after confirming and navigates back', async () => {
    mockGetLocalAffirmation.mockResolvedValue(baseAffirmation);
    mockDeleteLocalAffirmation.mockResolvedValue(undefined);
    mockAlert.mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.();
    });

    const { getByText } = await render(<AffirmationTrimScreen />);
    await waitFor(() => expect(getByText('Delete recording')).toBeTruthy());

    await fireEvent.press(getByText('Delete recording'));

    await waitFor(() => expect(mockDeleteLocalAffirmation).toHaveBeenCalledWith('aff-1'));
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
  });

  it('does not show the AI Guided script/voice section for a self-recorded affirmation', async () => {
    mockGetLocalAffirmation.mockResolvedValue(baseAffirmation);

    const { getByDisplayValue, queryByText } = await render(<AffirmationTrimScreen />);
    await waitFor(() => expect(getByDisplayValue('Bedtime affirmation')).toBeTruthy());

    expect(queryByText('Regenerate')).toBeNull();
  });

  it('shows the script/voice editor and regenerates for an AI Guided affirmation', async () => {
    mockGetLocalAffirmation.mockResolvedValue(aiGuidedAffirmation);
    mockUpdateAiGuidedAffirmationScript.mockResolvedValue({
      ...aiGuidedAffirmation,
      script_text: 'I am calm, capable, and strong.',
      voice_id: 'en-us-x-tpc-local',
    });

    const { getByDisplayValue, getByText } = await render(<AffirmationTrimScreen />);
    const scriptInput = await waitFor(() => getByDisplayValue('I am calm and capable.'));

    await fireEvent.changeText(scriptInput, 'I am calm, capable, and strong.');
    await fireEvent.press(getByText('Female'));
    await fireEvent.press(getByText('Regenerate'));

    await waitFor(() =>
      expect(mockUpdateAiGuidedAffirmationScript).toHaveBeenCalledWith('aff-2', {
        scriptText: 'I am calm, capable, and strong.',
        voiceId: 'en-us-x-tpc-local',
      }),
    );
  });

  it('explains when regenerating needs natural voices that are not installed', async () => {
    mockGetLocalAffirmation.mockResolvedValue({ ...aiGuidedAffirmation, voice_id: 'kokoro:af_nicole' });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NeuralModelMissingError } = require('@/lib/neuralVoice');
    mockUpdateAiGuidedAffirmationScript.mockRejectedValue(
      new NeuralModelMissingError('The natural voices are not installed. Download them in Settings.'),
    );

    const { getByDisplayValue, getByText, findByText } = await render(<AffirmationTrimScreen />);
    const scriptInput = await waitFor(() => getByDisplayValue('I am calm and capable.'));
    await fireEvent.changeText(scriptInput, 'I am calm.');
    await fireEvent.press(getByText('Regenerate'));

    expect(
      await findByText('The natural voices are not installed. Download them in Settings.'),
    ).toBeTruthy();
    // It kept the affirmation's own (natural) voice selected rather than silently switching.
    expect(getByText('Nicole').parent?.props.accessibilityState).toEqual({ selected: true });
  });

  it('blocks regenerating with an empty script', async () => {
    mockGetLocalAffirmation.mockResolvedValue(aiGuidedAffirmation);

    const { getByDisplayValue, getByText } = await render(<AffirmationTrimScreen />);
    const scriptInput = await waitFor(() => getByDisplayValue('I am calm and capable.'));

    await fireEvent.changeText(scriptInput, '   ');
    await fireEvent.press(getByText('Regenerate'));

    await waitFor(() =>
      expect(getByText('Enter the affirmation text before regenerating.')).toBeTruthy(),
    );
    expect(mockUpdateAiGuidedAffirmationScript).not.toHaveBeenCalled();
  });
});
