import { type Dispatch, type SetStateAction, useCallback, useState } from 'react';

import { type DbId, dbIdSchema } from '@grabdy/common';

import { useAuth } from '@/context/AuthContext';
import { type CanvasUpdate, streamChat } from '@/lib/api';
import { toast } from 'sonner';

import type { ChatMessage } from './ChatMessages';

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
  const [isThinking, setIsThinking] = useState(false);

  const handleSend = useCallback(
    async (userMessage: string) => {
      if (!selectedOrgId || isStreaming) return;

      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
      setIsThinking(true);
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
                setIsThinking(false);
                setMessages((prev) => [...prev, { role: 'assistant', content: text }]);
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
              if (metadata.sources) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      sources: metadata.sources?.map((s) => ({
                        content: s.content,
                        score: s.score,
                        dataSourceName: s.dataSourceName,
                      })),
                    };
                  }
                  return updated;
                });
              }
              fetchThreads();
            },
            onError: (error) => {
              toast.error(error.message);
              if (!receivedFirstChunk) {
                setMessages((prev) => prev.slice(0, -1));
              }
            },
          },
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to send message');
      } finally {
        setIsStreaming(false);
        setIsThinking(false);
      }
    },
    [selectedOrgId, isStreaming, fetchThreads, onCanvasUpdate, setActiveThreadId, setMessages, ensureThread],
  );

  return {
    isStreaming,
    isThinking,
    handleSend,
  };
}
