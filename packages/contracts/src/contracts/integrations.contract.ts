import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import {
  connectionStatusEnum,
  integrationProviderEnum,
} from '../enums/index.js';

const c = initContract();

const slackProviderDataSchema = z.object({
  provider: z.literal('SLACK'),
  slackBotUserId: z.string().optional(),
  teamDomain: z.string().optional(),
  channelTimestamps: z.record(z.string(), z.string()),
});

const linearProviderDataSchema = z.object({
  provider: z.literal('LINEAR'),
  workspaceSlug: z.string().optional(),
  lastIssueSyncedAt: z.string().nullable(),
});

const providerDataSchema = z.discriminatedUnion('provider', [
  slackProviderDataSchema,
  linearProviderDataSchema,
]);

const partialProviderDataSchema = z.union([
  slackProviderDataSchema.partial(),
  linearProviderDataSchema.partial(),
]);

const connectionSchema = z.object({
  id: dbIdSchema('Connection'),
  provider: integrationProviderEnum,
  status: connectionStatusEnum,
  externalAccountId: z.string().nullable(),
  externalAccountName: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  syncScheduleLabel: z.string().nullable(),
  providerData: providerDataSchema,
  orgId: dbIdSchema('Org'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const integrationsContract = c.router(
  {
    listConnections: {
      method: 'GET',
      path: '/orgs/:orgId/integrations/connections',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.array(connectionSchema),
        }),
      },
    },
    connect: {
      method: 'GET',
      path: '/orgs/:orgId/integrations/:provider/connect',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        provider: integrationProviderEnum,
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.object({ redirectUrl: z.string() }),
        }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    disconnect: {
      method: 'POST',
      path: '/orgs/:orgId/integrations/:provider/disconnect',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        provider: integrationProviderEnum,
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true) }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    deleteConnection: {
      method: 'DELETE',
      path: '/orgs/:orgId/integrations/:provider',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        provider: integrationProviderEnum,
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true) }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    updateConfig: {
      method: 'PATCH',
      path: '/orgs/:orgId/integrations/:provider/config',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        provider: integrationProviderEnum,
      }),
      body: z.object({
        config: partialProviderDataSchema.optional(),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: connectionSchema,
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
  },
  { pathPrefix: '' }
);
