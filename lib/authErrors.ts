/**
 * Turns a Supabase auth failure into calm, specific copy and says which field it belongs
 * under, so the sign-in/sign-up screens can show it where the problem is (the mockups put
 * errors under the field, not in a banner). Keyed by Supabase's stable `error.code`, not
 * its English message.
 */
export type AuthErrorField = 'email' | 'password' | 'form';

export type AuthErrorDisplay = { field: AuthErrorField; message: string };

const GENERIC = 'Something went wrong. Please try again.';

const BY_CODE: Record<string, AuthErrorDisplay> = {
  // Supabase uses one code for both a wrong password and an unknown email, so the copy
  // doesn't claim which one it was (that would also reveal whether an account exists).
  invalid_credentials: {
    field: 'password',
    message: "Email or password doesn't match our records.",
  },
  email_not_confirmed: {
    field: 'form',
    message: 'Please confirm your email first. The link is in your inbox.',
  },
  user_already_exists: {
    field: 'email',
    message: 'An account with this email already exists. Try signing in instead.',
  },
  email_exists: {
    field: 'email',
    message: 'An account with this email already exists. Try signing in instead.',
  },
  email_address_invalid: { field: 'email', message: "That email address doesn't look right." },
  weak_password: { field: 'password', message: 'Please choose a stronger password.' },
  over_email_send_rate_limit: {
    field: 'form',
    message: 'Too many tries for now. Please wait a minute and try again.',
  },
  over_request_rate_limit: {
    field: 'form',
    message: 'Too many tries for now. Please wait a minute and try again.',
  },
};

export function describeAuthError(code: string | undefined, message: string): AuthErrorDisplay {
  if (code && BY_CODE[code]) return BY_CODE[code];
  // No code means the request never got an answer from Supabase (offline, timeout).
  if (!code && /network|fetch/i.test(message)) {
    return {
      field: 'form',
      message: "Can't reach Anthaathi right now. Please check your connection and try again.",
    };
  }
  return { field: 'form', message: GENERIC };
}

/** Sign-up's own rule (the mockup's "At least 8 characters"); sign-in doesn't check it. */
export const MIN_PASSWORD_LENGTH = 8;

/** A light check that catches typos before a round trip; Supabase validates for real. */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
