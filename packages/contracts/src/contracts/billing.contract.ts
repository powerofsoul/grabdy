import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { billingStatusEnum } from '../enums/index.js';

const c = initContract();

const billingInvoiceSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  status: z.string(),
  date: z.string(),
  url: z.string().nullable(),
});

const billingStatusSchema = z.object({
  status: billingStatusEnum,
  planName: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  stripeCustomer: z.string().nullable(),
  invoices: z.array(billingInvoiceSchema),
});

export const billingContract = c.router(
  {
    getStatus: {
      method: 'GET',
      path: '/orgs/:orgId/billing',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      responses: {
        200: z.object({ success: z.literal(true), data: billingStatusSchema }),
      },
    },
    createPortalSession: {
      method: 'POST',
      path: '/orgs/:orgId/billing/portal',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      body: z.object({ returnUrl: z.string().url('Return URL is required') }),
      responses: {
        200: z.object({ success: z.literal(true), data: z.object({ url: z.string() }) }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
  },
  { pathPrefix: '' }
);
