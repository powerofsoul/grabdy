import type { DbId } from '@grabdy/common';

export interface TempFileHandle {
  path: string;
  /** Remove the temp file (no-op for local storage where the file is the original). */
  cleanup(): Promise<void>;
}

export interface FileStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** Get the file as a temp path on disk (avoids loading into memory). */
  getTempPath(key: string): Promise<TempFileHandle>;
  delete(key: string): Promise<void>;
  /** Delete all objects under a key prefix. */
  deletePrefix(prefix: string): Promise<void>;
  getUrl(key: string): Promise<string>;
  exists(key: string): Promise<boolean>;
}

/**
 * Standardized S3 key builders.
 *
 * Layout:
 *   {orgId}/{collectionId|uncategorized}/{dataSourceId}.{ext}
 */
export const StorageKeys = {
  /** Primary file: orgId/collectionId/dataSourceId.ext */
  fileDataSource(
    orgId: DbId<'Org'>,
    collectionId: DbId<'Collection'> | null,
    dataSourceId: DbId<'DataSource'>,
    ext: string
  ): string {
    const collection = collectionId ?? 'uncategorized';
    return `${orgId}/${collection}/${dataSourceId}.${ext}`;
  },

  /** Extracted images prefix: orgId/extracted-images/dataSourceId */
  extractedImages(orgId: DbId<'Org'>, dataSourceId: DbId<'DataSource'>): string {
    return `${orgId}/extracted-images/${dataSourceId}`;
  },

  /** Single extracted image: orgId/extracted-images/dataSourceId/imageId */
  extractedImage(
    orgId: DbId<'Org'>,
    dataSourceId: DbId<'DataSource'>,
    imageId: DbId<'ExtractedImage'>
  ): string {
    return `${orgId}/extracted-images/${dataSourceId}/${imageId}`;
  },
};
