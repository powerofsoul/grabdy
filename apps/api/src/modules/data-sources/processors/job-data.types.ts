import type { DbId } from '@grabdy/common';
import type { SyncTrigger } from '@grabdy/contracts';

import type { WebhookEvent } from '../../integrations/connector.interface';
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

// integration-sync queue
export interface IntegrationSyncJobData {
  connectionId: DbId<'Connection'>;
  orgId: DbId<'Org'>;
  trigger: SyncTrigger;
}

// integration-webhook queue
export interface IntegrationWebhookJobData {
  connectionId: DbId<'Connection'>;
  orgId: DbId<'Org'>;
  event: WebhookEvent;
}

// integration-cleanup queue
export interface IntegrationCleanupJobData {
  orgId: DbId<'Org'>;
  connectionId: DbId<'Connection'>;
}

// slack-bot queue
export interface SlackBotJobData {
  orgId: DbId<'Org'>;
  connectionId: DbId<'Connection'>;
  channel: string;
  threadTs: string;
  text: string;
}
