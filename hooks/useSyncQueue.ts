import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';

import { processQueue } from '@/lib/syncQueue';

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
        processQueue();
      }
      wasConnected.current = isConnected;
    });

    return unsubscribe;
  }, [hasSession]);
}
