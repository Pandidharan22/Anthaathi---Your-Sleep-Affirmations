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
  VOICE_OPTIONS: [
    { id: 'en-gb-x-gbd-local', gender: 'male', label: 'Male' },
    { id: 'en-us-x-tpc-local', gender: 'female', label: 'Female' },
  ],
}));

jest.mock('@/lib/folders.local', () => ({
  listLocalFolders: (...args: unknown[]) => mockListLocalFolders(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = {};
  mockListLocalFolders.mockResolvedValue([
    { id: 'folder-1', user_id: 'user-1', name: 'Sleep', created_at: '', updated_at: '', synced_at: null },
  ]);
});

describe('RecordAiGuidedScreen', () => {
  it('pre-fills title and script from route params, and defaults to the first (male) voice selected', async () => {
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
