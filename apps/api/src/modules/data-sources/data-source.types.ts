import type { DbId } from '@grabdy/common';
import type { ChunkMeta, UploadsMime } from '@grabdy/contracts';

export interface SyncedMessageData {
  content: string;
  metadata: ChunkMeta;
  sourceUrl: string;
}

export interface DataSourceJobData {
  dataSourceId: DbId<'DataSource'>;
  orgId: DbId<'Org'>;
  storagePath: string;
  mimeType: UploadsMime;
  collectionId: DbId<'Collection'> | null;
  /** Pre-extracted text content (used by integration sources to skip file extraction). */
  content?: string;
  /** Structured messages with per-message metadata (one chunk per message). Takes precedence over `content`. */
  messages?: SyncedMessageData[];
  /** Source URL for all chunks (used when all chunks share the same URL, e.g., a Jira issue). */
  sourceUrl?: string;
  /** When true, append new chunks to existing data source without deleting old ones. */
  appendOnly?: boolean;
}

export interface ChunkWithMeta {
  content: string;
  metadata: ChunkMeta;
  sourceUrl: string;
}
