import { fireEvent, render, waitFor } from '@testing-library/react-native';

import AffirmationTrimScreen from '@/app/affirmation/[id]/trim';

const mockGetLocalAffirmation = jest.fn();
const mockUpdateLocalAffirmationTrim = jest.fn();
const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'aff-1' }),
  router: { back: (...args: unknown[]) => mockRouterBack(...args) },
}));

jest.mock('@/lib/affirmations.local', () => ({
  getLocalAffirmation: (...args: unknown[]) => mockGetLocalAffirmation(...args),
  updateLocalAffirmationTrim: (...args: unknown[]) => mockUpdateLocalAffirmationTrim(...args),
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AffirmationTrimScreen', () => {
  it('shows a loading state, then the affirmation title once loaded', async () => {
    mockGetLocalAffirmation.mockResolvedValue({
      id: 'aff-1',
      title: 'Bedtime affirmation',
      local_uri: 'file:///rec.m4a',
      duration_ms: 10000,
      trim_start_ms: null,
      trim_end_ms: null,
    });

    const { getByText } = await render(<AffirmationTrimScreen />);

    expect(mockGetLocalAffirmation).toHaveBeenCalledWith('aff-1');
    await waitFor(() => expect(getByText('Bedtime affirmation')).toBeTruthy());
  });

  it('shows a not-found message when the affirmation does not exist', async () => {
    mockGetLocalAffirmation.mockResolvedValue(null);

    const { getByText } = await render(<AffirmationTrimScreen />);

    await waitFor(() => expect(getByText('Recording not found')).toBeTruthy());
  });

  it('saves the trim and navigates back', async () => {
    mockGetLocalAffirmation.mockResolvedValue({
      id: 'aff-1',
      title: 'Bedtime affirmation',
      local_uri: 'file:///rec.m4a',
      duration_ms: 10000,
      trim_start_ms: null,
      trim_end_ms: null,
    });
    mockUpdateLocalAffirmationTrim.mockResolvedValue(undefined);

    const { getByText } = await render(<AffirmationTrimScreen />);
    await waitFor(() => expect(getByText('Save trim (stub)')).toBeTruthy());

    await fireEvent.press(getByText('Save trim (stub)'));

    await waitFor(() =>
      expect(mockUpdateLocalAffirmationTrim).toHaveBeenCalledWith('aff-1', 1000, 5000),
    );
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
  });
});
