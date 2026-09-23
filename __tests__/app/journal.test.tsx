import { fireEvent, render, waitFor } from '@testing-library/react-native';

import JournalScreen from '@/app/(tabs)/journal';

const mockListLocalJournalEntries = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
  useFocusEffect: (effect: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, []);
  },
}));

jest.mock('@/lib/journal.local', () => ({
  listLocalJournalEntries: (...args: unknown[]) => mockListLocalJournalEntries(...args),
}));

// Constructed from local components (not a fixed UTC literal) so the
// displayed date is deterministic regardless of the machine's timezone.
const CREATED_AT = new Date(2026, 8, 23, 12, 0, 0).toISOString();

function makeEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'entry-1',
    user_id: 'user-1',
    prompt: null,
    body: 'Today was a good day.',
    created_at: CREATED_AT,
    synced_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListLocalJournalEntries.mockResolvedValue([]);
});

describe('JournalScreen', () => {
  it('shows an empty state when there are no entries', async () => {
    const { getByText } = await render(<JournalScreen />);

    await waitFor(() =>
      expect(getByText('No journal entries yet — tap New entry to write your first one.')).toBeTruthy(),
    );
  });

  it('lists entries with their date and body preview', async () => {
    mockListLocalJournalEntries.mockResolvedValue([makeEntry()]);

    const { getByText } = await render(<JournalScreen />);

    await waitFor(() => expect(getByText('Today was a good day.')).toBeTruthy());
    expect(getByText('Sep 23, 2026')).toBeTruthy();
  });

  it('shows the prompt when the entry has one', async () => {
    mockListLocalJournalEntries.mockResolvedValue([
      makeEntry({ prompt: 'What went well today?' }),
    ]);

    const { getByText } = await render(<JournalScreen />);

    await waitFor(() => expect(getByText('What went well today?')).toBeTruthy());
  });

  it('navigates to the new-entry screen when New entry is tapped', async () => {
    const { getByText } = await render(<JournalScreen />);

    await fireEvent.press(getByText('New entry'));

    expect(mockRouterPush).toHaveBeenCalledWith('/journal/new');
  });

  it('navigates to the entry detail screen when a row is tapped', async () => {
    mockListLocalJournalEntries.mockResolvedValue([makeEntry()]);

    const { getByText } = await render(<JournalScreen />);
    await waitFor(() => expect(getByText('Today was a good day.')).toBeTruthy());

    await fireEvent.press(getByText('Today was a good day.'));

    expect(mockRouterPush).toHaveBeenCalledWith('/journal/entry-1');
  });
});
