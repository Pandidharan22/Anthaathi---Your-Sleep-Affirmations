import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import JournalEntryDetailScreen from '@/app/journal/[id]';

const mockGetLocalJournalEntry = jest.fn();
const mockDeleteLocalJournalEntry = jest.fn();
const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'entry-1' }),
  router: { back: (...args: unknown[]) => mockRouterBack(...args) },
}));

jest.mock('@/lib/journal.local', () => ({
  getLocalJournalEntry: (...args: unknown[]) => mockGetLocalJournalEntry(...args),
  deleteLocalJournalEntry: (...args: unknown[]) => mockDeleteLocalJournalEntry(...args),
}));

const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Constructed from local components (not a fixed UTC literal) so the
// displayed date is deterministic regardless of the machine's timezone.
const baseEntry = {
  id: 'entry-1',
  user_id: 'user-1',
  prompt: 'What went well today?',
  body: 'Finished a hard project.',
  created_at: new Date(2026, 8, 23, 12, 0, 0).toISOString(),
  synced_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('JournalEntryDetailScreen', () => {
  it('shows a not-found message when the entry does not exist', async () => {
    mockGetLocalJournalEntry.mockResolvedValue(null);

    const { getByText } = await render(<JournalEntryDetailScreen />);

    await waitFor(() => expect(getByText('Entry not found')).toBeTruthy());
  });

  it('shows the entry once loaded, including its prompt', async () => {
    mockGetLocalJournalEntry.mockResolvedValue(baseEntry);

    const { getByText } = await render(<JournalEntryDetailScreen />);

    expect(mockGetLocalJournalEntry).toHaveBeenCalledWith('entry-1');
    await waitFor(() => expect(getByText('Finished a hard project.')).toBeTruthy());
    expect(getByText('What went well today?')).toBeTruthy();
    expect(getByText('Sep 23, 2026')).toBeTruthy();
  });

  it('does not render a prompt line for a freeform entry', async () => {
    mockGetLocalJournalEntry.mockResolvedValue({ ...baseEntry, prompt: null });

    const { getByText, queryByText } = await render(<JournalEntryDetailScreen />);

    await waitFor(() => expect(getByText('Finished a hard project.')).toBeTruthy());
    expect(queryByText('What went well today?')).toBeNull();
  });

  it('deletes the entry after confirming and navigates back', async () => {
    mockGetLocalJournalEntry.mockResolvedValue(baseEntry);
    mockDeleteLocalJournalEntry.mockResolvedValue(undefined);
    mockAlert.mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.();
    });

    const { getByText } = await render(<JournalEntryDetailScreen />);
    await waitFor(() => expect(getByText('Delete entry')).toBeTruthy());

    await fireEvent.press(getByText('Delete entry'));

    await waitFor(() => expect(mockDeleteLocalJournalEntry).toHaveBeenCalledWith('entry-1'));
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
  });
});
