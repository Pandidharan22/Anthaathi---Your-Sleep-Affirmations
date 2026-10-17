import { fireEvent, render, waitFor } from '@testing-library/react-native';

import AuthScreen from '@/app/auth';

const mockSignIn = jest.fn();
const mockSignUp = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signUp: mockSignUp,
    signOut: jest.fn(),
    session: null,
    user: null,
    loading: false,
  }),
}));

let mockParams: { mode?: string } = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
}));

beforeEach(() => {
  jest.resetAllMocks();
  mockParams = {};
});

describe('AuthScreen', () => {
  it("opens in sign-up mode when Welcome's Get started asks for it", async () => {
    mockParams = { mode: 'sign-up' };

    const { getByText } = await render(<AuthScreen />);

    expect(getByText('Create your account')).toBeTruthy();
    expect(getByText('Sign up')).toBeTruthy();
  });

  it('defaults to sign-in mode and submits via signIn', async () => {
    mockSignIn.mockResolvedValue({ error: null });

    const { getByPlaceholderText, getByText } = await render(<AuthScreen />);

    await fireEvent.changeText(getByPlaceholderText('Email'), 'alice@example.com');
    await fireEvent.changeText(getByPlaceholderText('Password'), 'hunter22');
    await fireEvent.press(getByText('Sign in'));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('alice@example.com', 'hunter22'));
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('switches to sign-up mode and submits via signUp', async () => {
    mockSignUp.mockResolvedValue({ error: null, needsEmailConfirmation: false });

    const { getByPlaceholderText, getByText } = await render(<AuthScreen />);

    await fireEvent.press(getByText("Don't have an account? Sign up"));
    await fireEvent.changeText(getByPlaceholderText('Email'), 'bob@example.com');
    await fireEvent.changeText(getByPlaceholderText('Password'), 'correct-horse');
    await fireEvent.press(getByText('Sign up'));

    await waitFor(() =>
      expect(mockSignUp).toHaveBeenCalledWith('bob@example.com', 'correct-horse'),
    );
  });

  it('shows a confirmation message when sign-up requires email confirmation', async () => {
    mockSignUp.mockResolvedValue({ error: null, needsEmailConfirmation: true });

    const { getByPlaceholderText, getByText } = await render(<AuthScreen />);

    await fireEvent.press(getByText("Don't have an account? Sign up"));
    await fireEvent.changeText(getByPlaceholderText('Email'), 'bob@example.com');
    await fireEvent.changeText(getByPlaceholderText('Password'), 'correct-horse');
    await fireEvent.press(getByText('Sign up'));

    await waitFor(() => expect(getByText('Check your email')).toBeTruthy());
  });

  it('shows an inline error message when sign-in fails', async () => {
    mockSignIn.mockResolvedValue({ error: 'Invalid login credentials' });

    const { getByPlaceholderText, getByText } = await render(<AuthScreen />);

    await fireEvent.changeText(getByPlaceholderText('Email'), 'alice@example.com');
    await fireEvent.changeText(getByPlaceholderText('Password'), 'wrong-password');
    await fireEvent.press(getByText('Sign in'));

    await waitFor(() => expect(getByText('Invalid login credentials')).toBeTruthy());
  });

  it('disables submit until both email and password are filled in', async () => {
    const { getByPlaceholderText, getByText } = await render(<AuthScreen />);

    expect(getByText('Sign in').parent?.props.accessibilityState?.disabled).toBe(true);

    await fireEvent.changeText(getByPlaceholderText('Email'), 'alice@example.com');
    await fireEvent.changeText(getByPlaceholderText('Password'), 'hunter22');

    expect(getByText('Sign in').parent?.props.accessibilityState?.disabled).toBe(false);
  });
});
