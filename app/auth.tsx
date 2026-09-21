import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';

type Mode = 'sign-in' | 'sign-up';

export default function AuthScreen() {
  const colors = useThemeColors();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    const result =
      mode === 'sign-in' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (mode === 'sign-up' && result.needsEmailConfirmation) {
      setConfirmationSent(true);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setConfirmationSent(false);
  }

  if (confirmationSent) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Check your email</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          We sent a confirmation link to {email.trim()}. Confirm it, then sign in below.
        </Text>
        <Pressable
          style={[styles.linkButton]}
          onPress={() => switchMode('sign-in')}
          accessibilityRole="button"
        >
          <Text style={{ color: colors.primary }}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        style={[
          styles.input,
          { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={colors.textSecondary}
        secureTextEntry
        autoComplete={mode === 'sign-in' ? 'password' : 'new-password'}
        textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
        style={[
          styles.input,
          { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />

      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        style={[styles.submitButton, { backgroundColor: colors.primary, opacity: canSubmit ? 1 : 0.5 }]}
      >
        {submitting ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={[styles.submitLabel, { color: colors.background }]}>
            {mode === 'sign-in' ? 'Sign in' : 'Sign up'}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
        accessibilityRole="button"
        style={styles.linkButton}
      >
        <Text style={{ color: colors.primary }}>
          {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontWeight: typography.title.fontWeight,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
  },
  error: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
  },
  submitButton: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  submitLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
