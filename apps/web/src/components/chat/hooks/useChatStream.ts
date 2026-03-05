import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from 'react';

import { type DbId, dbIdSchema } from '@grabdy/common';
import type { ChatAttachment, DataSourceConfig } from '@grabdy/contracts';
import { toast } from 'sonner';

import type { ChatMessage } from '../types';

import { useAuth } from '@/context/AuthContext';
import { streamChat, uploadChatAttachment } from '@/lib/api';

interface UseChatStreamParams {
  ensureThread: () => Promise<DbId<'ChatThread'>>;
  setActiveThreadId: (id: DbId<'ChatThread'> | undefined) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  fetchThreads: () => Promise<void>;
  dataSourceConfig?: DataSourceConfig;
}

export function useChatStream({
  ensureThread,
  setActiveThreadId,
  setMessages,
  fetchThreads,
  dataSourceConfig,
}: UseChatStreamParams) {
  const { selectedOrgId } = useAuth();

  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

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

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const threadId = await ensureThread();
        let receivedFirstChunk = false;

        const updateLastAssistant = (updater: (msg: ChatMessage) => ChatMessage) => {
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = updater(last);
            }
            return updated;
          });
        };

        await streamChat(
          selectedOrgId,
          {
            message: userMessage,
            threadId,
            attachments,
            dataSourceConfig,
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
                updateLastAssistant((msg) => ({
                  ...msg,
                  content: msg.content + text,
                }));
              }
            },
            onThinking: (text) => {
              if (!receivedFirstChunk) {
                receivedFirstChunk = true;
                setMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: '', thinkingTexts: [text], isStreaming: true },
                ]);
              } else {
                updateLastAssistant((msg) => ({
                  ...msg,
                  thinkingTexts: [...(msg.thinkingTexts ?? []), text],
                }));
              }
            },
            onSources: (sources) => {
              updateLastAssistant((msg) => ({
                ...msg,
                sources: [...(msg.sources ?? []), ...sources],
              }));
            },
            onDone: (metadata) => {
              if (metadata.threadId) {
                const parsed = dbIdSchema('ChatThread').safeParse(metadata.threadId);
                if (parsed.success) {
                  setActiveThreadId(parsed.data);
                }
              }

              updateLastAssistant((msg) => ({
                ...msg,
                isStreaming: false,
                durationMs: metadata.durationMs,
              }));

              fetchThreads();
            },
            onError: (error) => {
              toast.error(error.message);
              if (!receivedFirstChunk) {
                setMessages((prev) => prev.slice(0, -1));
              }
            },
          },
          controller.signal
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        toast.error(err instanceof Error ? err.message : 'Failed to send message');
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [
      selectedOrgId,
      isStreaming,
      fetchThreads,
      setActiveThreadId,
      setMessages,
      ensureThread,
      dataSourceConfig,
    ]
  );

  return {
    isStreaming,
    handleSend,
    abort,
  };
}
