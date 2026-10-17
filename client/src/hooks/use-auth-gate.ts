import { useEffect, useState } from 'react';
import { ApiError, api } from '../lib/api';

export type AuthGateState = 'checking' | 'authenticated' | 'verification-required' | 'signed-out' | 'unavailable';

export function useAuthGate() {
  const [state, setState] = useState<AuthGateState>('checking');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    api.getMe(controller.signal)
      .then(() => {
        if (active) setState('authenticated');
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
         if (error instanceof ApiError && error.code === 'EMAIL_VERIFICATION_REQUIRED') setState('verification-required');
         else setState(error instanceof ApiError && error.status === 401 ? 'signed-out' : 'unavailable');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [retryKey]);

  return { state, retry: () => setRetryKey((key) => key + 1) };
}
