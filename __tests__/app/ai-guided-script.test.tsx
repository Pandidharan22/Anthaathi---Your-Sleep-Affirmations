import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ScriptScreen from '@/app/ai-guided/script';

const mockPush = jest.fn();
const mockRequestAffirmationDraft = jest.fn();
const mockGetLocalGoal = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  router: { push: (...args: unknown[]) => mockPush(...args), back: jest.fn() },
}));

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@/lib/aiDraft', () => ({
  requestAffirmationDraft: (...args: unknown[]) => mockRequestAffirmationDraft(...args),
}));

jest.mock('@/lib/goals.local', () => ({
  getLocalGoal: (...args: unknown[]) => mockGetLocalGoal(...args),
}));

const goal = { id: 'goal-1', title: 'Calm mornings', description: '' };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockGetLocalGoal.mockResolvedValue(goal);
});

describe('AI Guided Script step', () => {
  it('counts sentences, reading time and characters as you type', async () => {
    await render(<ScriptScreen />);
    expect(screen.getByLabelText('Step 1 of 3')).toBeTruthy();
    expect(screen.getByText('Nothing to read yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' }).props.accessibilityState).toMatchObject(
      { disabled: true },
    );

    await fireEvent.changeText(screen.getByLabelText('Your script'), 'I am calm. I rest.');

    expect(screen.getByText('2 sentences · reads in ~4s')).toBeTruthy();
    expect(screen.getByLabelText('18 of 300 characters')).toBeTruthy();
  });

  it('continues to the voice step with a title from the script and the folder', async () => {
    mockParams = { folderId: 'f1' };
    await render(<ScriptScreen />);

    await fireEvent.changeText(
      screen.getByLabelText('Your script'),
      '  I am calm and ready for rest. I let go.  ',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/ai-guided/voice',
      params: {
        scriptText: 'I am calm and ready for rest. I let go.',
        title: 'I am calm and ready for rest',
        folderId: 'f1',
      },
    });
  });

  it("keeps a goal's title as the affirmation's title", async () => {
    mockParams = { scriptText: 'Mornings meet me gently.', suggestedTitle: 'Calm mornings' };
    await render(<ScriptScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/ai-guided/voice',
      params: { scriptText: 'Mornings meet me gently.', title: 'Calm mornings' },
    });
  });

  it('offers Redraft from the goal it came from', async () => {
    mockParams = { scriptText: 'Old words.', goalId: 'goal-1' };
    mockRequestAffirmationDraft.mockResolvedValue({ ok: true, draftText: 'New words. Softly.' });
    await render(<ScriptScreen />);

    expect(await screen.findByText('Calm mornings')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Redraft from this goal' }));

    expect(mockRequestAffirmationDraft).toHaveBeenCalledWith('goal-1', 'Calm mornings');
    await waitFor(() => expect(screen.getByDisplayValue('New words. Softly.')).toBeTruthy());
  });

  it('says why a redraft failed and keeps the script', async () => {
    mockParams = { scriptText: 'Old words.', goalId: 'goal-1' };
    mockRequestAffirmationDraft.mockResolvedValue({ ok: false, kind: 'rate_limited' });
    await render(<ScriptScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Redraft from this goal' }));

    expect(
      await screen.findByText(
        "You've reached the limit for AI drafts for now — try again in a little while.",
      ),
    ).toBeTruthy();
    expect(screen.getByDisplayValue('Old words.')).toBeTruthy();
  });

  it('has no goal card when not started from a goal', async () => {
    await render(<ScriptScreen />);
    expect(screen.queryByRole('button', { name: 'Redraft from this goal' })).toBeNull();
  });
});
