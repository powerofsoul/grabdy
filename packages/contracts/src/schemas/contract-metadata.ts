import { dbIdSchema } from '@grabdy/common';
import { z } from 'zod';

export const renewalTypeEnum = z.enum(['auto', 'manual', 'none']);
export type RenewalType = z.infer<typeof renewalTypeEnum>;

export const liabilityCapTypeEnum = z.enum(['fixed', 'percentage', 'unlimited', 'none']);
export type LiabilityCapType = z.infer<typeof liabilityCapTypeEnum>;

export const indemnificationTypeEnum = z.enum(['mutual', 'one_way_us', 'one_way_them', 'none']);
export type IndemnificationType = z.infer<typeof indemnificationTypeEnum>;

export const ipOwnershipEnum = z.enum(['us', 'them', 'joint', 'not_applicable']);
export type IpOwnership = z.infer<typeof ipOwnershipEnum>;

export const disputeMechanismEnum = z.enum(['arbitration', 'litigation', 'mediation']);
export type DisputeMechanism = z.infer<typeof disputeMechanismEnum>;

export const paymentFrequencyEnum = z.enum([
  'monthly',
  'quarterly',
  'annually',
  'one_time',
  'other',
]);
export type PaymentFrequency = z.infer<typeof paymentFrequencyEnum>;

export const contractTypeEnum = z.enum([
  'nda',
  'msa',
  'sow',
  'saas_agreement',
  'employment',
  'lease',
  'baa',
  'amendment',
  'licensing',
  'service_agreement',
  'consulting_agreement',
  'partnership_agreement',
  'vendor_agreement',
  'data_processing',
  'non_compete',
  'other',
]);
export type ContractType = z.infer<typeof contractTypeEnum>;

export const CONTRACT_TYPE_LABELS = {
  nda: 'NDA',
  msa: 'MSA',
  sow: 'SOW',
  saas_agreement: 'SaaS Agreement',
  employment: 'Employment',
  lease: 'Lease',
  baa: 'BAA',
  amendment: 'Amendment',
  licensing: 'Licensing',
  service_agreement: 'Service Agreement',
  consulting_agreement: 'Consulting',
  partnership_agreement: 'Partnership',
  vendor_agreement: 'Vendor Agreement',
  data_processing: 'DPA',
  non_compete: 'Non-Compete',
  other: 'Other',
} satisfies Record<ContractType, string>;

/** Full contract schema for the contracts table and AI extraction. */
export const contractSchema = z.object({
  id: dbIdSchema('Contract'),
  orgId: dbIdSchema('Org'),
  dataSourceId: dbIdSchema('DataSource'),

  // Identity
  title: z.string(),
  counterparty: z.string().nullable(),
  contractType: contractTypeEnum.nullable(),
  governingLaw: z.string().nullable(),
  jurisdiction: z.string().nullable(),

  // Dates
  effectiveDate: z.string().nullable(),
  expirationDate: z.string().nullable(),
  executionDate: z.string().nullable(),

  // Renewal
  renewalType: renewalTypeEnum.nullable(),
  renewalDate: z.string().nullable(),
  renewalTermMonths: z.number().nullable(),
  noticePeriodDays: z.number().nullable(),
  noticeByDate: z.string().nullable(),

  // Financial
  totalValue: z.number().nullable(),
  currency: z.string().nullable(),
  paymentTerms: z.string().nullable(),
  paymentFrequency: paymentFrequencyEnum.nullable(),

  // Liability & indemnification
  liabilityCapAmount: z.number().nullable(),
  liabilityCapType: liabilityCapTypeEnum.nullable(),
  indemnificationType: indemnificationTypeEnum.nullable(),

  // Termination
  terminationForCause: z.boolean().nullable(),
  terminationForConvenience: z.boolean().nullable(),
  terminationNoticeDays: z.number().nullable(),

  // IP
  ipOwnership: ipOwnershipEnum.nullable(),
  workForHire: z.boolean().nullable(),

  // Confidentiality
  confidentialityTermMonths: z.number().nullable(),
  nonCompete: z.boolean().nullable(),
  nonCompeteTermMonths: z.number().nullable(),
  nonSolicitation: z.boolean().nullable(),

  // Insurance
  insuranceRequired: z.boolean().nullable(),
  insuranceMinimumAmount: z.number().nullable(),

  // Dispute
  disputeMechanism: disputeMechanismEnum.nullable(),
  disputeVenue: z.string().nullable(),

  // AI extraction metadata
  extractionConfidence: z.number().nullable(),
  extractedAt: z.string().nullable(),

  // Timestamps
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Contract = z.infer<typeof contractSchema>;

/** Schema for AI extraction output (no id, orgId, dataSourceId, timestamps).
 *  Fields are optional because the AI model may omit fields it cannot determine. */
export const contractExtractionSchema = z.object({
  title: z.string().nullable().optional(),
  counterparty: z.string().nullable().optional(),
  contractType: contractTypeEnum.nullable().optional(),
  governingLaw: z.string().nullable().optional(),
  jurisdiction: z.string().nullable().optional(),
  effectiveDate: z.string().nullable().optional(),
  expirationDate: z.string().nullable().optional(),
  executionDate: z.string().nullable().optional(),
  renewalType: renewalTypeEnum.nullable().optional(),
  renewalDate: z.string().nullable().optional(),
  renewalTermMonths: z.number().nullable().optional(),
  noticePeriodDays: z.number().nullable().optional(),
  noticeByDate: z.string().nullable().optional(),
  totalValue: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  paymentFrequency: paymentFrequencyEnum.nullable().optional(),
  liabilityCapAmount: z.number().nullable().optional(),
  liabilityCapType: liabilityCapTypeEnum.nullable().optional(),
  indemnificationType: indemnificationTypeEnum.nullable().optional(),
  terminationForCause: z.boolean().nullable().optional(),
  terminationForConvenience: z.boolean().nullable().optional(),
  terminationNoticeDays: z.number().nullable().optional(),
  ipOwnership: ipOwnershipEnum.nullable().optional(),
  workForHire: z.boolean().nullable().optional(),
  confidentialityTermMonths: z.number().nullable().optional(),
  nonCompete: z.boolean().nullable().optional(),
  nonCompeteTermMonths: z.number().nullable().optional(),
  nonSolicitation: z.boolean().nullable().optional(),
  insuranceRequired: z.boolean().nullable().optional(),
  insuranceMinimumAmount: z.number().nullable().optional(),
  disputeMechanism: disputeMechanismEnum.nullable().optional(),
  disputeVenue: z.string().nullable().optional(),
});
export type ContractExtraction = z.infer<typeof contractExtractionSchema>;
