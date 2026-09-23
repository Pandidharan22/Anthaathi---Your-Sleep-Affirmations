import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';

import { uploadPendingGoalImages } from '@/lib/goalImages';
import { processQueue } from '@/lib/syncQueue';

/**
 * Drains the queue, then — only if it fully drained — uploads any pending
 * goal images and flushes the image_path updates that upload enqueues.
 * Skipped when the queue didn't fully drain: a goal image_path update can't
 * sync before that goal's own create has, and if the queue stalled, it hasn't.
 */
async function syncAll(): Promise<void> {
  const { remaining } = await processQueue();
  if (remaining === 0) {
    await uploadPendingGoalImages();
    await processQueue();
  }
}

/** While a session exists, drains the local sync queue whenever connectivity is (re)gained. */
export function useSyncQueue(hasSession: boolean) {
  const wasConnected = useRef(false);

  useEffect(() => {
    if (!hasSession) {
      wasConnected.current = false;
      return;
    }

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = !!state.isConnected;
      if (isConnected && !wasConnected.current) {
        syncAll();
      }
      wasConnected.current = isConnected;
    });

    return unsubscribe;
  }, [hasSession]);
}
