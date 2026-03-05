import type { DbId } from '@grabdy/common';

import type { SyncedMessageData } from '../data-source.types';

// file-ingestion queue
export interface FileIngestionJobData {
  orgId: DbId<'Org'>;
  dataSourceId: DbId<'DataSource'>;
  storagePath: string;
  mimeType: string;
  collectionId: DbId<'Collection'> | null;
  content?: string;
  messages?: SyncedMessageData[];
  sourceUrl?: string;
  appendOnly?: boolean;
  filename?: string;
}
