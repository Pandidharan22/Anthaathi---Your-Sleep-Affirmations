import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';

import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { colors, fonts, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  describeAuthError,
  looksLikeEmail,
  MIN_PASSWORD_LENGTH,
  type AuthErrorField,
} from '@/lib/authErrors';

type FieldErrors = Partial<Record<'name' | AuthErrorField, string>>;

/** The Sign Up mockup: name, email and password, with errors under the field they're about. */
export default function SignUpScreen() {
  const { signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = 'Please add your name.';
    if (!looksLikeEmail(email)) next.email = "That email address doesn't look right.";
    if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    return next;
  }

  async function handleSubmit() {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    const result = await signUp(email.trim(), password, name.trim());
    setSubmitting(false);

    if (result.error) {
      const { field, message } = describeAuthError(result.errorCode, result.error);
      setErrors({ [field]: message });
      return;
    }
    // With email confirmation on, Supabase creates the user but no session yet.
    if (result.needsEmailConfirmation) setConfirmationSentTo(email.trim());
  }

  if (confirmationSentTo) {
    return (
      <AuthLayout
        mesh
        title="Check your email"
        subtitle={`We sent a confirmation link to ${confirmationSentTo}. Open it, then come back and sign in.`}
      >
        <Button
          label="Go to sign in"
          onPress={() => router.replace('/sign-in')}
          style={styles.submit}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout mesh title="Create your account" subtitle="A quiet space for your voice.">
      <View style={styles.fields}>
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          error={errors.name}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <TextField
          ref={emailRef}
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          helper={`At least ${MIN_PASSWORD_LENGTH} characters`}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
      </View>

      {errors.form ? (
        <Text accessibilityLiveRegion="polite" style={styles.formError}>
          {errors.form}
        </Text>
      ) : null}

      <Button
        label="Create Account"
        onPress={handleSubmit}
        loading={submitting}
        style={styles.submit}
      />

      {/* Replace, not push: switching between the two forms shouldn't build up history. */}
      <Pressable
        onPress={() => router.replace('/sign-in')}
        accessibilityRole="button"
        accessibilityLabel="Already have an account? Sign In"
        style={styles.switchRow}
      >
        <Text style={styles.switchText}>
          Already have an account? <Text style={styles.switchLink}>Sign In</Text>
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
  formError: {
    ...typography.caption,
    color: colors.error,
    marginTop: 16,
  },
  submit: {
    marginTop: 32,
  },
  switchRow: {
    minHeight: 44,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchText: {
    ...typography.body,
    fontSize: 15,
    color: colors.textSecondary,
  },
  switchLink: {
    fontFamily: fonts.sansBold,
    color: colors.accent,
  },
});
