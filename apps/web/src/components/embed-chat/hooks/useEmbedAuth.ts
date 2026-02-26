import { useCallback, useEffect, useState } from 'react';

import type { EmbedAuthState } from '../types';
import { parentMessageSchema, postToParent } from '../types';

import { fetchSdkConfig } from '@/lib/api';

export function useEmbedAuth(): EmbedAuthState {
  const [state, setState] = useState<EmbedAuthState>({
    jwt: null,
    chatId: null,
    config: null,
  });

  const handleMessage = useCallback((event: MessageEvent) => {
    const result = parentMessageSchema.safeParse(event.data);
    if (!result.success) return;

    const data = result.data;
    if (data.type === 'JWT') {
      setState((prev) => ({
        ...prev,
        jwt: data.jwt,
        chatId: data.chatId,
      }));
    } else if (data.type === 'UPDATE_JWT') {
      setState((prev) => ({ ...prev, jwt: data.jwt }));
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    postToParent({ type: 'READY' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);

  // Fetch config from API when chatId is available
  useEffect(() => {
    if (!state.chatId) return;

    fetchSdkConfig(state.chatId)
      .then((config) => {
        setState((prev) => ({ ...prev, config }));
      })
      .catch((err) => {
        console.error('[embed-auth] Failed to fetch config:', err);
      });
  }, [state.chatId]);

  return state;
}
