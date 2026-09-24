import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInExpoGo } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

const STORAGE_KEY = 'anthaathi.reminder';

export type ReminderPreference = {
  enabled: boolean;
  hour: number;
  minute: number;
};

const DEFAULT_PREFERENCE: ReminderPreference = { enabled: false, hour: 21, minute: 0 };

type StoredReminderState = ReminderPreference & { identifier?: string };

// Local-only (no Postgres table/sync) — SYSTEM_DESIGN.md explicitly scopes
// this to on-device scheduling with no server round trip, and a scheduled
// notification only ever exists on the device that scheduled it anyway, so
// there's nothing meaningful to sync.

/**
 * On Android inside Expo Go (SDK 53+), merely *loading* expo-notifications
 * throws: its index eagerly imports DevicePushTokenAutoRegistration.fx, which
 * registers a push-token listener at module-evaluation time, and that call
 * throws there. So the module must never be imported in that environment —
 * not even via a static top-level import. A development build (Phase 3)
 * doesn't have this restriction.
 */
export function areRemindersSupported(): boolean {
  return !(Platform.OS === 'android' && isRunningInExpoGo());
}

let notifications: typeof NotificationsModule | null = null;

function loadNotifications(): typeof NotificationsModule {
  if (!notifications) {
    // A call-time require, not a top-level import: evaluating the module is
    // what throws on Android Expo Go, so it's only evaluated once a reminder
    // is actually used — which callers only do where areRemindersSupported().
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded: typeof NotificationsModule = require('expo-notifications');
    loaded.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    notifications = loaded;
  }
  return notifications;
}

async function readState(): Promise<StoredReminderState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_PREFERENCE };
  try {
    return { ...DEFAULT_PREFERENCE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFERENCE };
  }
}

async function writeState(state: StoredReminderState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function getReminderPreference(): Promise<ReminderPreference> {
  const { enabled, hour, minute } = await readState();
  return { enabled, hour, minute };
}

async function cancelExistingSchedule(): Promise<void> {
  const state = await readState();
  if (!state.identifier) return;
  const Notifications = loadNotifications();
  try {
    await Notifications.cancelScheduledNotificationAsync(state.identifier);
  } catch {
    // Already gone (e.g. cleared by the OS); nothing to clean up.
  }
}

export type EnableReminderResult = { success: true } | { success: false; canAskAgain: boolean };

/**
 * Enables (or reschedules) the daily reminder (FR-701). Requests notification
 * permission only if not already decided — never re-nags if the user
 * previously declined and can't be asked again. Callers must check
 * areRemindersSupported() first.
 */
export async function enableReminder(hour: number, minute: number): Promise<EnableReminderResult> {
  const Notifications = loadNotifications();
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) {
    return { success: false, canAskAgain: permission.canAskAgain };
  }

  await cancelExistingSchedule();

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Tonight's affirmations",
      body: 'A few quiet minutes before sleep — open Anthaathi to begin.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });

  await writeState({ enabled: true, hour, minute, identifier });
  return { success: true };
}

/** Disables the daily reminder (FR-702). */
export async function disableReminder(): Promise<void> {
  await cancelExistingSchedule();
  const { hour, minute } = await readState();
  await writeState({ enabled: false, hour, minute });
}

/** Formats a 24-hour hour/minute pair as e.g. "9:00 PM". */
export function formatReminderTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}
