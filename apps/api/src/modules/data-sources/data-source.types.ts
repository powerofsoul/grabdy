import type { DbId } from '@grabdy/common';
import type { ChunkMeta, UploadsMime } from '@grabdy/contracts';

import { env } from '../../config/env.config';

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
  /** Direct URL for external sources (Slack, Linear, etc.). Null for uploaded files. */
  sourceUrl: string | null;
  /** S3 storage key for uploaded files. Null for external sources. */
  sourceKey: string | null;
  /** Context prepended before embedding (doc type, heading, page). Stored separately from content. */
  embeddingContext?: string;
  /** FK to extracted_images table for image-derived chunks. */
  extractedImageId?: DbId<'ExtractedImage'>;
}

export function buildSource(data: DataSourceJobData): {
  sourceUrl: string | null;
  sourceKey: string | null;
} {
  if (data.sourceUrl) {
    return { sourceUrl: data.sourceUrl, sourceKey: null };
  }
  if (data.storagePath) {
    return { sourceUrl: null, sourceKey: data.storagePath };
  }
  return { sourceUrl: null, sourceKey: null };
}

export function storageProxyUrl(orgId: DbId<'Org'>, storagePath: string): string {
  // Use the storage path directly as URL path segments (strip orgId/ prefix since it's in the URL)
  const prefix = `${orgId}/`;
  const relativePath = storagePath.startsWith(prefix)
    ? storagePath.slice(prefix.length)
    : storagePath;
  return `${env.apiUrl}/orgs/${orgId}/f/${relativePath}`;
}
