import { useSyncExternalStore } from 'react';

import { getNeuralVoiceStatus, subscribeNeuralVoiceStatus } from '@/lib/neuralVoice';

/** Live install status of the natural (Kokoro) voices, shared across screens. */
export function useNeuralVoiceStatus() {
  return useSyncExternalStore(subscribeNeuralVoiceStatus, getNeuralVoiceStatus);
}
