import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

// ── Shared schemas ──────────────────────────────────────────────

export const publicSourceSchema = z.object({
  content: z.string().describe('The matched text chunk'),
  score: z.number().describe('Relevance score between 0 and 1'),
  dataSource: z.object({
    id: z.string().describe('Data source ID'),
    name: z.string().describe('Data source file name'),
  }),
  metadata: z.record(z.string(), z.unknown()).describe('Chunk metadata (page number, section, etc.)'),
});

export const publicCollectionSchema = z.object({
  id: z.string().describe('Collection ID'),
  name: z.string().describe('Collection name'),
  description: z.string().nullable().describe('Collection description'),
  sourceCount: z.number().describe('Number of data sources in this collection'),
  chunkCount: z.number().describe('Number of indexed chunks'),
  createdAt: z.string().describe('ISO 8601 timestamp'),
  updatedAt: z.string().describe('ISO 8601 timestamp'),
});

export const publicApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string().describe('Machine-readable error code'),
    message: z.string().describe('Human-readable error message'),
  }),
});

// ── Request / Response schemas ──────────────────────────────────

export const searchBodySchema = z.object({
  query: z.string().min(1).describe('The search query'),
  collectionIds: z.array(dbIdSchema('Collection')).optional().describe('Limit search to specific collections'),
  topK: z.number().min(1).max(50).default(10).describe('Number of results to return (default: 10)'),
});

export const searchResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    results: z.array(publicSourceSchema).describe('Matching chunks sorted by relevance'),
    queryTimeMs: z.number().describe('Search duration in milliseconds'),
  }),
});

export const queryBodySchema = z.object({
  query: z.string().min(1).describe('The question or search query'),
  collectionIds: z.array(dbIdSchema('Collection')).optional().describe('Limit search to specific collections'),
  topK: z.number().min(1).max(50).default(10).describe('Number of source chunks to retrieve (default: 10)'),
});

export const queryResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    answer: z.string().describe('AI-generated answer based on the retrieved sources'),
    sources: z.array(publicSourceSchema).describe('Source chunks used to generate the answer'),
    model: z.string().describe('The model used to generate the answer'),
    usage: z.object({
      promptTokens: z.number().describe('Number of input tokens'),
      completionTokens: z.number().describe('Number of output tokens'),
      totalTokens: z.number().describe('Total tokens used'),
    }).describe('Token usage for this request'),
  }),
});

export const listCollectionsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(publicCollectionSchema),
});

// ── Contract ────────────────────────────────────────────────────

export const publicApiContract = c.router(
  {
    search: {
      method: 'POST',
      path: '/v1/search',
      summary: 'Search your data',
      description:
        'Searches your uploaded data and returns the most relevant chunks ranked by relevance. ' +
        'No AI generation is used — ideal for building your own answer pipeline or feeding results into your own models.',
      body: searchBodySchema,
      responses: {
        200: searchResponseSchema,
        400: publicApiErrorSchema,
        401: publicApiErrorSchema,
      },
      metadata: {
        openApiSecurity: [{ BearerAuth: [] }],
      },
    },
    query: {
      method: 'POST',
      path: '/v1/query',
      summary: 'Query your data with AI',
      description:
        'Searches your uploaded data for relevant context and generates an AI answer based on the results. ' +
        'Returns both the answer and the source documents used.',
      body: queryBodySchema,
      responses: {
        200: queryResponseSchema,
        400: publicApiErrorSchema,
        401: publicApiErrorSchema,
      },
      metadata: {
        openApiSecurity: [{ BearerAuth: [] }],
      },
    },
    listCollections: {
      method: 'GET',
      path: '/v1/collections',
      summary: 'List collections',
      description: 'Returns all data collections in your organization.',
      responses: {
        200: listCollectionsResponseSchema,
        401: publicApiErrorSchema,
      },
      metadata: {
        openApiSecurity: [{ BearerAuth: [] }],
      },
    },
  },
  { pathPrefix: '/api' }
);
