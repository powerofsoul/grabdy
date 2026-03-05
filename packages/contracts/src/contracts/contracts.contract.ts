import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { contractSchema, contractTypeEnum, renewalTypeEnum } from '../schemas/contract-metadata.js';

const c = initContract();

const contractWithDaysLeft = contractSchema.extend({
  daysLeft: z.number().nullable(),
});

export const contractsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/orgs/:orgId/contracts',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      query: z.object({
        search: z.string().optional(),
        counterparty: z.string().optional(),
        contractType: contractTypeEnum.optional(),
        renewalType: renewalTypeEnum.optional(),
        status: z.enum(['active', 'past']).optional(),
        expiringBefore: z.string().optional(),
        expiringAfter: z.string().optional(),
        sortBy: z
          .enum([
            'title',
            'counterparty',
            'contract_type',
            'expiration_date',
            'days_left',
            'created_at',
          ])
          .optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        limit: z.coerce.number().min(1).max(200).optional(),
        page: z.coerce.number().min(1).optional(),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.object({
            items: z.array(contractWithDaysLeft),
            total: z.number(),
            page: z.number(),
            limit: z.number(),
          }),
        }),
      },
    },
    deadlines: {
      method: 'GET',
      path: '/orgs/:orgId/contracts/deadlines',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      query: z.object({
        limit: z.coerce.number().min(1).max(200).optional(),
        page: z.coerce.number().min(1).optional(),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.object({
            metrics: z.object({
              totalActive: z.number(),
              totalCounterparties: z.number(),
              expiringThisQuarter: z.number(),
              needNoticeThisMonth: z.number(),
              totalSources: z.number(),
              processingSources: z.number(),
            }),
            deadlines: z.array(contractWithDaysLeft),
            total: z.number(),
            page: z.number(),
            limit: z.number(),
          }),
        }),
      },
    },
    get: {
      method: 'GET',
      path: '/orgs/:orgId/contracts/:contractId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        contractId: dbIdSchema('Contract'),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: contractWithDaysLeft }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    update: {
      method: 'PATCH',
      path: '/orgs/:orgId/contracts/:contractId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        contractId: dbIdSchema('Contract'),
      }),
      body: z.object({
        title: z.string().min(1, 'Title is required').optional(),
      }),
      responses: {
        200: z.object({ success: z.literal(true) }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    remove: {
      method: 'DELETE',
      path: '/orgs/:orgId/contracts/:contractId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        contractId: dbIdSchema('Contract'),
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
