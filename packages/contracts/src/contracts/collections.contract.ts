import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const collectionSchema = z.object({
  id: dbIdSchema('Collection'),
  name: z.string(),
  description: z.string().nullable(),
  orgId: dbIdSchema('Org'),
  sourceCount: z.number(),
  chunkCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const collectionsContract = c.router(
  {
    create: {
      method: 'POST',
      path: '/orgs/:orgId/collections',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      body: z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: collectionSchema }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    list: {
      method: 'GET',
      path: '/orgs/:orgId/collections',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      responses: {
        200: z.object({ success: z.literal(true), data: z.array(collectionSchema) }),
      },
    },
    get: {
      method: 'GET',
      path: '/orgs/:orgId/collections/:collectionId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        collectionId: dbIdSchema('Collection'),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: collectionSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    update: {
      method: 'PATCH',
      path: '/orgs/:orgId/collections/:collectionId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        collectionId: dbIdSchema('Collection'),
      }),
      body: z.object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: collectionSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    delete: {
      method: 'DELETE',
      path: '/orgs/:orgId/collections/:collectionId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        collectionId: dbIdSchema('Collection'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true) }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
  },
  { pathPrefix: '' }
);
