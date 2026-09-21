import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function SettingsScreen() {
  const colors = useThemeColors();
  const { user, signOut } = useAuth();

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
        style={[styles.signOutButton, { borderColor: colors.error }]}
      >
        <Text style={{ color: colors.error }}>Sign out</Text>
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
  signOutButton: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
