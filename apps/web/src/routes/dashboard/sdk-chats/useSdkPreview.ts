import { useCallback, useEffect, useRef } from 'react';

import type { DbId } from '@grabdy/common';

import { api } from '@/lib/api';

export function useSdkPreview(chatId: DbId<'SdkChat'> | undefined, orgId: DbId<'Org'> | undefined) {
  const chatRef = useRef<{ destroy: () => void } | null>(null);

  const fetchToken = useCallback(async (): Promise<string> => {
    if (!orgId || !chatId) throw new Error('Missing org or chat');
    const res = await api.sdkChats.generatePreviewJwt({
      params: { orgId, sdkChatId: chatId },
      body: {},
    });
    if (res.status === 200) {
      return res.body.data.jwt;
    }
    throw new Error('Failed to get preview token');
  }, [orgId, chatId]);

  useEffect(() => {
    if (!chatId || !orgId) return;

    const sdkUrl = import.meta.env.VITE_WEB_URL ?? window.location.origin;

    // Load SDK script and initialize
    const script = document.createElement('script');
    script.src = import.meta.env.DEV
      ? 'http://localhost:3002/sdk.js'
      : 'https://sdk.grabdy.com/sdk.js';
    script.onload = () => {
      if (!window.GrabdyChat) return;

      chatRef.current = new window.GrabdyChat({
        chatId,
        getToken: fetchToken,
        sdkUrl,
        style: {
          welcomeMessage: 'Click here to see the live preview',
        },
      });
    };
    document.head.appendChild(script);

    return () => {
      if (chatRef.current) {
        chatRef.current.destroy();
        chatRef.current = null;
      }
      script.remove();
    };
  }, [chatId, orgId, fetchToken]);
}
