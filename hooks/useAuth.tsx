import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
