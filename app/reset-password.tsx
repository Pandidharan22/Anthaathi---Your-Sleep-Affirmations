import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';

import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { colors, fonts, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { describeAuthError, MIN_PASSWORD_LENGTH, type AuthErrorField } from '@/lib/authErrors';

type FieldErrors = Partial<Record<AuthErrorField, string>>;

// Supabase's email code length is a project setting (6 by default, up to 10; live uses 8).
const CODE_PATTERN = /^\d{6,10}$/;

/**
 * Step 2 of the password reset (R.3c): the emailed code plus the new password, saved in
 * one go. On success the user is signed in, and the root layout takes them into the app
 * (it holds them here, signed out, until the password is actually saved).
 */
export default function ResetPasswordScreen() {
  const { resetPassword, requestPasswordReset, cancelPasswordReset } = useAuth();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  async function handleSave() {
    setNotice(null);
    const found: FieldErrors = {};
    if (!CODE_PATTERN.test(code.trim())) found.code = 'Enter the code from the email.';
    if (password.length < MIN_PASSWORD_LENGTH) {
      found.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const result = await resetPassword(email, code.trim(), password);
    setSaving(false);

    if (result.error) {
      const { field, message } = describeAuthError(result.errorCode, result.error);
      setErrors({ [field]: message });
    }
  }

  async function handleResend() {
    setErrors({});
    setNotice(null);
    setResending(true);
    const result = await requestPasswordReset(email);
    setResending(false);
    if (result.error) {
      setErrors({ form: describeAuthError(result.errorCode, result.error).message });
      return;
    }
    setCode('');
    setNotice('A new code is on its way.');
  }

  return (
    <AuthLayout
      title="Check your email"
      subtitle={`If there's an account for ${email}, we've sent it a code.`}
      subtitleItalic
      onBack={() => void cancelPasswordReset()}
    >
      <View style={styles.fields}>
        <TextField
          label="Code"
          value={code}
          onChangeText={setCode}
          error={errors.code}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={10}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          label="New password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          helper={`At least ${MIN_PASSWORD_LENGTH} characters`}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
      </View>

      {errors.form || notice ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.message, { color: errors.form ? colors.error : colors.success }]}
        >
          {errors.form ?? notice}
        </Text>
      ) : null}

      <Button
        label="Set New Password"
        onPress={handleSave}
        loading={saving}
        style={styles.submit}
      />

      <Pressable
        onPress={handleResend}
        disabled={resending}
        accessibilityRole="button"
        accessibilityLabel="Didn't get it? Send a new code"
        accessibilityState={{ disabled: resending, busy: resending }}
        style={styles.resendRow}
      >
        <Text style={styles.resendText}>
          Didn&apos;t get it? <Text style={styles.resendLink}>Send a new code</Text>
        </Text>
      </Pressable>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  fields: {
    marginTop: 32,
    gap: 18,
  },
  message: {
    ...typography.caption,
    marginTop: 16,
  },
  submit: {
    marginTop: 32,
  },
  resendRow: {
    minHeight: 44,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendText: {
    ...typography.body,
    fontSize: 15,
    color: colors.textSecondary,
  },
  resendLink: {
    fontFamily: fonts.sansBold,
    color: colors.accent,
  },
});
