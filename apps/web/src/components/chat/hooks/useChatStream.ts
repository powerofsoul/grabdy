import { type Dispatch, type SetStateAction, useCallback, useState } from 'react';

import { type DbId, dbIdSchema } from '@grabdy/common';
import { toast } from 'sonner';

import type { ChatMessage } from '../types';
import { parseBlocks } from '../parse-blocks';

import { useAuth } from '@/context/AuthContext';
import { type CanvasUpdate, streamChat } from '@/lib/api';

interface UseChatStreamParams {
  ensureThread: () => Promise<DbId<'ChatThread'>>;
  setActiveThreadId: (id: DbId<'ChatThread'> | undefined) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  onCanvasUpdate: (update: CanvasUpdate) => void;
  fetchThreads: () => Promise<void>;
}

export function useChatStream({
  ensureThread,
  setActiveThreadId,
  setMessages,
  onCanvasUpdate,
  fetchThreads,
}: UseChatStreamParams) {
  const { selectedOrgId } = useAuth();

  const [isStreaming, setIsStreaming] = useState(false);

  const handleSend = useCallback(
    async (userMessage: string) => {
      if (!selectedOrgId || isStreaming) return;

      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
      setIsStreaming(true);

      try {
        const threadId = await ensureThread();
        let receivedFirstChunk = false;

        await streamChat(
          selectedOrgId,
          {
            message: userMessage,
            threadId,
          },
          {
            onText: (text) => {
              if (!receivedFirstChunk) {
                receivedFirstChunk = true;
                setMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: text, isStreaming: true },
                ]);
              } else {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + text,
                    };
                  }
                  return updated;
                });
              }
            },
            onCanvasUpdate,
            onDone: (metadata) => {
              if (metadata.threadId) {
                const parsed = dbIdSchema('ChatThread').safeParse(metadata.threadId);
                if (parsed.success) {
                  setActiveThreadId(parsed.data);
                }
              }

              // Parse blocks from accumulated content
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === 'assistant') {
                  const blocks = parseBlocks(last.content);
                  updated[updated.length - 1] = {
                    ...last,
                    content: blocks.text,
                    thinkingTexts:
                      blocks.thinkingTexts.length > 0 ? blocks.thinkingTexts : undefined,
                    sources: blocks.sources.length > 0 ? blocks.sources : undefined,
                    isStreaming: false,
                  };
                }
                return updated;
              });

              fetchThreads();
            },
            onError: (error) => {
              toast.error(error.message);
              if (!receivedFirstChunk) {
                setMessages((prev) => prev.slice(0, -1));
              }
            },
          }
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to send message');
      } finally {
        setIsStreaming(false);
      }
    },
    [
      selectedOrgId,
      isStreaming,
      fetchThreads,
      onCanvasUpdate,
      setActiveThreadId,
      setMessages,
      ensureThread,
    ]
  );

  return {
    isStreaming,
    handleSend,
  };
}
