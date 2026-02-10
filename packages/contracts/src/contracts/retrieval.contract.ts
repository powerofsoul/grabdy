import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const searchResultSchema = z.object({
  chunkId: dbIdSchema('Chunk'),
  content: z.string(),
  score: z.number(),
  metadata: z.record(z.string(), z.unknown()),
  dataSourceName: z.string(),
  dataSourceId: dbIdSchema('DataSource'),
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
  },
  { pathPrefix: '/api' }
);
