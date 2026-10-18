import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { describeAuthError, looksLikeEmail } from '@/lib/authErrors';

/**
 * Step 1 of the password reset (R.3c): ask for the email and send a reset code. Not in
 * the mockups, so it follows the Sign In screen's style. Opened from Sign In's
 * "Forgot password?", with whatever email was already typed there.
 */
export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setFormError(null);
    if (!looksLikeEmail(email)) {
      setError("That email address doesn't look right.");
      return;
    }
    setError(null);

    setSending(true);
    const result = await requestPasswordReset(email.trim());
    setSending(false);

    if (result.error) {
      const shown = describeAuthError(result.errorCode, result.error);
      if (shown.field === 'email') setError(shown.message);
      else setFormError(shown.message);
      return;
    }
    // Supabase answers the same for unknown emails, so this never reveals whether an
    // account exists; the next screen's wording doesn't either.
    router.push({ pathname: '/reset-password', params: { email: email.trim() } });
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a code to choose a new one."
      subtitleItalic
    >
      <View style={styles.fields}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={error}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
      </View>

      {formError ? (
        <Text accessibilityLiveRegion="polite" style={styles.formError}>
          {formError}
        </Text>
      ) : null}

      <Button label="Send Code" onPress={handleSend} loading={sending} style={styles.submit} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  fields: {
    marginTop: 32,
  },
  formError: {
    ...typography.caption,
    color: colors.error,
    marginTop: 16,
  },
  submit: {
    marginTop: 32,
  },
});
