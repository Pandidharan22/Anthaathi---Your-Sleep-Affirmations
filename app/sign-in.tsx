import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';

import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { colors, fonts, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { describeAuthError, looksLikeEmail, type AuthErrorField } from '@/lib/authErrors';

type FieldErrors = Partial<Record<AuthErrorField, string>>;

/**
 * The Sign In mockup. A successful sign-in needs no navigation here: the session
 * arriving flips the root stack's guard, which takes the user into the app.
 *
 * Left out for now: "Continue with Apple" (needs a paid Apple developer account, like
 * step 3.7).
 */
export default function SignInScreen() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  async function handleSubmit() {
    const found: FieldErrors = {};
    if (!looksLikeEmail(email)) found.email = "That email address doesn't look right.";
    // No length rule here: accounts made before the 8-character rule must still get in.
    if (!password) found.password = 'Please enter your password.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);

    if (result.error) {
      const { field, message } = describeAuthError(result.errorCode, result.error);
      setErrors({ [field]: message });
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Your voice was waiting." subtitleItalic>
      <View style={styles.fields}>
        <TextField
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
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
      </View>

      <Pressable
        onPress={() =>
          router.push({
            pathname: '/forgot-password',
            params: email.trim() ? { email: email.trim() } : {},
          })
        }
        accessibilityRole="button"
        style={styles.forgot}
      >
        <Text style={styles.forgotText}>Forgot password?</Text>
      </Pressable>

      {errors.form ? (
        <Text accessibilityLiveRegion="polite" style={styles.formError}>
          {errors.form}
        </Text>
      ) : null}

      <Button label="Sign in" onPress={handleSubmit} loading={submitting} style={styles.submit} />
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
  // The mockup's right-aligned caption link, with a 44pt-tall touch area.
  forgot: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: 16,
  },
  forgotText: {
    ...typography.caption,
    fontFamily: fonts.sansSemiBold,
    color: colors.accent,
  },
  submit: {
    marginTop: 20,
  },
});
