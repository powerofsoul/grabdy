import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { ChatAttachment } from '@grabdy/contracts';
import { toast } from 'sonner';

import { postToParent } from '../types';

import type { ChatMessage } from '@/components/chat/types';
import { fetchSdkHistory, SdkApiError, streamSdkChat, uploadSdkChatAttachment } from '@/lib/api';

interface UseEmbedStreamParams {
  jwt: string;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}

export type EmbedStatus = 'waiting' | 'loading' | 'ready' | 'unauthorized' | 'error';

export function useEmbedStream({ jwt, setMessages }: UseEmbedStreamParams) {
  const [isStreaming, setIsStreaming] = useState(false);
  const isStreamingRef = useRef(false);
  const [status, setStatus] = useState<EmbedStatus>('waiting');
  const threadIdRef = useRef<string | undefined>(undefined);
  const historyLoadedRef = useRef<string | null>(null);

  // Load conversation history on first JWT or when identity changes
  useEffect(() => {
    if (!jwt || historyLoadedRef.current === jwt) return;
    historyLoadedRef.current = jwt;

    setStatus('loading');
    fetchSdkHistory(jwt)
      .then((res) => {
        if (res.data.threadId) {
          threadIdRef.current = res.data.threadId;
        }
        if (res.data.messages.length > 0) {
          setMessages(
            res.data.messages.map((m) => ({
              role: m.role,
              content: m.content,
              attachments: m.attachments ?? undefined,
              thinkingTexts: m.thinkingTexts ?? undefined,
              sources: m.sources ?? undefined,
              durationMs: m.durationMs ?? undefined,
            }))
          );
        }
        setStatus('ready');
      })
      .catch((err) => {
        console.error('[embed-stream] Failed to load history:', err);
        if (err instanceof SdkApiError && (err.status === 401 || err.status === 403)) {
          setStatus('unauthorized');
          postToParent({ type: 'TOKEN_REFRESH' });
        } else {
          setStatus('error');
        }
      });
  }, [jwt, setMessages]);

  const handleSend = useCallback(
    async (userMessage: string, files?: File[]) => {
      if (isStreamingRef.current) return;
      isStreamingRef.current = true;

      let attachments: ChatAttachment[] | undefined;

      // Upload files first if any
      if (files && files.length > 0) {
        try {
          attachments = await Promise.all(files.map((file) => uploadSdkChatAttachment(jwt, file)));
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to upload files');
          isStreamingRef.current = false;
          return;
        }
      }

      setMessages((prev) => [...prev, { role: 'user', content: userMessage, attachments }]);
      setIsStreaming(true);

      let receivedFirstChunk = false;

      const updateLastAssistant = (updater: (msg: ChatMessage) => ChatMessage) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'assistant') {
            updated[updated.length - 1] = updater(last);
          }
          return updated;
        });
      };

      try {
        await streamSdkChat(
          jwt,
          {
            message: userMessage,
            threadId: threadIdRef.current,
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
            onTextDone: () => {
              updateLastAssistant((msg) => ({
                ...msg,
                isStreaming: false,
              }));
            },
            onDone: (metadata) => {
              if (metadata.threadId) {
                threadIdRef.current = metadata.threadId;
              }

              updateLastAssistant((msg) => ({
                ...msg,
                isStreaming: false,
                durationMs: metadata.durationMs,
              }));
            },
            onError: (error) => {
              console.error('[embed-stream]', error);
              const isAuthError =
                error instanceof SdkApiError && (error.status === 401 || error.status === 403);
              if (isAuthError) {
                setStatus('unauthorized');
                postToParent({ type: 'TOKEN_REFRESH' });
              }
              if (!receivedFirstChunk) {
                setMessages((prev) => prev.slice(0, -1));
              }
            },
          }
        );
      } catch (err) {
        console.error('[embed-stream] Error:', err);
      } finally {
        isStreamingRef.current = false;
        setIsStreaming(false);
      }
    },
    [jwt, setMessages]
  );

  return { isStreaming, status, handleSend };
}
