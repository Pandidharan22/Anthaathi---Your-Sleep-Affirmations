import { renderHook } from '@testing-library/react-native';

import { useSignOutReplay } from './useSignOutReplay';

async function setup(initial: string | null) {
  return renderHook(({ userId }: { userId: string | null }) => useSignOutReplay(userId), {
    initialProps: { userId: initial },
  });
}

describe('useSignOutReplay', () => {
  it('does not count the session arriving at launch', async () => {
    const { result, rerender } = await setup(null);

    await rerender({ userId: 'user-1' });

    expect(result.current).toBe(0);
  });

  it('counts a sign-out', async () => {
    const { result, rerender } = await setup('user-1');

    await rerender({ userId: null });

    expect(result.current).toBe(1);
  });

  it('does not count a sign-in, and counts each later sign-out', async () => {
    const { result, rerender } = await setup('user-1');

    await rerender({ userId: null });
    await rerender({ userId: 'user-2' });
    expect(result.current).toBe(1);

    await rerender({ userId: null });
    expect(result.current).toBe(2);
  });
});
