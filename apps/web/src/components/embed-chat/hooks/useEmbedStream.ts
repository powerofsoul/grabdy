import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { postToParent } from '../types';

import { parseBlocks } from '@/components/chat/parse-blocks';
import type { ChatMessage } from '@/components/chat/types';
import { fetchSdkHistory, SdkApiError, streamSdkChat } from '@/lib/api';

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
            res.data.messages.map((m) => {
              if (m.role === 'assistant') {
                const blocks = parseBlocks(m.content);
                return {
                  role: 'assistant',
                  content: blocks.text,
                  thinkingTexts: blocks.thinkingTexts.length > 0 ? blocks.thinkingTexts : undefined,
                  sources: blocks.sources.length > 0 ? blocks.sources : undefined,
                };
              }
              return { role: 'user', content: m.content };
            })
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
    async (userMessage: string) => {
      if (isStreamingRef.current) return;
      isStreamingRef.current = true;

      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
      setIsStreaming(true);

      let receivedFirstChunk = false;

      try {
        await streamSdkChat(
          jwt,
          {
            message: userMessage,
            threadId: threadIdRef.current,
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
            onTextDone: () => {
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
            },
            onDone: (metadata) => {
              if (metadata.threadId) {
                threadIdRef.current = metadata.threadId;
              }

              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === 'assistant') {
                  const alreadyParsed = Boolean(last.sources ?? last.thinkingTexts);
                  const blocks = alreadyParsed ? null : parseBlocks(last.content);
                  updated[updated.length - 1] = {
                    ...last,
                    content: blocks ? blocks.text : last.content,
                    thinkingTexts:
                      last.thinkingTexts ??
                      (blocks && blocks.thinkingTexts.length > 0
                        ? blocks.thinkingTexts
                        : undefined),
                    sources:
                      last.sources ??
                      (blocks && blocks.sources.length > 0 ? blocks.sources : undefined),
                    isStreaming: false,
                    durationMs: metadata.durationMs,
                  };
                }
                return updated;
              });
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
