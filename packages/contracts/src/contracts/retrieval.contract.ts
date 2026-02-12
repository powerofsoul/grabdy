import { dbIdSchema, nonDbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { canvasEdgeSchema, canvasStateSchema, cardSchema } from '../schemas/canvas.js';

const c = initContract();

const searchResultSchema = z.object({
  chunkId: dbIdSchema('Chunk'),
  content: z.string(),
  score: z.number(),
  metadata: z.record(z.string(), z.unknown()),
  dataSourceName: z.string(),
  dataSourceId: dbIdSchema('DataSource'),
});

const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  sources: z.array(searchResultSchema).nullable(),
  createdAt: z.string(),
});

const threadSchema = z.object({
  id: dbIdSchema('ChatThread'),
  title: z.string().nullable(),
  collectionId: dbIdSchema('Collection').nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const threadWithMessagesSchema = threadSchema.extend({
  messages: z.array(chatMessageSchema),
  canvasState: canvasStateSchema.nullable(),
});

export const retrievalContract = c.router(
  {
    query: {
      method: 'POST',
      path: '/orgs/:orgId/query',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      body: z.object({
        query: z.string().min(1),
        collectionId: dbIdSchema('Collection').optional(),
        limit: z.number().min(1).max(50).default(10),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.object({
            results: z.array(searchResultSchema),
            queryTimeMs: z.number(),
          }),
        }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    chat: {
      method: 'POST',
      path: '/orgs/:orgId/chat',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      body: z.object({
        message: z.string().min(1),
        threadId: dbIdSchema('ChatThread').optional(),
        collectionId: dbIdSchema('Collection').optional(),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.object({
            answer: z.string(),
            threadId: dbIdSchema('ChatThread'),
            sources: z.array(searchResultSchema),
          }),
        }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    createThread: {
      method: 'POST',
      path: '/orgs/:orgId/chat/threads',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      body: z.object({
        title: z.string().optional(),
        collectionId: dbIdSchema('Collection').optional(),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: threadSchema }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    listThreads: {
      method: 'GET',
      path: '/orgs/:orgId/chat/threads',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      responses: {
        200: z.object({ success: z.literal(true), data: z.array(threadSchema) }),
      },
    },
    getThread: {
      method: 'GET',
      path: '/orgs/:orgId/chat/threads/:threadId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: threadWithMessagesSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    deleteThread: {
      method: 'DELETE',
      path: '/orgs/:orgId/chat/threads/:threadId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true) }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    renameThread: {
      method: 'PATCH',
      path: '/orgs/:orgId/chat/threads/:threadId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
      }),
      body: z.object({ title: z.string().min(1) }),
      responses: {
        200: z.object({ success: z.literal(true), data: threadSchema }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    moveCanvasCard: {
      method: 'PATCH',
      path: '/orgs/:orgId/chat/threads/:threadId/canvas/cards/:cardId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
        cardId: nonDbIdSchema('CanvasCard'),
      }),
      body: z.object({
        position: z.object({ x: z.number(), y: z.number() }).optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        title: z.string().optional(),
        zIndex: z.number().optional(),
      }),
      responses: {
        200: z.object({ success: z.literal(true), canvasState: canvasStateSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    deleteCanvasCard: {
      method: 'DELETE',
      path: '/orgs/:orgId/chat/threads/:threadId/canvas/cards/:cardId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
        cardId: nonDbIdSchema('CanvasCard'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true), canvasState: canvasStateSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    updateCanvasEdges: {
      method: 'PUT',
      path: '/orgs/:orgId/chat/threads/:threadId/canvas/edges',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
      }),
      body: z.object({
        edges: z.array(canvasEdgeSchema),
      }),
      responses: {
        200: z.object({ success: z.literal(true), canvasState: canvasStateSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    addCanvasEdge: {
      method: 'POST',
      path: '/orgs/:orgId/chat/threads/:threadId/canvas/edges',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
      }),
      body: z.object({
        edge: canvasEdgeSchema,
      }),
      responses: {
        200: z.object({ success: z.literal(true), canvasState: canvasStateSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    deleteCanvasEdge: {
      method: 'DELETE',
      path: '/orgs/:orgId/chat/threads/:threadId/canvas/edges/:edgeId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
        edgeId: nonDbIdSchema('CanvasEdge'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true), canvasState: canvasStateSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    updateCanvasComponent: {
      method: 'PATCH',
      path: '/orgs/:orgId/chat/threads/:threadId/canvas/cards/:cardId/components/:componentId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
        cardId: nonDbIdSchema('CanvasCard'),
        componentId: nonDbIdSchema('CanvasComponent'),
      }),
      body: z.object({
        data: z.record(z.string(), z.unknown()),
      }),
      responses: {
        200: z.object({ success: z.literal(true), canvasState: canvasStateSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    addCanvasCard: {
      method: 'POST',
      path: '/orgs/:orgId/chat/threads/:threadId/canvas/cards',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
      }),
      body: z.object({
        card: cardSchema,
      }),
      responses: {
        200: z.object({ success: z.literal(true), canvasState: canvasStateSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
  },
  { pathPrefix: '/api' }
);

/**
 * Zod schema for the streaming chat endpoint body.
 * This endpoint uses raw Express SSE (ts-rest doesn't support streaming),
 * so the schema is exported standalone for manual validation.
 */
export const streamChatBodySchema = z.object({
  message: z.string().min(1),
  threadId: dbIdSchema('ChatThread').optional(),
  collectionId: dbIdSchema('Collection').optional(),
});
