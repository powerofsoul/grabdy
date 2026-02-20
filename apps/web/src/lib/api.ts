import type { CanvasEdge, Card } from '@grabdy/contracts';
import { canvasEdgeSchema, contract } from '@grabdy/contracts';
import { ApiFetcherArgs, initClient } from '@ts-rest/core';
import { z } from 'zod';

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

export const api = initClient(contract, {
  baseUrl,
  baseHeaders: {},
  credentials: 'include',
  api: customFetcher,
});

export type CanvasOpResult =
  | { op: 'add_card'; cards: Card[] }
  | { op: 'remove_card'; cardId: string }
  | {
      op: 'move_card';
      cardId: string;
      position?: { x: number; y: number };
      width?: number;
      height?: number;
    }
  | { op: 'update_component'; cardId: string; componentId: string; data: Record<string, unknown> }
  | { op: 'add_edge'; edge: CanvasEdge }
  | { op: 'remove_edge'; edgeId: string };

export interface CanvasUpdate {
  results: CanvasOpResult[];
}

interface StreamCallbacks {
  onText: (text: string) => void;
  onTextDone?: () => void;
  onDone: (metadata: { threadId?: string; durationMs?: number }) => void;
  onCanvasUpdate?: (update: CanvasUpdate) => void;
  onError?: (error: Error) => void;
}

const textDeltaSchema = z.string();
const metadataEventSchema = z.object({
  type: z.string(),
  threadId: z.string().optional(),
  durationMs: z.number().optional(),
  tool: z.string().optional(),
  args: z.unknown().optional(),
  result: z.unknown().optional(),
});

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function rec(v: unknown): Record<string, unknown> {
  return isRecord(v) ? v : {};
}

function parseOpResult(r: unknown): CanvasOpResult | null {
  if (!isRecord(r)) return null;
  const op = r['op'];
  switch (op) {
    case 'add_card':
      return Array.isArray(r['cards']) ? { op: 'add_card', cards: r['cards'] } : null;
    case 'remove_card':
      return { op: 'remove_card', cardId: String(r['cardId'] ?? '') };
    case 'move_card': {
      const pos = isRecord(r['position'])
        ? { x: Number(r['position']['x']), y: Number(r['position']['y']) }
        : undefined;
      return {
        op: 'move_card',
        cardId: String(r['cardId'] ?? ''),
        position: pos,
        width: typeof r['width'] === 'number' ? r['width'] : undefined,
        height: typeof r['height'] === 'number' ? r['height'] : undefined,
      };
    }
    case 'update_component':
      return {
        op: 'update_component',
        cardId: String(r['cardId'] ?? ''),
        componentId: String(r['componentId'] ?? ''),
        data: rec(r['data']),
      };
    case 'add_edge': {
      const parsed = canvasEdgeSchema.safeParse(r['edge']);
      if (!parsed.success) return null;
      return { op: 'add_edge', edge: parsed.data };
    }
    case 'remove_edge':
      return { op: 'remove_edge', edgeId: String(r['edgeId'] ?? '') };
    default:
      return null;
  }
}

function toCanvasUpdate(tool: string, _args: unknown, result: unknown): CanvasUpdate | null {
  if (tool !== 'canvas_update') return null;
  const r = rec(result);
  const rawResults = Array.isArray(r['results']) ? r['results'] : [];
  const results: CanvasOpResult[] = [];
  for (const item of rawResults) {
    const parsed = parseOpResult(item);
    if (parsed) results.push(parsed);
  }
  return { results };
}

export async function streamChat(
  orgId: string,
  body: { message: string; threadId?: string; collectionId?: string },
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
            const parsed = textDeltaSchema.safeParse(JSON.parse(jsonStr));
            if (parsed.success) callbacks.onText(parsed.data);
          } else if (typeCode === '8') {
            // Metadata event
            const parsed = metadataEventSchema.safeParse(JSON.parse(jsonStr));
            if (!parsed.success) continue;
            const metadata = parsed.data;
            if (metadata.type === 'done') {
              callbacks.onDone({
                threadId: metadata.threadId,
                durationMs: metadata.durationMs,
              });
            } else if (metadata.type === 'text_done') {
              callbacks.onTextDone?.();
            } else if (
              metadata.type === 'canvas_update' &&
              callbacks.onCanvasUpdate &&
              metadata.tool
            ) {
              const update = toCanvasUpdate(metadata.tool, metadata.args, metadata.result);
              if (update) {
                callbacks.onCanvasUpdate(update);
              }
            }
          }
        } catch (e) {
          console.error('[stream] Failed to parse line:', typeCode, e);
          callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
