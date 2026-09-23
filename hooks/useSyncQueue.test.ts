import { renderHook } from '@testing-library/react-native';

import { useSyncQueue } from './useSyncQueue';

const mockAddEventListener = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
}));
jest.mock('@/lib/syncQueue', () => ({ processQueue: jest.fn() }));
jest.mock('@/lib/goalImages', () => ({ uploadPendingGoalImages: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { processQueue } = require('@/lib/syncQueue');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { uploadPendingGoalImages } = require('@/lib/goalImages');

beforeEach(() => {
  jest.resetAllMocks();
  processQueue.mockResolvedValue({ processed: 0, remaining: 0 });
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

  it('uploads pending goal images and re-flushes the queue after a full drain', async () => {
    const unsubscribe = jest.fn();
    mockAddEventListener.mockReturnValue(unsubscribe);
    processQueue
      .mockResolvedValueOnce({ processed: 1, remaining: 0 })
      .mockResolvedValueOnce({ processed: 0, remaining: 0 });
    uploadPendingGoalImages.mockResolvedValue(undefined);

    await renderHook(() => useSyncQueue(true));
    const listener = mockAddEventListener.mock.calls[0][0];

    listener({ isConnected: true });
    await new Promise<void>((resolve) => setImmediate(() => resolve()));

    expect(uploadPendingGoalImages).toHaveBeenCalledTimes(1);
    expect(processQueue).toHaveBeenCalledTimes(2);
  });

  it('skips goal image upload when the queue does not fully drain', async () => {
    const unsubscribe = jest.fn();
    mockAddEventListener.mockReturnValue(unsubscribe);
    processQueue.mockResolvedValueOnce({ processed: 1, remaining: 3 });

    await renderHook(() => useSyncQueue(true));
    const listener = mockAddEventListener.mock.calls[0][0];

    listener({ isConnected: true });
    await new Promise<void>((resolve) => setImmediate(() => resolve()));

    expect(uploadPendingGoalImages).not.toHaveBeenCalled();
    expect(processQueue).toHaveBeenCalledTimes(1);
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
