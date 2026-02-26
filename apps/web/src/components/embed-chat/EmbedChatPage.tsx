import { useEffect, useRef, useState } from 'react';

import { Box, IconButton, Typography } from '@mui/material';
import { XIcon } from '@phosphor-icons/react';

import { EmbedError } from './components/EmbedError';
import { EmbedLoading } from './components/EmbedLoading';
import { EmbedThemeProvider } from './components/EmbedThemeProvider';
import { EmbedWelcome } from './components/EmbedWelcome';
import { useEmbedAuth } from './hooks/useEmbedAuth';
import { useEmbedStream } from './hooks/useEmbedStream';
import { EmbedProvider } from './context';
import { postToParent } from './types';

import { ChatInput } from '@/components/chat/components/ChatInput';
import { ChatMessages } from '@/components/chat/components/ChatMessages';
import type { ChatMessage } from '@/components/chat/types';

export function EmbedChatPage() {
  const { jwt, config } = useEmbedAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInline = new URLSearchParams(window.location.search).get('mode') === 'inline';

  const { isStreaming, status, handleSend } = useEmbedStream({
    jwt: jwt ?? '',
    setMessages,
  });

  // Notify parent of height changes for auto-resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        postToParent({ type: 'RESIZE', height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Waiting for JWT from parent or loading history
  if (!jwt || status === 'waiting' || status === 'loading') {
    return <EmbedLoading />;
  }

  if (status === 'unauthorized' || status === 'error') {
    return (
      <EmbedThemeProvider style={config}>
        <EmbedError variant={status} />
      </EmbedThemeProvider>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <EmbedProvider value={true}>
      <EmbedThemeProvider style={config}>
        <Box
          ref={containerRef}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100dvh',
            bgcolor: 'background.default',
          }}
        >
          {/* Header: always shown in popup mode, only if logo/title in inline mode */}
          {(!isInline || config?.logoUrl || config?.title) && (
            <Box
              sx={{
                flexShrink: 0,
                px: 1.5,
                py: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                minHeight: 44,
              }}
            >
              {config?.logoUrl && (
                <Box
                  component="img"
                  src={config.logoUrl}
                  alt=""
                  sx={{ height: 22, width: 'auto', objectFit: 'contain', mr: 1 }}
                />
              )}
              {config?.title && (
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {config.title}
                </Typography>
              )}
              <Box sx={{ flex: 1 }} />
              {!isInline && (
                <IconButton
                  size="small"
                  onClick={() => postToParent({ type: 'CLOSE' })}
                  sx={{ color: 'text.secondary' }}
                >
                  <XIcon size={18} weight="bold" />
                </IconButton>
              )}
            </Box>
          )}

          {/* Chat content */}
          {hasMessages ? (
            <ChatMessages
              messages={messages}
              isLoading={false}
              isStreaming={isStreaming}
              embedJwt={jwt ?? undefined}
              accentColor={config?.accentColor ?? undefined}
            />
          ) : (
            <EmbedWelcome message={config?.subtitle ?? undefined} />
          )}

          {/* Input */}
          <ChatInput
            onSend={handleSend}
            isStreaming={isStreaming}
            disabled={!jwt}
            placeholder={config?.placeholder ?? 'Ask a question...'}
            accentColor={config?.accentColor ?? undefined}
          />
        </Box>
      </EmbedThemeProvider>
    </EmbedProvider>
  );
}
