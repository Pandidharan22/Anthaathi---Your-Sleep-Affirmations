import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SignUpScreen from '@/app/sign-up';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: jest.fn(),
    canGoBack: () => true,
  },
}));

const mockSignUp = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ signUp: mockSignUp }),
}));

beforeEach(() => {
  mockSignUp.mockReset();
  mockReplace.mockReset();
});

async function fillAndSubmit(name: string, email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Name'), name);
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
  await fireEvent.press(screen.getByRole('button', { name: 'Create Account' }));
}

describe('SignUpScreen', () => {
  it('sends trimmed name and email with the password', async () => {
    mockSignUp.mockResolvedValue({ error: null, needsEmailConfirmation: false });
    await render(<SignUpScreen />);

    await fillAndSubmit('  Maya ', ' maya@example.com ', 'longenough');

    await waitFor(() =>
      expect(mockSignUp).toHaveBeenCalledWith('maya@example.com', 'longenough', 'Maya'),
    );
  });

  it('checks every field before sending anything', async () => {
    await render(<SignUpScreen />);

    await fillAndSubmit('', 'not-an-email', 'short');

    expect(mockSignUp).not.toHaveBeenCalled();
    expect(screen.getByText('Please add your name.')).toBeTruthy();
    expect(screen.getByText("That email address doesn't look right.")).toBeTruthy();
    expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();
  });

  it('shows an existing-account error under the email field', async () => {
    mockSignUp.mockResolvedValue({
      error: 'User already registered',
      errorCode: 'user_already_exists',
    });
    await render(<SignUpScreen />);

    await fillAndSubmit('Maya', 'maya@example.com', 'longenough');

    expect(
      await screen.findByText('An account with this email already exists. Try signing in instead.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Email').props.accessibilityHint).toBe(
      'An account with this email already exists. Try signing in instead.',
    );
  });

  it('links to sign in, replacing this screen', async () => {
    await render(<SignUpScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Already have an account? Sign In' }));

    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
  });

  it('asks the user to confirm their email when Supabase needs it, then goes to sign in', async () => {
    mockSignUp.mockResolvedValue({ error: null, needsEmailConfirmation: true });
    await render(<SignUpScreen />);

    await fillAndSubmit('Maya', 'maya@example.com', 'longenough');

    expect(await screen.findByText('Check your email')).toBeTruthy();
    expect(screen.getByText(/maya@example\.com/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Go to sign in' }));
    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
  });
});
