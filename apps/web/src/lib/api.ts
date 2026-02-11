import { ApiFetcherArgs, initClient } from '@ts-rest/core';

import { contract } from '@grabdy/contracts';

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const DEFAULT_TIMEOUT_MS = 30000;

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error?: string; message?: string; success?: boolean }
  ) {
    super(body.error || body.message || `Request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

const customFetcher = async (args: ApiFetcherArgs) => {
  const { path, method, headers, body } = args;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      method,
      headers,
      credentials: 'include',
      body,
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(response.status, data || {});
    }

    return {
      status: response.status,
      body: data,
      headers: response.headers,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

export const api = initClient(contract, {
  baseUrl,
  baseHeaders: {},
  credentials: 'include',
  api: customFetcher,
});

export { baseUrl };

export interface StreamCallbacks {
  onText: (text: string) => void;
  onDone: (metadata: { threadId?: string; sources?: StreamSource[] }) => void;
  onError?: (error: Error) => void;
}

export interface StreamSource {
  chunkId: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  dataSourceName: string;
  dataSourceId: string;
}

export async function streamChat(
  orgId: string,
  body: { message: string; threadId?: string; collectionId?: string },
  callbacks: StreamCallbacks,
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/orgs/${orgId}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const msg = data?.error ?? `Stream failed with status ${response.status}`;
    callbacks.onError?.(new Error(msg));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.(new Error('No response body'));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;

        // AI SDK v5 data stream protocol: TYPE:JSON_VALUE
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const typeCode = line.slice(0, colonIndex);
        const jsonStr = line.slice(colonIndex + 1);

        try {
          if (typeCode === '0') {
            // Text delta
            const text = JSON.parse(jsonStr) as string;
            callbacks.onText(text);
          } else if (typeCode === '8') {
            // Metadata event
            const metadata = JSON.parse(jsonStr) as {
              type: string;
              threadId?: string;
              sources?: StreamSource[];
            };
            if (metadata.type === 'done') {
              callbacks.onDone({
                threadId: metadata.threadId,
                sources: metadata.sources,
              });
            }
          }
        } catch {
          // skip malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
