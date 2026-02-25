import { type Dispatch, type SetStateAction, useCallback, useState } from 'react';

import { type DbId, dbIdSchema } from '@grabdy/common';
import type { ChatAttachment } from '@grabdy/contracts';
import { toast } from 'sonner';

import { parseBlocks } from '../parse-blocks';
import type { ChatMessage } from '../types';

import { useAuth } from '@/context/AuthContext';
import { streamChat, uploadChatAttachment } from '@/lib/api';

interface UseChatStreamParams {
  ensureThread: () => Promise<DbId<'ChatThread'>>;
  setActiveThreadId: (id: DbId<'ChatThread'> | undefined) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  fetchThreads: () => Promise<void>;
}

export function useChatStream({
  ensureThread,
  setActiveThreadId,
  setMessages,
  fetchThreads,
}: UseChatStreamParams) {
  const { selectedOrgId } = useAuth();

  const [isStreaming, setIsStreaming] = useState(false);

  const handleSend = useCallback(
    async (userMessage: string, files?: File[]) => {
      if (!selectedOrgId || isStreaming) return;

      let attachments: ChatAttachment[] | undefined;

      // Upload files first if any
      if (files && files.length > 0) {
        try {
          attachments = await Promise.all(
            files.map((file) => uploadChatAttachment(selectedOrgId, file))
          );
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to upload files');
          return;
        }
      }

      setMessages((prev) => [...prev, { role: 'user', content: userMessage, attachments }]);
      setIsStreaming(true);

      try {
        const threadId = await ensureThread();
        let receivedFirstChunk = false;

        await streamChat(
          selectedOrgId,
          {
            message: userMessage,
            threadId,
            attachments,
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
            onDone: (metadata) => {
              if (metadata.threadId) {
                const parsed = dbIdSchema('ChatThread').safeParse(metadata.threadId);
                if (parsed.success) {
                  setActiveThreadId(parsed.data);
                }
              }

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
                    durationMs: metadata.durationMs,
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
    [selectedOrgId, isStreaming, fetchThreads, setActiveThreadId, setMessages, ensureThread]
  );

  return {
    isStreaming,
    handleSend,
  };
}
