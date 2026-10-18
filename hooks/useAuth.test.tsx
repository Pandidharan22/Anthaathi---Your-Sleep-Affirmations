import type { Session } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { AuthProvider, useAuth } from './useAuth';

const mockSession = {
  user: { id: 'user-1', email: 'alice@example.com' },
} as Session;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      verifyOtp: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabase } = require('@/lib/supabase');

function renderUseAuth() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider });
}

beforeEach(() => {
  jest.resetAllMocks();
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  supabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  });
});

describe('useAuth', () => {
  it('starts loading, then resolves the initial session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });

    const { result } = await renderUseAuth();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.session).toBe(mockSession);
    expect(result.current.user).toBe(mockSession.user);
  });

  it('resolves to no session when getSession returns none', async () => {
    const { result } = await renderUseAuth();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('signUp with an immediate session reports no confirmation needed', async () => {
    supabase.auth.signUp.mockResolvedValue({ data: { session: mockSession }, error: null });
    const { result } = await renderUseAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = await act(() =>
      result.current.signUp('alice@example.com', 'hunter22', 'Alice'),
    );

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'hunter22',
      options: { data: { display_name: 'Alice' } },
    });
    expect(outcome).toEqual({ error: null, needsEmailConfirmation: false });
  });

  it('signUp with no session (email confirmation required) reports that', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { session: null, user: { id: 'user-1' } },
      error: null,
    });
    const { result } = await renderUseAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = await act(() =>
      result.current.signUp('alice@example.com', 'hunter22', 'Alice'),
    );

    expect(outcome).toEqual({ error: null, needsEmailConfirmation: true });
  });

  it('signUp surfaces a Supabase error', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: { message: 'User already registered', code: 'user_already_exists' },
    });
    const { result } = await renderUseAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = await act(() =>
      result.current.signUp('alice@example.com', 'hunter22', 'Alice'),
    );

    expect(outcome).toEqual({ error: 'User already registered', errorCode: 'user_already_exists' });
  });

  it('signIn calls signInWithPassword and surfaces errors', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
    });
    const { result } = await renderUseAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = await act(() => result.current.signIn('alice@example.com', 'wrong'));

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'wrong',
    });
    expect(outcome).toEqual({
      error: 'Invalid login credentials',
      errorCode: 'invalid_credentials',
    });
  });

  it('signOut calls supabase signOut', async () => {
    supabase.auth.signOut.mockResolvedValue({ error: null });
    const { result } = await renderUseAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = await act(() => result.current.signOut());

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(outcome).toEqual({ error: null });
  });

  describe('password reset', () => {
    async function ready() {
      const rendered = await renderUseAuth();
      await waitFor(() => expect(rendered.result.current.loading).toBe(false));
      return rendered;
    }

    it('requests a reset code for the email', async () => {
      supabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
      const { result } = await ready();

      const outcome = await act(() => result.current.requestPasswordReset('alice@example.com'));

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('alice@example.com');
      expect(outcome).toEqual({ error: null });
    });

    it('checks the code, saves the password, and ends recovery', async () => {
      supabase.auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
      supabase.auth.updateUser.mockResolvedValue({ data: {}, error: null });
      const { result } = await ready();

      const outcome = await act(() =>
        result.current.resetPassword('alice@example.com', '123456', 'new-password'),
      );

      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'alice@example.com',
        token: '123456',
        type: 'recovery',
      });
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
      expect(outcome).toEqual({ error: null });
      expect(result.current.recovering).toBe(false);
    });

    it('a wrong code ends recovery and never touches the password', async () => {
      supabase.auth.verifyOtp.mockResolvedValue({
        data: {},
        error: { message: 'Token has expired or is invalid', code: 'otp_expired' },
      });
      const { result } = await ready();

      const outcome = await act(() =>
        result.current.resetPassword('alice@example.com', '000000', 'new-password'),
      );

      expect(outcome).toEqual({
        error: 'Token has expired or is invalid',
        errorCode: 'otp_expired',
      });
      expect(supabase.auth.updateUser).not.toHaveBeenCalled();
      expect(result.current.recovering).toBe(false);
    });

    it('stays in recovery when saving fails, and a retry skips the used code', async () => {
      supabase.auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
      supabase.auth.updateUser
        .mockResolvedValueOnce({
          data: {},
          error: { message: 'New password should be different', code: 'same_password' },
        })
        .mockResolvedValueOnce({ data: {}, error: null });
      const { result } = await ready();

      const first = await act(() =>
        result.current.resetPassword('alice@example.com', '123456', 'old-password'),
      );
      expect(first.errorCode).toBe('same_password');
      expect(result.current.recovering).toBe(true);

      const second = await act(() =>
        result.current.resetPassword('alice@example.com', '123456', 'new-password'),
      );
      expect(second).toEqual({ error: null });
      expect(supabase.auth.verifyOtp).toHaveBeenCalledTimes(1);
      expect(result.current.recovering).toBe(false);
    });

    it('cancelling after the code was accepted signs out', async () => {
      supabase.auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
      supabase.auth.updateUser.mockResolvedValue({
        data: {},
        error: { message: 'weak', code: 'weak_password' },
      });
      supabase.auth.signOut.mockResolvedValue({ error: null });
      const { result } = await ready();
      await act(() => result.current.resetPassword('alice@example.com', '123456', 'short'));

      await act(() => result.current.cancelPasswordReset());

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.current.recovering).toBe(false);
    });

    it('cancelling before any code was accepted does not sign out', async () => {
      const { result } = await ready();

      await act(() => result.current.cancelPasswordReset());

      expect(supabase.auth.signOut).not.toHaveBeenCalled();
    });
  });

  it('throws when useAuth is used outside an AuthProvider', async () => {
    const { result } = await renderHook(() => {
      try {
        return useAuth();
      } catch (error) {
        return error;
      }
    });

    expect(result.current).toBeInstanceOf(Error);
  });
});
