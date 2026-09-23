import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { deleteAccount } from '@/lib/account';
import {
  disableReminder,
  enableReminder,
  formatReminderTime,
  getReminderPreference,
  type ReminderPreference,
} from '@/lib/reminders';

const REMINDER_TIME_OPTIONS = [
  { hour: 20, minute: 0 },
  { hour: 20, minute: 30 },
  { hour: 21, minute: 0 },
  { hour: 21, minute: 30 },
  { hour: 22, minute: 0 },
  { hour: 22, minute: 30 },
  { hour: 23, minute: 0 },
] as const;

export default function SettingsScreen() {
  const colors = useThemeColors();
  const { user, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reminder, setReminder] = useState<ReminderPreference>({ enabled: false, hour: 21, minute: 0 });
  const [reminderError, setReminderError] = useState<string | null>(null);

  useEffect(() => {
    getReminderPreference().then(setReminder);
  }, []);

  async function handleToggleReminder(nextEnabled: boolean) {
    setReminderError(null);
    if (!nextEnabled) {
      await disableReminder();
      setReminder((prev) => ({ ...prev, enabled: false }));
      return;
    }
    const result = await enableReminder(reminder.hour, reminder.minute);
    if (!result.success) {
      setReminderError(
        result.canAskAgain
          ? 'Notification permission is needed for reminders.'
          : 'Notification permission is needed for reminders. Enable it for Anthaathi in your device Settings.',
      );
      return;
    }
    setReminder((prev) => ({ ...prev, enabled: true }));
  }

  async function handleSelectReminderTime(hour: number, minute: number) {
    setReminderError(null);
    setReminder((prev) => ({ ...prev, hour, minute }));
    if (!reminder.enabled) return;
    const result = await enableReminder(hour, minute);
    if (!result.success) {
      setReminderError('Could not update the reminder time. Please try again.');
    }
  }

  function confirmDeleteAccount() {
    if (!user) return;
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all your recordings, folders, and other data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setError(null);
            setDeleting(true);
            try {
              await deleteAccount(user.id);
            } catch {
              setError('Could not delete your account. Please check your connection and try again.');
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Settings</Text>
      {user ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Signed in as {user.email}
        </Text>
      ) : null}

      <View style={[styles.reminderSection, { borderColor: colors.border }]}>
        <View style={styles.reminderHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Daily reminder</Text>
          <Switch value={reminder.enabled} onValueChange={handleToggleReminder} />
        </View>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Get a nightly reminder to play your affirmations.
        </Text>
        {reminderError ? <Text style={[styles.error, { color: colors.error }]}>{reminderError}</Text> : null}
        {reminder.enabled ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            {REMINDER_TIME_OPTIONS.map(({ hour, minute }) => {
              const selected = reminder.hour === hour && reminder.minute === minute;
              return (
                <Pressable
                  key={`${hour}:${minute}`}
                  onPress={() => handleSelectReminderTime(hour, minute)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.chip,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  <Text style={{ color: selected ? colors.background : colors.textPrimary }}>
                    {formatReminderTime(hour, minute)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      <Pressable
        onPress={() => signOut()}
        accessibilityRole="button"
        style={[styles.button, { borderColor: colors.error }]}
      >
        <Text style={{ color: colors.error }}>Sign out</Text>
      </Pressable>

      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <Pressable
        onPress={confirmDeleteAccount}
        disabled={deleting}
        accessibilityRole="button"
        style={[styles.button, { borderColor: colors.error, opacity: deleting ? 0.5 : 1 }]}
      >
        {deleting ? (
          <ActivityIndicator color={colors.error} />
        ) : (
          <Text style={{ color: colors.error }}>Delete account</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontWeight: typography.title.fontWeight,
  },
  description: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
  },
  button: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
  },
  reminderSection: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: typography.subtitle.fontWeight,
  },
  chipScroll: {
    flexGrow: 0,
    alignSelf: 'stretch',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
});
