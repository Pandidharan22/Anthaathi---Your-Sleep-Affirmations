import {
  disableReminder,
  enableReminder,
  formatReminderTime,
  getReminderPreference,
} from './reminders';

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockScheduleNotificationAsync = jest.fn();
const mockCancelScheduledNotificationAsync = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancelScheduledNotificationAsync(...args),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockScheduleNotificationAsync.mockResolvedValue('notif-1');
});

describe('getReminderPreference', () => {
  it('returns the disabled default when nothing is stored', async () => {
    expect(await getReminderPreference()).toEqual({ enabled: false, hour: 21, minute: 0 });
  });

  it('returns the stored preference, omitting the internal identifier', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ enabled: true, hour: 22, minute: 30, identifier: 'notif-1' }));

    expect(await getReminderPreference()).toEqual({ enabled: true, hour: 22, minute: 30 });
  });

  it('falls back to the default on malformed stored state', async () => {
    mockGetItem.mockResolvedValue('not json');

    expect(await getReminderPreference()).toEqual({ enabled: false, hour: 21, minute: 0 });
  });
});

describe('enableReminder', () => {
  it('schedules a daily notification and persists the preference when already granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });

    const result = await enableReminder(21, 30);

    expect(result).toEqual({ success: true });
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: expect.objectContaining({ title: expect.any(String) }),
      trigger: { type: 'daily', hour: 21, minute: 30 },
    });
    expect(mockSetItem).toHaveBeenCalledWith(
      'anthaathi.reminder',
      JSON.stringify({ enabled: true, hour: 21, minute: 30, identifier: 'notif-1' }),
    );
  });

  it('requests permission when not yet granted but askable', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });

    const result = await enableReminder(21, 0);

    expect(result).toEqual({ success: true });
    expect(mockRequestPermissionsAsync).toHaveBeenCalled();
  });

  it('fails without scheduling when permission is denied', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });

    const result = await enableReminder(21, 0);

    expect(result).toEqual({ success: false, canAskAgain: false });
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not re-prompt when permission was already denied and cannot be asked again', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });

    const result = await enableReminder(21, 0);

    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, canAskAgain: false });
  });

  it('cancels a previously scheduled notification before scheduling the new one', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ enabled: true, hour: 20, minute: 0, identifier: 'old-notif' }));
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });

    await enableReminder(22, 0);

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('old-notif');
  });
});

describe('disableReminder', () => {
  it('cancels the scheduled notification and persists enabled: false', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ enabled: true, hour: 22, minute: 0, identifier: 'notif-1' }));

    await disableReminder();

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
    expect(mockSetItem).toHaveBeenCalledWith(
      'anthaathi.reminder',
      JSON.stringify({ enabled: false, hour: 22, minute: 0 }),
    );
  });

  it('does nothing to cancel when there was nothing scheduled', async () => {
    await disableReminder();

    expect(mockCancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('formatReminderTime', () => {
  it('formats morning, noon, midnight, and evening correctly', () => {
    expect(formatReminderTime(9, 5)).toBe('9:05 AM');
    expect(formatReminderTime(12, 0)).toBe('12:00 PM');
    expect(formatReminderTime(0, 0)).toBe('12:00 AM');
    expect(formatReminderTime(21, 30)).toBe('9:30 PM');
  });
});
