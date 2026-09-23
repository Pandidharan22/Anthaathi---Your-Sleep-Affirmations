import { fireEvent, render, waitFor } from '@testing-library/react-native';

import GoalsScreen from '@/app/(tabs)/goals';

const mockListLocalGoals = jest.fn();
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

jest.mock('@/lib/goals.local', () => ({
  listLocalGoals: (...args: unknown[]) => mockListLocalGoals(...args),
}));

function makeGoal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
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
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListLocalGoals.mockResolvedValue([]);
});

describe('GoalsScreen', () => {
  it('shows an empty state when there are no goals', async () => {
    const { getByText } = await render(<GoalsScreen />);

    await waitFor(() => expect(getByText('No goals yet — tap Add goal to start your vision board.')).toBeTruthy());
  });

  it('lists active goals under an Active section', async () => {
    mockListLocalGoals.mockResolvedValue([makeGoal()]);

    const { getByText } = await render(<GoalsScreen />);

    await waitFor(() => expect(getByText('Run a marathon')).toBeTruthy());
    expect(getByText('Active')).toBeTruthy();
  });

  it('lists achieved goals under a separate Achieved section', async () => {
    mockListLocalGoals.mockResolvedValue([
      makeGoal({ id: 'goal-1', title: 'Run a marathon', status: 'active' }),
      makeGoal({ id: 'goal-2', title: 'Learn piano', status: 'achieved' }),
    ]);

    const { getByText, getAllByText } = await render(<GoalsScreen />);

    await waitFor(() => expect(getByText('Learn piano')).toBeTruthy());
    expect(getByText('Active')).toBeTruthy();
    // 'Achieved' appears twice: the section header and the achieved goal's badge.
    expect(getAllByText('Achieved')).toHaveLength(2);
  });

  it('navigates to the new-goal screen when Add goal is tapped', async () => {
    const { getByText } = await render(<GoalsScreen />);

    await fireEvent.press(getByText('Add goal'));

    expect(mockRouterPush).toHaveBeenCalledWith('/goal/new');
  });

  it('navigates to the goal detail screen when a card is tapped', async () => {
    mockListLocalGoals.mockResolvedValue([makeGoal()]);

    const { getByText } = await render(<GoalsScreen />);
    await waitFor(() => expect(getByText('Run a marathon')).toBeTruthy());

    await fireEvent.press(getByText('Run a marathon'));

    expect(mockRouterPush).toHaveBeenCalledWith('/goal/goal-1');
  });
});
