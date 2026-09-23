import { fireEvent, render, waitFor } from '@testing-library/react-native';

import NewJournalEntryScreen from '@/app/journal/new';

const mockRouterBack = jest.fn();
const mockCreateLocalJournalEntry = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockRouterBack(...args) },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/lib/journal.local', () => ({
  createLocalJournalEntry: (...args: unknown[]) => mockCreateLocalJournalEntry(...args),
}));

jest.mock('@/lib/journalPrompts', () => ({
  getDailyPrompt: () => 'What went well today?',
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateLocalJournalEntry.mockResolvedValue({});
});

describe('NewJournalEntryScreen', () => {
  it('shows the daily prompt by default', async () => {
    const { getByText } = await render(<NewJournalEntryScreen />);

    await waitFor(() => expect(getByText('What went well today?')).toBeTruthy());
  });

  it('blocks saving with empty body', async () => {
    const { getByText } = await render(<NewJournalEntryScreen />);

    await fireEvent.press(getByText('Save'));

    await waitFor(() => expect(getByText('Write something before saving.')).toBeTruthy());
    expect(mockCreateLocalJournalEntry).not.toHaveBeenCalled();
  });

  it('saves against the daily prompt by default', async () => {
    const { getByText, getByPlaceholderText } = await render(<NewJournalEntryScreen />);

    await fireEvent.changeText(getByPlaceholderText("Write what's on your mind…"), 'Finished a hard project.');
    await fireEvent.press(getByText('Save'));

    await waitFor(() =>
      expect(mockCreateLocalJournalEntry).toHaveBeenCalledWith({
        userId: 'user-1',
        prompt: 'What went well today?',
        body: 'Finished a hard project.',
      }),
    );
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
  });

  it('saves freeform (no prompt) when the user switches out of the prompt', async () => {
    const { getByText, getByPlaceholderText } = await render(<NewJournalEntryScreen />);

    await fireEvent.press(getByText('Write freeform instead'));
    await fireEvent.changeText(getByPlaceholderText("Write what's on your mind…"), 'Random thoughts.');
    await fireEvent.press(getByText('Save'));

    await waitFor(() =>
      expect(mockCreateLocalJournalEntry).toHaveBeenCalledWith({
        userId: 'user-1',
        prompt: null,
        body: 'Random thoughts.',
      }),
    );
  });

  it('can switch back to the prompt after switching to freeform', async () => {
    const { getByText, queryByText } = await render(<NewJournalEntryScreen />);

    await fireEvent.press(getByText('Write freeform instead'));
    expect(queryByText('What went well today?')).toBeNull();

    await fireEvent.press(getByText("Use today's prompt instead"));
    expect(getByText('What went well today?')).toBeTruthy();
  });

  it('shows an error message when saving fails', async () => {
    mockCreateLocalJournalEntry.mockRejectedValue(new Error('disk full'));

    const { getByText, getByPlaceholderText } = await render(<NewJournalEntryScreen />);
    await fireEvent.changeText(getByPlaceholderText("Write what's on your mind…"), 'Text');
    await fireEvent.press(getByText('Save'));

    await waitFor(() => expect(getByText('Could not save your entry. Please try again.')).toBeTruthy());
  });
});
