import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SignInScreen from '@/app/sign-in';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => mockCanGoBack,
  },
}));

const mockSignIn = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

beforeEach(() => {
  mockSignIn.mockReset();
  mockBack.mockReset();
  mockReplace.mockReset();
  mockCanGoBack = true;
});

async function fillAndSubmit(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
}

describe('SignInScreen', () => {
  it('signs in with the trimmed email', async () => {
    mockSignIn.mockResolvedValue({ error: null });
    await render(<SignInScreen />);

    await fillAndSubmit(' maya@example.com ', 'pw');

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('maya@example.com', 'pw'));
  });

  it('allows passwords shorter than the sign-up rule, for older accounts', async () => {
    mockSignIn.mockResolvedValue({ error: null });
    await render(<SignInScreen />);

    await fillAndSubmit('maya@example.com', 'abc123');

    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
  });

  it('shows wrong credentials under the password field', async () => {
    mockSignIn.mockResolvedValue({
      error: 'Invalid login credentials',
      errorCode: 'invalid_credentials',
    });
    await render(<SignInScreen />);

    await fillAndSubmit('maya@example.com', 'wrong-password');

    expect(await screen.findByText("Email or password doesn't match our records.")).toBeTruthy();
    expect(screen.getByLabelText('Password').props.accessibilityHint).toBe(
      "Email or password doesn't match our records.",
    );
  });

  it('shows a codeless failure as a connection problem', async () => {
    mockSignIn.mockResolvedValue({ error: 'TypeError: Network request failed' });
    await render(<SignInScreen />);

    await fillAndSubmit('maya@example.com', 'pw');

    expect(await screen.findByText(/check your connection/)).toBeTruthy();
  });

  it('back returns to Welcome when there is no history', async () => {
    mockCanGoBack = false;
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(mockReplace).toHaveBeenCalledWith('/welcome');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
