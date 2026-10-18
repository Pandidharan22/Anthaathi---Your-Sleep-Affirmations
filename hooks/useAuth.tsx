import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { supabase } from '@/lib/supabase';

/**
 * `errorCode` is Supabase's stable error code (e.g. `invalid_credentials`), which
 * screens map to their own copy (lib/authErrors.ts) instead of showing `error` raw.
 */
type AuthResult = {
  error: string | null;
  errorCode?: string;
  needsEmailConfirmation?: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** `name` is stored as `display_name` in the user's metadata (no table needed). */
  signUp: (email: string, password: string, name: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  /**
   * True from the moment a reset code is being checked until the new password is saved.
   * A correct code signs the user in, so the root layout treats the user as signed out
   * while this is true; otherwise they'd jump into the app before choosing a password.
   */
  recovering: boolean;
  /** Emails a reset code. Supabase answers the same whether or not the account exists. */
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  /**
   * Checks the emailed code, then saves the new password. If the code was already
   * accepted on an earlier try (and only saving the password failed), it isn't checked
   * again — a used code can't be reused.
   */
  resetPassword: (email: string, code: string, newPassword: string) => Promise<AuthResult>;
  /** Leaves the reset flow; signs out if the code was already accepted. */
  cancelPasswordReset: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  // Whether this reset attempt's code has been accepted (read only in callbacks).
  const recoveryCodeAccepted = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      async signUp(email, password, name) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name } },
        });
        if (error) return { error: error.message, errorCode: error.code };
        // Supabase returns a user with no session when email confirmation is required.
        return { error: null, needsEmailConfirmation: !data.session };
      },
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message, errorCode: error.code };
        return { error: null };
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();
        return { error: error?.message ?? null };
      },
      recovering,
      async requestPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) return { error: error.message, errorCode: error.code };
        return { error: null };
      },
      async resetPassword(email, code, newPassword) {
        setRecovering(true);
        if (!recoveryCodeAccepted.current) {
          const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
          if (error) {
            setRecovering(false);
            return { error: error.message, errorCode: error.code };
          }
          recoveryCodeAccepted.current = true;
        }
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        // Stay in recovery on failure: the user is signed in but still on the reset screen.
        if (error) return { error: error.message, errorCode: error.code };
        recoveryCodeAccepted.current = false;
        setRecovering(false);
        return { error: null };
      },
      async cancelPasswordReset() {
        if (recoveryCodeAccepted.current) {
          recoveryCodeAccepted.current = false;
          await supabase.auth.signOut();
        }
        setRecovering(false);
      },
    }),
    [session, loading, recovering],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
