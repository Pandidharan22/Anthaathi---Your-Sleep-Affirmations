import { fireEvent, render, waitFor } from '@testing-library/react-native';

import DraftAffirmationScreen from '@/app/goal/draft';

const mockGetLocalGoal = jest.fn();
const mockRequestAffirmationDraft = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ goalId: 'goal-1' }),
  router: {
    back: (...args: unknown[]) => mockRouterBack(...args),
    replace: (...args: unknown[]) => mockRouterReplace(...args),
  },
}));

jest.mock('@/lib/goals.local', () => ({
  getLocalGoal: (...args: unknown[]) => mockGetLocalGoal(...args),
}));

jest.mock('@/lib/aiDraft', () => ({
  requestAffirmationDraft: (...args: unknown[]) => mockRequestAffirmationDraft(...args),
}));

const baseGoal = {
  id: 'goal-1',
  user_id: 'user-1',
  title: 'Run a marathon',
  description: 'Sub-4 hours',
  image_local_uri: null,
  image_path: null,
  status: 'active',
  created_at: '',
  achieved_at: null,
  updated_at: '',
  synced_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DraftAffirmationScreen', () => {
  it('requests a draft using the goal title+description, then shows it', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockRequestAffirmationDraft.mockResolvedValue({ ok: true, draftText: 'I run with strength.' });

    const { getByDisplayValue } = await render(<DraftAffirmationScreen />);

    expect(mockGetLocalGoal).toHaveBeenCalledWith('goal-1');
    await waitFor(() =>
      expect(mockRequestAffirmationDraft).toHaveBeenCalledWith('goal-1', 'Run a marathon: Sub-4 hours'),
    );
    await waitFor(() => expect(getByDisplayValue('I run with strength.')).toBeTruthy());
  });

  it('lets the user edit the draft, then accept navigates to record with the edited text', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockRequestAffirmationDraft.mockResolvedValue({ ok: true, draftText: 'I run with strength.' });

    const { getByDisplayValue, getByText } = await render(<DraftAffirmationScreen />);
    const input = await waitFor(() => getByDisplayValue('I run with strength.'));

    await fireEvent.changeText(input, 'I run with joy and strength.');
    await fireEvent.press(getByText('Record this'));

    expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: '/record',
      params: { scriptText: 'I run with joy and strength.', suggestedTitle: 'Run a marathon' },
    });
  });

  it('Discard goes back without navigating to record', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockRequestAffirmationDraft.mockResolvedValue({ ok: true, draftText: 'I run with strength.' });

    const { getByText } = await render(<DraftAffirmationScreen />);
    await waitFor(() => expect(getByText('Discard')).toBeTruthy());

    await fireEvent.press(getByText('Discard'));

    expect(mockRouterBack).toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('shows a rate-limit error and lets the user try again', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockRequestAffirmationDraft
      .mockResolvedValueOnce({ ok: false, kind: 'rate_limited' })
      .mockResolvedValueOnce({ ok: true, draftText: 'I run with strength.' });

    const { getByText, getByDisplayValue } = await render(<DraftAffirmationScreen />);

    await waitFor(() =>
      expect(
        getByText("You've reached the limit for AI drafts for now — try again in a little while."),
      ).toBeTruthy(),
    );

    await fireEvent.press(getByText('Try again'));

    await waitFor(() => expect(getByDisplayValue('I run with strength.')).toBeTruthy());
    expect(mockRequestAffirmationDraft).toHaveBeenCalledTimes(2);
  });

  it('shows a provider-unavailable error without crashing', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockRequestAffirmationDraft.mockResolvedValue({ ok: false, kind: 'provider_unavailable' });

    const { getByText } = await render(<DraftAffirmationScreen />);

    await waitFor(() =>
      expect(
        getByText("Drafting isn't working right now. Please try again shortly."),
      ).toBeTruthy(),
    );
  });

  it('FR-503: an unexpected throw from requestAffirmationDraft still lands on the error state, not a stuck spinner', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockRequestAffirmationDraft.mockRejectedValue(new Error('unexpected'));

    const { getByText, queryByText } = await render(<DraftAffirmationScreen />);

    await waitFor(() => expect(getByText('Something went wrong. Please try again.')).toBeTruthy());
    expect(queryByText('Drafting your affirmation…')).toBeNull();
  });

  it('shows a not-found message when the goal does not exist, with no Try again button', async () => {
    mockGetLocalGoal.mockResolvedValue(null);

    const { getByText, queryByText } = await render(<DraftAffirmationScreen />);

    await waitFor(() => expect(getByText('Goal not found.')).toBeTruthy());
    expect(mockRequestAffirmationDraft).not.toHaveBeenCalled();
    expect(queryByText('Try again')).toBeNull();
  });
});
