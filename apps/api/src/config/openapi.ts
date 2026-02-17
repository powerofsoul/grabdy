import {
  listCollectionsResponseSchema,
  publicApiErrorSchema,
  queryBodySchema,
  queryResponseSchema,
  searchBodySchema,
  searchResponseSchema,
} from '@grabdy/contracts';
import { z } from 'zod';

function zodSchema(schema: z.ZodType) {
  // dbIdSchema uses .transform() to brand strings, which Zod's JSON Schema
  // converter can't represent. Use `unrepresentable: 'any'` to skip transforms
  // (they emit `{}` which is valid "any" in JSON Schema — fine for UUIDs).
  const { $schema: _, ...rest } = z.toJSONSchema(schema, { unrepresentable: 'any' });
  return rest;
}

export function buildOpenApiDocument() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Grabdy API',
      version: '1.0.0',
      description: [
        'The Grabdy API lets you query your uploaded data with AI-powered search and answer generation.',
        '',
        '## Authentication',
        '',
        'All endpoints require a Bearer token. Create an API key in the dashboard under **API > Keys**.',
        '',
        '```',
        'Authorization: Bearer gbd_your_key_here',
        '```',
      ].join('\n'),
    },
    servers: [
      { url: '/', description: 'Current server' },
    ],
    security: [{ BearerAuth: [] }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'API key with gbd_ prefix. Create one in the dashboard under API > Keys.',
        },
      },
      schemas: {
        SearchBody: zodSchema(searchBodySchema),
        SearchResponse: zodSchema(searchResponseSchema),
        QueryBody: zodSchema(queryBodySchema),
        QueryResponse: zodSchema(queryResponseSchema),
        ListCollectionsResponse: zodSchema(listCollectionsResponseSchema),
        Error: zodSchema(publicApiErrorSchema),
      },
    },
    paths: {
      '/v1/search': {
        post: {
          operationId: 'search',
          summary: 'Search your data',
          description:
            'Searches your uploaded data and returns the most relevant chunks ranked by relevance. ' +
            'No AI generation is used — ideal for building your own answer pipeline or feeding results into your own models.',
          tags: ['Search'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SearchBody' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Search results sorted by relevance',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SearchResponse' },
                },
              },
            },
            '400': {
              description: 'Bad request',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            '401': {
              description: 'Unauthorized — invalid or missing API key',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/v1/query': {
        post: {
          operationId: 'query',
          summary: 'Query your data with AI',
          description:
            'Searches your uploaded data for relevant context and generates an AI answer based on the results. ' +
            'Returns both the answer and the source documents used.',
          tags: ['Query'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/QueryBody' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Successful query with AI-generated answer and sources',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/QueryResponse' },
                },
              },
            },
            '400': {
              description: 'Bad request',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            '401': {
              description: 'Unauthorized — invalid or missing API key',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/v1/collections': {
        get: {
          operationId: 'listCollections',
          summary: 'List collections',
          description: 'Returns all data collections in your organization.',
          tags: ['Collections'],
          responses: {
            '200': {
              description: 'List of collections',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ListCollectionsResponse' },
                },
              },
            },
            '401': {
              description: 'Unauthorized — invalid or missing API key',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Search', description: 'Search your knowledge base for relevant content' },
      { name: 'Query', description: 'AI-powered question answering over your knowledge base' },
      { name: 'Collections', description: 'Manage data collections' },
    ],
  };
}
