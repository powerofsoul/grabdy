import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import {
  connectionStatusEnum,
  integrationProviderEnum,
  syncStatusEnum,
  syncTriggerEnum,
} from '../enums/index.js';

const c = initContract();

const connectionSchema = z.object({
  id: dbIdSchema('Connection'),
  provider: integrationProviderEnum,
  status: connectionStatusEnum,
  externalAccountId: z.string().nullable(),
  externalAccountName: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  syncEnabled: z.boolean(),
  syncIntervalMinutes: z.number(),
  config: z.record(z.string(), z.unknown()),
  orgId: dbIdSchema('Org'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const syncLogSchema = z.object({
  id: dbIdSchema('SyncLog'),
  connectionId: dbIdSchema('Connection'),
  status: syncStatusEnum,
  trigger: syncTriggerEnum,
  itemsSynced: z.number(),
  itemsFailed: z.number(),
  errorMessage: z.string().nullable(),
  details: z.object({ items: z.array(z.string()) }).nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
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
        syncEnabled: z.boolean().optional(),
        syncIntervalMinutes: z.number().min(5).max(1440).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: connectionSchema,
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    triggerSync: {
      method: 'POST',
      path: '/orgs/:orgId/integrations/:provider/sync',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        provider: integrationProviderEnum,
      }),
      body: z.object({}),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: syncLogSchema,
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    listSyncLogs: {
      method: 'GET',
      path: '/orgs/:orgId/integrations/:provider/sync-logs',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        provider: integrationProviderEnum,
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.array(syncLogSchema),
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
  },
  { pathPrefix: '/api' }
);
