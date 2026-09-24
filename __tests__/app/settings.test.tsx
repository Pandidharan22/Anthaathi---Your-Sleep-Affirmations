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

const mockGetReminderPreference = jest.fn();
const mockEnableReminder = jest.fn();
const mockDisableReminder = jest.fn();
const mockAreRemindersSupported = jest.fn();

jest.mock('@/lib/reminders', () => ({
  areRemindersSupported: () => mockAreRemindersSupported(),
  getReminderPreference: (...args: unknown[]) => mockGetReminderPreference(...args),
  enableReminder: (...args: unknown[]) => mockEnableReminder(...args),
  disableReminder: (...args: unknown[]) => mockDisableReminder(...args),
  formatReminderTime: (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  },
}));

const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetReminderPreference.mockResolvedValue({ enabled: false, hour: 21, minute: 0 });
  mockAreRemindersSupported.mockReturnValue(true);
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

  it('shows the current reminder preference and no time chips while disabled', async () => {
    const { getByText, queryByText } = await render(<SettingsScreen />);

    await waitFor(() => expect(getByText('Daily reminder')).toBeTruthy());
    expect(queryByText('9:00 PM')).toBeNull();
  });

  it('enables the reminder and shows time options when the switch is toggled on', async () => {
    mockEnableReminder.mockResolvedValue({ success: true });

    const { getByRole, getByText } = await render(<SettingsScreen />);
    await waitFor(() => expect(getByText('Daily reminder')).toBeTruthy());

    await fireEvent(getByRole('switch'), 'valueChange', true);

    await waitFor(() => expect(mockEnableReminder).toHaveBeenCalledWith(21, 0));
    await waitFor(() => expect(getByText('9:00 PM')).toBeTruthy());
  });

  it('shows an inline error and leaves the reminder off when permission is denied', async () => {
    mockEnableReminder.mockResolvedValue({ success: false, canAskAgain: true });

    const { getByRole, getByText, queryByText } = await render(<SettingsScreen />);
    await waitFor(() => expect(getByText('Daily reminder')).toBeTruthy());

    await fireEvent(getByRole('switch'), 'valueChange', true);

    await waitFor(() => expect(getByText('Notification permission is needed for reminders.')).toBeTruthy());
    expect(queryByText('9:00 PM')).toBeNull();
  });

  it('disables the reminder when the switch is toggled off', async () => {
    mockGetReminderPreference.mockResolvedValue({ enabled: true, hour: 22, minute: 0 });
    mockDisableReminder.mockResolvedValue(undefined);

    const { getByRole, getByText, queryByText } = await render(<SettingsScreen />);
    await waitFor(() => expect(getByText('10:00 PM')).toBeTruthy());

    await fireEvent(getByRole('switch'), 'valueChange', false);

    await waitFor(() => expect(mockDisableReminder).toHaveBeenCalled());
    await waitFor(() => expect(queryByText('10:00 PM')).toBeNull());
  });

  it('disables the reminder switch and explains why where reminders are unsupported', async () => {
    mockAreRemindersSupported.mockReturnValue(false);
    mockGetReminderPreference.mockResolvedValue({ enabled: true, hour: 22, minute: 0 });

    const { getByRole, getByText, queryByText } = await render(<SettingsScreen />);

    await waitFor(() =>
      expect(
        getByText("Reminders aren't available in Expo Go on Android — they'll work in the full app build."),
      ).toBeTruthy(),
    );
    expect(getByRole('switch').props.accessibilityState?.disabled ?? getByRole('switch').props.disabled).toBe(true);
    expect(queryByText('10:00 PM')).toBeNull();
    expect(mockEnableReminder).not.toHaveBeenCalled();
  });

  it('reschedules when a different time chip is selected while enabled', async () => {
    mockGetReminderPreference.mockResolvedValue({ enabled: true, hour: 21, minute: 0 });
    mockEnableReminder.mockResolvedValue({ success: true });

    const { getByText } = await render(<SettingsScreen />);
    await waitFor(() => expect(getByText('10:00 PM')).toBeTruthy());

    await fireEvent.press(getByText('10:00 PM'));

    await waitFor(() => expect(mockEnableReminder).toHaveBeenCalledWith(22, 0));
  });
});
