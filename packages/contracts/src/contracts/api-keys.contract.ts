import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const apiKeySchema = z.object({
  id: dbIdSchema('ApiKey'),
  name: z.string(),
  keyPrefix: z.string(),
  lastUsedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});

const apiKeyWithSecretSchema = apiKeySchema.extend({
  key: z.string(),
});

export const apiKeysContract = c.router(
  {
    create: {
      method: 'POST',
      path: '/orgs/:orgId/api-keys',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      body: z.object({ name: z.string().min(1) }),
      responses: {
        200: z.object({ success: z.literal(true), data: apiKeyWithSecretSchema }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    list: {
      method: 'GET',
      path: '/orgs/:orgId/api-keys',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      query: z.object({
        includeRevoked: z.coerce.boolean().optional().default(false),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: z.array(apiKeySchema) }),
      },
    },
    revoke: {
      method: 'DELETE',
      path: '/orgs/:orgId/api-keys/:keyId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        keyId: dbIdSchema('ApiKey'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true) }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
  },
  { pathPrefix: '/api' }
);
