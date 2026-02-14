import { useEffect, useRef } from 'react';

import { Box, CircularProgress } from '@mui/material';

import type { ThinkingStep } from './MessageRow';
import { ChatMessage, MessageRow } from './MessageRow';
import { ThinkingSteps } from './ThinkingSteps';

import 'katex/dist/katex.min.css';

export type { ChatMessage };

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  thinkingSteps: ThinkingStep[];
}

export function ChatMessages({
  messages,
  isLoading,
  isStreaming,
  thinkingSteps,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const scrollToBottom = (smooth = false) => {
    const container = containerRef.current;
    if (!container || !shouldAutoScrollRef.current) return;
    if (smooth) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  };

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const threshold = 100;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    shouldAutoScrollRef.current = isNearBottom;
  };

  // Auto-scroll on new messages or thinking state changes
  useEffect(() => {
    const timer = setTimeout(() => scrollToBottom(false), 50);
    return () => clearTimeout(timer);
  }, [messages.length, thinkingSteps.length]);

  // ResizeObserver for async content (images, code blocks expanding)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const resizeObserver = new ResizeObserver(() => {
      if (shouldAutoScrollRef.current) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => scrollToBottom(false), 50);
      }
    });

    const contentWrapper = container.firstElementChild;
    if (contentWrapper) resizeObserver.observe(contentWrapper);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [messages.length]);

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        py={4}
        sx={{ flex: 1 }}
      >
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        p: 2,
      }}
    >
      <Box sx={{ maxWidth: 768, mx: 'auto', width: '100%' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {messages.map((message, index) => {
            const isLastAssistant =
              message.role === 'assistant' && index === messages.length - 1;
            const showLiveThinking = isStreaming && isLastAssistant;

            return (
              <Box key={message.id ?? index}>
                {showLiveThinking && (
                  <Box sx={{ mb: 0.75 }}>
                    <ThinkingSteps steps={thinkingSteps} live />
                  </Box>
                )}
                <MessageRow message={message} />
              </Box>
            );
          })}
          {isStreaming && messages.length > 0 && messages[messages.length - 1].role !== 'assistant' && (
            <ThinkingSteps steps={thinkingSteps} live />
          )}
        </Box>
      </Box>
    </Box>
  );
}
