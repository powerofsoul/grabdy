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
} as const;
export type DataSourceStatus = (typeof DataSourceStatus)[keyof typeof DataSourceStatus];

export const dataSourceStatusEnum = z.enum(objectValues(DataSourceStatus));

// ── Standalone DataSource Types ─────────────────────────────────────
// Types that are neither file uploads nor integration providers.

export const StandaloneDataSourceType = {
  CODE_REPO: 'CODE_REPO',
} as const;
export type StandaloneDataSourceType =
  (typeof StandaloneDataSourceType)[keyof typeof StandaloneDataSourceType];

/** Runtime array of standalone data source types. */
export const STANDALONE_DATA_SOURCE_TYPES = objectValues(StandaloneDataSourceType);

// ── DataSourceType ──────────────────────────────────────────────────
// Derived from UPLOADS_FILE_TYPES (upload types) + IntegrationProvider
// (integration types) + StandaloneDataSourceType. Adding a new file
// type, integration provider, or standalone type automatically extends
// DataSourceType.

export type DataSourceType = UploadSourceType | IntegrationProvider | StandaloneDataSourceType;

/** Runtime array of all DataSourceType values (deduped uploads + integrations + standalone). */
const allDataSourceTypes = [
  ...new Set([
    ...UPLOADS_FILE_TYPES.map((f) => f.type),
    ...Object.values(IntegrationProviderValue),
    ...STANDALONE_DATA_SOURCE_TYPES,
  ]),
] satisfies DataSourceType[];

export const dataSourceTypeEnum = z.enum(
  allDataSourceTypes as [DataSourceType, ...DataSourceType[]]
);
