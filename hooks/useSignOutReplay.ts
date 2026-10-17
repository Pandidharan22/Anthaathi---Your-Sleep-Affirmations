import { useState } from 'react';

/**
 * A counter that goes up each time a signed-in user becomes signed out (sign out, or
 * account deletion, which signs out). Used as the splash's `key` so it plays again
 * before Welcome, as it does on a cold start.
 *
 * The first session arriving at launch (null → user) doesn't count, nor does a sign-in.
 * Tracks the previous user id with the "adjust state during render" pattern rather
 * than a ref or an effect, so the replay starts in the same render as the sign-out.
 */
export function useSignOutReplay(userId: string | null): number {
  const [previousUserId, setPreviousUserId] = useState(userId);
  const [count, setCount] = useState(0);

  if (userId !== previousUserId) {
    setPreviousUserId(userId);
    if (previousUserId !== null && userId === null) setCount((c) => c + 1);
  }

  return count;
}
