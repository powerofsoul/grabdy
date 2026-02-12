import { ApiFetcherArgs, initClient } from '@ts-rest/core';

import { nonDbIdSchema } from '@grabdy/common';
import type { CanvasEdge, Card } from '@grabdy/contracts';
import { contract } from '@grabdy/contracts';

const cardIdSchema = nonDbIdSchema('CanvasCard');
const edgeIdSchema = nonDbIdSchema('CanvasEdge');

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

export type CanvasUpdate =
  | { tool: 'canvas_add_card'; args: { cards: unknown[] }; result: { cards?: Card[] } }
  | { tool: 'canvas_remove_card'; args: { cardId: string }; result: unknown }
  | { tool: 'canvas_move_card'; args: { cardId: string; position?: { x: number; y: number }; width?: number; height?: number }; result: unknown }
  | { tool: 'canvas_update_component'; args: { cardId: string; componentId: string; data: Record<string, unknown> }; result: unknown }
  | { tool: 'canvas_add_edge'; args: { edge: CanvasEdge }; result: unknown }
  | { tool: 'canvas_remove_edge'; args: { edgeId: string }; result: unknown };

interface StreamCallbacks {
  onText: (text: string) => void;
  onDone: (metadata: { threadId?: string; sources?: StreamSource[] }) => void;
  onCanvasUpdate?: (update: CanvasUpdate) => void;
  onError?: (error: Error) => void;
}

interface StreamSource {
  chunkId: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  dataSourceName: string;
  dataSourceId: string;
}

const CANVAS_TOOL_NAMES = new Set([
  'canvas_add_card',
  'canvas_remove_card',
  'canvas_move_card',
  'canvas_update_component',
  'canvas_add_edge',
  'canvas_remove_edge',
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function rec(v: unknown): Record<string, unknown> {
  return isRecord(v) ? v : {};
}

function toCanvasUpdate(tool: string, args: unknown, result: unknown): CanvasUpdate | null {
  if (!CANVAS_TOOL_NAMES.has(tool)) return null;
  const a = rec(args);
  switch (tool) {
    case 'canvas_add_card': {
      const r = rec(result);
      return {
        tool: 'canvas_add_card',
        args: { cards: Array.isArray(a['cards']) ? a['cards'] : [] },
        result: { cards: Array.isArray(r['cards']) ? r['cards'] : undefined },
      };
    }
    case 'canvas_remove_card':
      return { tool: 'canvas_remove_card', args: { cardId: String(a['cardId'] ?? '') }, result };
    case 'canvas_move_card': {
      const pos = rec(a['position']);
      return {
        tool: 'canvas_move_card',
        args: {
          cardId: String(a['cardId'] ?? ''),
          position: a['position'] ? { x: Number(pos['x']), y: Number(pos['y']) } : undefined,
          width: typeof a['width'] === 'number' ? a['width'] : undefined,
          height: typeof a['height'] === 'number' ? a['height'] : undefined,
        },
        result,
      };
    }
    case 'canvas_update_component':
      return {
        tool: 'canvas_update_component',
        args: {
          cardId: String(a['cardId'] ?? ''),
          componentId: String(a['componentId'] ?? ''),
          data: rec(a['data']),
        },
        result,
      };
    case 'canvas_add_edge': {
      const e = rec(a['edge']);
      const id = edgeIdSchema.safeParse(String(e['id'] ?? ''));
      const source = cardIdSchema.safeParse(String(e['source'] ?? ''));
      const target = cardIdSchema.safeParse(String(e['target'] ?? ''));
      if (!id.success || !source.success || !target.success) return null;
      return {
        tool: 'canvas_add_edge',
        args: {
          edge: {
            id: id.data,
            source: source.data,
            target: target.data,
            label: typeof e['label'] === 'string' ? e['label'] : undefined,
            strokeWidth: typeof e['strokeWidth'] === 'number' ? e['strokeWidth'] : 2,
          },
        },
        result,
      };
    }
    case 'canvas_remove_edge':
      return { tool: 'canvas_remove_edge', args: { edgeId: String(a['edgeId'] ?? '') }, result };
    default:
      return null;
  }
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
              tool?: string;
              args?: unknown;
              result?: unknown;
            };
            if (metadata.type === 'done') {
              callbacks.onDone({
                threadId: metadata.threadId,
                sources: metadata.sources,
              });
            } else if (metadata.type === 'canvas_update' && callbacks.onCanvasUpdate && metadata.tool) {
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
