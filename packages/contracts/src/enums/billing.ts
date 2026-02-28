import { z } from 'zod';

export const billingStatusValues = [
  'trial',
  'active',
  'past_due',
  'canceled',
  'unpaid',
] as const satisfies readonly string[];

export type BillingStatus = (typeof billingStatusValues)[number];

export const billingStatusEnum = z.enum(billingStatusValues);
