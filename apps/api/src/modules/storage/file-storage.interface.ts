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
  getUrl(key: string): Promise<string>;
  exists(key: string): Promise<boolean>;
}

/**
 * Standardized S3 key builders.
 *
 * Layout:
 *   {orgId}/{collectionId|uncategorized}/{dataSourceId}.{ext}
 *   {orgId}/{collectionId|uncategorized}/{dataSourceId}/images/{page}-{index}.png
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

  /** Extracted image from a data source: orgId/collectionId/dataSourceId/images/{page}-{index}.png */
  extractedImage(
    orgId: DbId<'Org'>,
    collectionId: DbId<'Collection'> | null,
    dataSourceId: DbId<'DataSource'>,
    page: number,
    index: number
  ): string {
    const collection = collectionId ?? 'uncategorized';
    return `${orgId}/${collection}/${dataSourceId}/images/${page}-${index}.png`;
  },
};
