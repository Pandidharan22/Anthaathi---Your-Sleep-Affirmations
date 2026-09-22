import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { deleteAccount } from '@/lib/account';

export default function SettingsScreen() {
  const colors = useThemeColors();
  const { user, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
});
