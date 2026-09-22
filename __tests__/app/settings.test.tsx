import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import SettingsScreen from '@/app/(tabs)/settings';

const mockSignOut = jest.fn();
const mockDeleteAccount = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'alice@example.com' }, signOut: mockSignOut }),
}));

jest.mock('@/lib/account', () => ({
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
}));

const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SettingsScreen', () => {
  it('shows the signed-in email and signs out on tap', async () => {
    const { getByText } = await render(<SettingsScreen />);

    expect(getByText('Signed in as alice@example.com')).toBeTruthy();

    await fireEvent.press(getByText('Sign out'));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('prompts for confirmation before deleting, and does nothing on Cancel', async () => {
    mockAlert.mockImplementation(() => {});

    const { getByText } = await render(<SettingsScreen />);
    await fireEvent.press(getByText('Delete account'));

    expect(mockAlert).toHaveBeenCalledWith(
      'Delete account?',
      expect.stringContaining('cannot be undone'),
      expect.any(Array),
    );
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it('deletes the account when confirmed', async () => {
    mockDeleteAccount.mockResolvedValue(undefined);
    mockAlert.mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.();
    });

    const { getByText } = await render(<SettingsScreen />);
    await fireEvent.press(getByText('Delete account'));

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledWith('user-1'));
  });

  it('shows an error and re-enables the button when deletion fails', async () => {
    mockDeleteAccount.mockRejectedValue(new Error('network error'));
    mockAlert.mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.();
    });

    const { getByText } = await render(<SettingsScreen />);
    await fireEvent.press(getByText('Delete account'));

    await waitFor(() =>
      expect(getByText('Could not delete your account. Please check your connection and try again.')).toBeTruthy(),
    );
    expect(getByText('Delete account').parent?.props.accessibilityState?.disabled).toBe(false);
  });
});
