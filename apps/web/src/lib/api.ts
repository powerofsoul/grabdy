import {
  type ChatAttachment,
  chatAttachmentSchema,
  chatSourceSchema,
  contract,
} from '@grabdy/contracts';
import { ApiFetcherArgs, initClient } from '@ts-rest/core';
import { z } from 'zod';

export const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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

const UPLOAD_TIMEOUT_MS = 300000;

export function uploadDataSource(
  orgId: string,
  file: File,
  collectionId: string,
  onProgress: (pct: number) => void
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${baseUrl}/orgs/${orgId}/data-sources/upload`);
    xhr.withCredentials = true;
    xhr.timeout = UPLOAD_TIMEOUT_MS;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ status: xhr.status, body: data });
      } else {
        reject(new ApiError(xhr.status, data));
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));

    const formData = new FormData();
    formData.append('file', file);
    formData.append('collectionId', collectionId);
    xhr.send(formData);
  });
}

export async function uploadChatAttachment(orgId: string, file: File): Promise<ChatAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${baseUrl}/orgs/${orgId}/chat/attachments`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data || {});
  }
  const json: unknown = await response.json();
  const parsed = z.object({ success: z.literal(true), data: chatAttachmentSchema }).parse(json);
  return parsed.data;
}

export async function uploadSdkChatAttachment(jwt: string, file: File): Promise<ChatAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${baseUrl}/sdk/chat/attachments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: formData,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new SdkApiError(
      data?.error ?? `Upload failed with status ${response.status}`,
      response.status
    );
  }
  const json: unknown = await response.json();
  const parsed = z.object({ success: z.literal(true), data: chatAttachmentSchema }).parse(json);
  return parsed.data;
}

export async function getChatAttachmentUrl(orgId: string, storageKey: string): Promise<string> {
  const response = await fetch(
    `${baseUrl}/orgs/${orgId}/chat/attachments/url?storageKey=${encodeURIComponent(storageKey)}`,
    { credentials: 'include' }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data || {});
  }
  const json: unknown = await response.json();
  const parsed = z
    .object({ success: z.literal(true), data: z.object({ url: z.string() }) })
    .parse(json);
  return parsed.data.url;
}

export async function getSdkChatAttachmentUrl(jwt: string, storageKey: string): Promise<string> {
  const response = await fetch(
    `${baseUrl}/sdk/chat/attachments/url?storageKey=${encodeURIComponent(storageKey)}`,
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new SdkApiError(data?.error ?? `Failed to get URL: ${response.status}`, response.status);
  }
  const json: unknown = await response.json();
  const parsed = z
    .object({ success: z.literal(true), data: z.object({ url: z.string() }) })
    .parse(json);
  return parsed.data.url;
}

export const api = initClient(contract, {
  baseUrl,
  baseHeaders: {},
  credentials: 'include',
  api: customFetcher,
});

export interface StreamCallbacks {
  onText: (text: string) => void;
  onThinking?: (text: string) => void;
  onSources?: (sources: unknown[]) => void;
  onTextDone?: () => void;
  onDone: (metadata: { threadId?: string; durationMs?: number }) => void;
  onError?: (error: Error) => void;
}

const textDeltaSchema = z.string();
const metadataEventSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
  sources: z.array(z.unknown()).optional(),
  threadId: z.string().optional(),
  durationMs: z.number().optional(),
});

function parseStreamLine(line: string, callbacks: StreamCallbacks): void {
  if (!line.trim()) return;

  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return;

  const typeCode = line.slice(0, colonIndex);
  const jsonStr = line.slice(colonIndex + 1);

  try {
    if (typeCode === '0') {
      const parsed = textDeltaSchema.safeParse(JSON.parse(jsonStr));
      if (parsed.success) callbacks.onText(parsed.data);
    } else if (typeCode === '8') {
      const parsed = metadataEventSchema.safeParse(JSON.parse(jsonStr));
      if (!parsed.success) return;
      const metadata = parsed.data;
      if (metadata.type === 'done') {
        callbacks.onDone({
          threadId: metadata.threadId,
          durationMs: metadata.durationMs,
        });
      } else if (metadata.type === 'text_done') {
        callbacks.onTextDone?.();
      } else if (metadata.type === 'thinking' && metadata.text) {
        callbacks.onThinking?.(metadata.text);
      } else if (metadata.type === 'sources' && metadata.sources) {
        callbacks.onSources?.(metadata.sources);
      }
    }
  } catch (e) {
    console.error('[stream] Failed to parse line:', typeCode, e);
    callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
  }
}

async function readStream(response: Response, callbacks: StreamCallbacks): Promise<void> {
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
        parseStreamLine(line, callbacks);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function streamChat(
  orgId: string,
  body: {
    message: string;
    threadId?: string;
    collectionId?: string;
    botId?: string;
    attachments?: ChatAttachment[];
  },
  callbacks: StreamCallbacks
): Promise<void> {
  const response = await fetch(`${baseUrl}/orgs/${orgId}/chat/stream`, {
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

  await readStream(response, callbacks);
}

const sdkHistoryResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    messages: z.array(
      z.object({
        id: z.string(),
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        createdAt: z.string().nullable(),
        sources: z.array(chatSourceSchema).nullable().optional(),
        thinkingTexts: z.array(z.string()).nullable().optional(),
        durationMs: z.number().nullable().optional(),
        attachments: z.array(chatAttachmentSchema).nullable().optional(),
      })
    ),
    threadId: z.string().nullable(),
  }),
});

export type SdkHistoryResponse = z.infer<typeof sdkHistoryResponseSchema>;

export class SdkApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'SdkApiError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface SdkChatConfig {
  title: string | null;
  subtitle: string | null;
  placeholder: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
}

const sdkConfigResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    title: z.string().nullable(),
    subtitle: z.string().nullable(),
    placeholder: z.string().nullable(),
    primaryColor: z.string().nullable(),
    accentColor: z.string().nullable(),
    logoUrl: z.string().nullable(),
  }),
});

// Note: uses raw fetch because this is a public endpoint called from the SDK iframe context without cookies or ts-rest client
export async function fetchSdkConfig(chatId: string): Promise<SdkChatConfig> {
  const response = await fetch(`${baseUrl}/sdk/chat/${encodeURIComponent(chatId)}/config`);
  if (!response.ok) {
    throw new SdkApiError(`Failed to fetch config: ${response.status}`, response.status);
  }
  const json: unknown = await response.json();
  const parsed = sdkConfigResponseSchema.parse(json);
  return parsed.data;
}

// Note: uses raw fetch because SDK endpoints use Bearer JWT auth, not cookie-based ts-rest client
export async function fetchSdkHistory(jwt: string): Promise<SdkHistoryResponse> {
  const response = await fetch(`${baseUrl}/sdk/chat/history`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!response.ok) {
    throw new SdkApiError(`Failed to fetch history: ${response.status}`, response.status);
  }
  const json: unknown = await response.json();
  return sdkHistoryResponseSchema.parse(json);
}

// Note: uses raw fetch because SDK endpoints use Bearer JWT auth, not cookie-based ts-rest client
export async function streamSdkChat(
  jwt: string,
  body: { message: string; threadId?: string; attachments?: ChatAttachment[] },
  callbacks: StreamCallbacks
): Promise<void> {
  const response = await fetch(`${baseUrl}/sdk/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const msg = data?.error ?? `Stream failed with status ${response.status}`;
    callbacks.onError?.(new SdkApiError(msg, response.status));
    return;
  }

  await readStream(response, callbacks);
}
