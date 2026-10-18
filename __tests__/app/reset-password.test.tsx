import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ResetPasswordScreen from '@/app/reset-password';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ email: 'maya@example.com' }),
}));

const mockReset = jest.fn();
const mockRequest = jest.fn();
const mockCancel = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    resetPassword: mockReset,
    requestPasswordReset: mockRequest,
    cancelPasswordReset: mockCancel,
  }),
}));

beforeEach(() => {
  mockReset.mockReset();
  mockRequest.mockReset();
  mockCancel.mockReset();
  mockBack.mockReset();
});

async function fillAndSave(code: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Code'), code);
  await fireEvent.changeText(screen.getByLabelText('New password'), password);
  await fireEvent.press(screen.getByRole('button', { name: 'Set New Password' }));
}

describe('ResetPasswordScreen', () => {
  it("doesn't say whether the account exists", async () => {
    await render(<ResetPasswordScreen />);

    expect(screen.getByText(/If there's an account for maya@example\.com/)).toBeTruthy();
  });

  it('saves the new password with the code', async () => {
    mockReset.mockResolvedValue({ error: null });
    await render(<ResetPasswordScreen />);

    await fillAndSave(' 123456 ', 'new-password');

    await waitFor(() =>
      expect(mockReset).toHaveBeenCalledWith('maya@example.com', '123456', 'new-password'),
    );
  });

  it('checks the code and password length before sending', async () => {
    await render(<ResetPasswordScreen />);

    await fillAndSave('12', 'short');

    expect(mockReset).not.toHaveBeenCalled();
    expect(screen.getByText('Enter the code from the email.')).toBeTruthy();
    expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();
  });

  it('shows a wrong or expired code under the code field', async () => {
    mockReset.mockResolvedValue({
      error: 'Token has expired or is invalid',
      errorCode: 'otp_expired',
    });
    await render(<ResetPasswordScreen />);

    await fillAndSave('000000', 'new-password');

    expect(await screen.findByText(/That code didn't work/)).toBeTruthy();
    expect(screen.getByLabelText('Code').props.accessibilityHint).toMatch(/That code didn't work/);
  });

  it('sends a new code and clears the old one', async () => {
    mockRequest.mockResolvedValue({ error: null });
    await render(<ResetPasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText('Code'), '111111');

    await fireEvent.press(screen.getByRole('button', { name: "Didn't get it? Send a new code" }));

    expect(mockRequest).toHaveBeenCalledWith('maya@example.com');
    expect(await screen.findByText('A new code is on its way.')).toBeTruthy();
    expect(screen.getByLabelText('Code').props.value).toBe('');
  });

  it('back leaves the reset flow cleanly', async () => {
    await render(<ResetPasswordScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(mockCancel).toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });
});
