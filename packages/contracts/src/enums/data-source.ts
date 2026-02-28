import { z } from 'zod';

import { objectValues } from './helpers.js';
import type { IntegrationProvider } from './integration.js';
import { IntegrationProvider as IntegrationProviderValue } from './integration.js';
import type { UploadSourceType } from './uploads.js';
import { UPLOADS_FILE_TYPES } from './uploads.js';

export const DataSourceStatus = {
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
  DELETING: 'DELETING',
} as const;
export type DataSourceStatus = (typeof DataSourceStatus)[keyof typeof DataSourceStatus];

export const dataSourceStatusEnum = z.enum(objectValues(DataSourceStatus));

// ── DataSourceType ──────────────────────────────────────────────────
// Derived from UPLOADS_FILE_TYPES (upload types) + IntegrationProvider
// (integration types). Adding a new file type or integration provider
// automatically extends DataSourceType.

export type DataSourceType = UploadSourceType | IntegrationProvider;

/** Runtime array of all DataSourceType values (deduped uploads + integrations). */
const allDataSourceTypes = [
  ...new Set([
    ...UPLOADS_FILE_TYPES.map((f) => f.type),
    ...Object.values(IntegrationProviderValue),
  ]),
] satisfies DataSourceType[];

export const dataSourceTypeEnum = z.enum(
  allDataSourceTypes as [DataSourceType, ...DataSourceType[]]
);

// ── Document Classification ───────────────────────────────────────

export const documentClassificationSchema = z.object({
  documentCategory: z.enum([
    'contract',
    'report',
    'email_thread',
    'spreadsheet',
    'technical_docs',
    'invoice',
    'form',
    'meeting_notes',
    'general',
  ]),
  characteristics: z.object({
    hasImages: z.boolean(),
    hasCharts: z.boolean(),
    hasComments: z.boolean(),
    hasHighlights: z.boolean(),
    hasAnnotations: z.boolean(),
    hasFormFields: z.boolean(),
    isTableHeavy: z.boolean(),
    hasHeadingStructure: z.boolean(),
  }),
  chunkingStrategy: z.enum([
    'heading_aware',
    'table_aware',
    'email_thread',
    'default_recursive',
    'spreadsheet_row',
  ]),
});
export type DocumentClassification = z.infer<typeof documentClassificationSchema>;
