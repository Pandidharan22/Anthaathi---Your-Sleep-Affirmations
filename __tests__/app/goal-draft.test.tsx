import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

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

  it('shows the suggestion with its length', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockRequestAffirmationDraft.mockResolvedValue({ ok: true, draftText: 'I run with strength.' });

    await render(<DraftAffirmationScreen />);

    expect(await screen.findByText('“I run with strength.”')).toBeTruthy();
    expect(screen.getByText('4 words · reads in ~2s')).toBeTruthy();
    expect(screen.getByText('Run a marathon')).toBeTruthy();
  });

  it('Softer rewrites the edited text, keeping the edits, and shows the result', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockRequestAffirmationDraft
      .mockResolvedValueOnce({ ok: true, draftText: 'I run with strength.' })
      .mockResolvedValueOnce({ ok: true, draftText: 'I run gently / and with ease.' });

    await render(<DraftAffirmationScreen />);
    const input = await screen.findByDisplayValue('I run with strength.');
    await fireEvent.changeText(input, 'I run with joy.');
    await fireEvent.press(screen.getByRole('button', { name: 'Softer' }));

    expect(mockRequestAffirmationDraft).toHaveBeenLastCalledWith(
      'goal-1',
      'Run a marathon: Sub-4 hours',
      { refine: 'softer', currentText: 'I run with joy.' },
    );
    expect(await screen.findByDisplayValue('I run gently / and with ease.')).toBeTruthy();
    expect(screen.getByText('“I run gently / and with ease.”')).toBeTruthy();
  });

  it('Try another asks for a fresh draft, away from the current one', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockRequestAffirmationDraft.mockResolvedValue({ ok: true, draftText: 'I run with strength.' });

    await render(<DraftAffirmationScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Try another' }));

    expect(mockRequestAffirmationDraft).toHaveBeenLastCalledWith(
      'goal-1',
      'Run a marathon: Sub-4 hours',
      { refine: 'another', currentText: 'I run with strength.' },
    );
  });

  it('keeps the text when a refinement fails, and says why', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockRequestAffirmationDraft
      .mockResolvedValueOnce({ ok: true, draftText: 'I run with strength.' })
      .mockResolvedValueOnce({ ok: false, kind: 'rate_limited' });

    await render(<DraftAffirmationScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Shorter' }));

    expect(
      await screen.findByText(
        "You've reached the limit for AI drafts for now — try again in a little while.",
      ),
    ).toBeTruthy();
    expect(screen.getByDisplayValue('I run with strength.')).toBeTruthy();
  });

  it('lets the user edit the draft, then "Record this" navigates to /record with the edited text', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockRequestAffirmationDraft.mockResolvedValue({ ok: true, draftText: 'I run with strength.' });

    const { getByDisplayValue } = await render(<DraftAffirmationScreen />);
    const input = await waitFor(() => getByDisplayValue('I run with strength.'));

    await fireEvent.changeText(input, 'I run with joy and strength.');
    await fireEvent.press(screen.getByRole('button', { name: 'Record this' }));

    expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: '/record',
      params: { scriptText: 'I run with joy and strength.', suggestedTitle: 'Run a marathon' },
    });
  });

  it('"Use an AI voice" opens the Script step with the edited text and the goal', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockRequestAffirmationDraft.mockResolvedValue({ ok: true, draftText: 'I run with strength.' });

    const { getByDisplayValue } = await render(<DraftAffirmationScreen />);
    const input = await waitFor(() => getByDisplayValue('I run with strength.'));

    await fireEvent.changeText(input, 'I run with joy and strength.');
    await fireEvent.press(screen.getByRole('button', { name: 'Use an AI voice' }));

    expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: '/ai-guided/script',
      params: {
        scriptText: 'I run with joy and strength.',
        suggestedTitle: 'Run a marathon',
        goalId: baseGoal.id,
      },
    });
  });

  it('Back leaves without navigating to record', async () => {
    mockGetLocalGoal.mockResolvedValue(baseGoal);
    mockRequestAffirmationDraft.mockResolvedValue({ ok: true, draftText: 'I run with strength.' });

    await render(<DraftAffirmationScreen />);
    await screen.findByDisplayValue('I run with strength.');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

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
