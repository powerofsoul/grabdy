import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const usageSummarySchema = z.object({
  totalRequests: z.number(),
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  totalTokens: z.number(),
  totalCost: z.number(),
});

const dailyUsageSchema = z.object({
  date: z.string(),
  requests: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  totalTokens: z.number(),
  cost: z.number(),
});

const modelBreakdownSchema = z.object({
  model: z.string(),
  provider: z.string(),
  requests: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  totalTokens: z.number(),
  cost: z.number(),
});

const requestTypeBreakdownSchema = z.object({
  requestType: z.string(),
  requests: z.number(),
  totalTokens: z.number(),
  cost: z.number(),
});

export const analyticsContract = c.router(
  {
    getUsageSummary: {
      method: 'GET',
      path: '/orgs/:orgId/analytics/usage',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      query: z.object({
        days: z.coerce.number().min(1).max(90).default(30),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.object({
            summary: usageSummarySchema,
            daily: z.array(dailyUsageSchema),
            byModel: z.array(modelBreakdownSchema),
            byRequestType: z.array(requestTypeBreakdownSchema),
          }),
        }),
      },
    },
  },
  { pathPrefix: '/api' },
);
