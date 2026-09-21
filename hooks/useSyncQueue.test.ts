import { renderHook } from '@testing-library/react-native';

import { useSyncQueue } from './useSyncQueue';

const mockAddEventListener = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
}));
jest.mock('@/lib/syncQueue', () => ({ processQueue: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { processQueue } = require('@/lib/syncQueue');

beforeEach(() => {
  jest.resetAllMocks();
});

describe('useSyncQueue', () => {
  it('does not subscribe to NetInfo when there is no session', async () => {
    await renderHook(() => useSyncQueue(false));

    expect(mockAddEventListener).not.toHaveBeenCalled();
  });

  it('subscribes when a session exists and processes the queue on reconnect', async () => {
    const unsubscribe = jest.fn();
    mockAddEventListener.mockReturnValue(unsubscribe);

    await renderHook(() => useSyncQueue(true));

    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    const listener = mockAddEventListener.mock.calls[0][0];

    listener({ isConnected: true });
    expect(processQueue).toHaveBeenCalledTimes(1);

    // Staying connected shouldn't re-trigger a sync.
    listener({ isConnected: true });
    expect(processQueue).toHaveBeenCalledTimes(1);

    listener({ isConnected: false });
    listener({ isConnected: true });
    expect(processQueue).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes when the session goes away', async () => {
    const unsubscribe = jest.fn();
    mockAddEventListener.mockReturnValue(unsubscribe);

    const { rerender } = await renderHook(
      ({ hasSession }: { hasSession: boolean }) => useSyncQueue(hasSession),
      { initialProps: { hasSession: true } },
    );

    await rerender({ hasSession: false });

    expect(unsubscribe).toHaveBeenCalled();
  });
});
