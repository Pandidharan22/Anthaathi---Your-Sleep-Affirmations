// Regression guard for the Android Expo Go crash: evaluating expo-notifications
// throws there, and a static top-level import (as lib/reminders.ts originally
// had) evaluates it the moment the Settings screen loads. Kept in its own file
// because Jest's isolated module registry falls back to the main registry's
// cached mock — any other test in the same file that loads expo-notifications
// would silently make this check pass regardless.

let mockNotificationsModuleLoads = 0;

jest.mock('expo-notifications', () => {
  mockNotificationsModuleLoads += 1;
  return {};
});
jest.mock('expo', () => ({ isRunningInExpoGo: () => true }));
jest.mock('@react-native-async-storage/async-storage', () => ({}));

it('does not evaluate expo-notifications merely by importing lib/reminders', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./reminders');
  expect(mockNotificationsModuleLoads).toBe(0);
});
