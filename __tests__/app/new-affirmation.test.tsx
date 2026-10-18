import { fireEvent, render, screen } from '@testing-library/react-native';

import NewAffirmationScreen from '@/app/new-affirmation';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: { folderId?: string } = {};
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: () => mockBack(),
  },
  useLocalSearchParams: () => mockParams,
}));

beforeEach(() => {
  mockReplace.mockReset();
  mockBack.mockReset();
  mockParams = {};
});

describe('NewAffirmationScreen', () => {
  it('starts with Self-Recorded chosen', async () => {
    await render(<NewAffirmationScreen />);

    expect(
      screen.getByRole('radio', { name: 'Self-Recorded. Speak it in your own voice' }).props
        .accessibilityState,
    ).toMatchObject({ checked: true });
    expect(
      screen.getByRole('radio', { name: 'AI Guided. Hear it narrated back to you' }).props
        .accessibilityState,
    ).toMatchObject({ checked: false });
  });

  it('Continue opens the recorder for Self-Recorded', async () => {
    await render(<NewAffirmationScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/record', params: {} });
  });

  it('Continue opens AI Guided after choosing it, passing the folder on', async () => {
    mockParams = { folderId: 'f1' };
    await render(<NewAffirmationScreen />);

    await fireEvent.press(
      screen.getByRole('radio', { name: 'AI Guided. Hear it narrated back to you' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/record-ai-guided',
      params: { folderId: 'f1' },
    });
  });

  it('does not pass the Unfiled pseudo-folder on', async () => {
    mockParams = { folderId: 'unfiled' };
    await render(<NewAffirmationScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/record', params: {} });
  });

  it('reads the headline as one heading', async () => {
    await render(<NewAffirmationScreen />);

    expect(screen.getByRole('header', { name: 'How would you like it spoken?' })).toBeTruthy();
  });
});
