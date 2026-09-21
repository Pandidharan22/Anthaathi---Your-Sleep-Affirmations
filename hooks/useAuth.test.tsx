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

    const outcome = await act(() => result.current.signUp('alice@example.com', 'hunter22'));

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'hunter22',
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

    const outcome = await act(() => result.current.signUp('alice@example.com', 'hunter22'));

    expect(outcome).toEqual({ error: null, needsEmailConfirmation: true });
  });

  it('signUp surfaces a Supabase error', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: { message: 'User already registered' },
    });
    const { result } = await renderUseAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = await act(() => result.current.signUp('alice@example.com', 'hunter22'));

    expect(outcome).toEqual({ error: 'User already registered' });
  });

  it('signIn calls signInWithPassword and surfaces errors', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });
    const { result } = await renderUseAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = await act(() => result.current.signIn('alice@example.com', 'wrong'));

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'wrong',
    });
    expect(outcome).toEqual({ error: 'Invalid login credentials' });
  });

  it('signOut calls supabase signOut', async () => {
    supabase.auth.signOut.mockResolvedValue({ error: null });
    const { result } = await renderUseAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = await act(() => result.current.signOut());

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(outcome).toEqual({ error: null });
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
