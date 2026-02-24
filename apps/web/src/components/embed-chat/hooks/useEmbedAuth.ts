import { useCallback, useEffect, useState } from 'react';

import type { EmbedAuthState } from '../types';
import { parentMessageSchema, postToParent } from '../types';

export function useEmbedAuth(): EmbedAuthState {
  const [state, setState] = useState<EmbedAuthState>({
    jwt: null,
    chatId: null,
    style: undefined,
  });

  const handleMessage = useCallback((event: MessageEvent) => {
    const result = parentMessageSchema.safeParse(event.data);
    if (!result.success) return;

    const data = result.data;
    if (data.type === 'JWT') {
      setState({
        jwt: data.jwt,
        chatId: data.chatId,
        style: data.style,
      });
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

  return state;
}
