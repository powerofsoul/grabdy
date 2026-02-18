import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { extractOrgNumericId, packId } from '@grabdy/common';
import type { IntegrationProvider, SyncTrigger } from '@grabdy/contracts';
import { Job, Queue } from 'bullmq';

import { DbService } from '../../../db/db.module';
import type { DataSourceJobData } from '../../data-sources/data-source.processor';
import { DATA_SOURCE_QUEUE, INTEGRATIONS_QUEUE } from '../../queue/queue.constants';
import {
  parseProviderData,
  type ProviderData,
  type SyncedItem,
  type WebhookEvent,
} from '../connector.interface';
import { IntegrationsService } from '../integrations.service';
import { ProviderRegistry } from '../providers/provider-registry';

export interface IntegrationSyncJobData {
  connectionId: DbId<'Connection'>;
  orgId: DbId<'Org'>;
  trigger: SyncTrigger;
}

export interface IntegrationWebhookJobData {
  connectionId: DbId<'Connection'>;
  orgId: DbId<'Org'>;
  event: WebhookEvent;
}

export interface IntegrationScheduledJobData {
  connectionId: DbId<'Connection'>;
}

type JobData = IntegrationSyncJobData | IntegrationWebhookJobData | IntegrationScheduledJobData;

function isWebhookJob(data: JobData): data is IntegrationWebhookJobData {
  return 'event' in data;
}

function isSyncJob(data: JobData): data is IntegrationSyncJobData {
  return 'trigger' in data;
}

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

@Processor(INTEGRATIONS_QUEUE, { concurrency: 50 })
export class IntegrationSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationSyncProcessor.name);

  constructor(
    private db: DbService,
    private providerRegistry: ProviderRegistry,
    private integrationsService: IntegrationsService,
    @InjectQueue(DATA_SOURCE_QUEUE) private dataSourceQueue: Queue,
    @InjectQueue(INTEGRATIONS_QUEUE) private syncQueue: Queue
  ) {
    super();
  }

  async process(job: Job<JobData>): Promise<void> {
    const { data } = job;
    if (job.name === 'process-item' && isWebhookJob(data)) {
      await this.processItemJob(data);
    } else if (job.name === 'scheduled-sync') {
      await this.processScheduledJob(data);
    } else if (job.name === 'discover' && isSyncJob(data)) {
      await this.processDiscovery(data, (progress) => job.updateProgress(progress));
    } else {
      this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async processDiscovery(
    data: IntegrationSyncJobData,
    updateProgress?: (progress: number) => Promise<void>
  ): Promise<void> {
    const { connectionId, orgId, trigger } = data;
    this.logger.log(`Processing ${trigger} sync for connection ${connectionId}`);

    try {
      const { accessToken, connection } = await this.loadConnection(connectionId);
      const connector = this.providerRegistry.getConnector(connection.provider);
      // Sync loop
      let currentProviderData: ProviderData = parseProviderData(connection.provider_data);
      let totalSynced = 0;
      let totalFailed = 0;

      let hasMore = true;
      while (hasMore) {
        const result = await connector.sync(accessToken, currentProviderData);

        // Process synced items
        for (const item of result.items) {
          try {
            await this.processItem(item, connectionId, orgId, connection.provider);
            totalSynced++;
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to process item ${item.externalId}: ${msg}`);
            totalFailed++;
          }
        }

        // Handle deleted items
        for (const deletedId of result.deletedExternalIds) {
          try {
            await this.deleteItem(deletedId, connectionId);
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to delete item ${deletedId}: ${msg}`);
          }
        }

        // Queue discovered items as individual jobs (for bulk-discover providers like Notion)
        if (result.webhookEvents && result.webhookEvents.length > 0) {
          await this.syncQueue.addBulk(
            result.webhookEvents.map((event) => ({
              name: 'process-item',
              data: { connectionId, orgId, event },
              opts: { jobId: `${connectionId}-${event.externalId}` },
            }))
          );
          this.logger.log(
            `Queued ${result.webhookEvents.length} items for connection ${connectionId}`
          );
        }

        currentProviderData = result.updatedProviderData;
        hasMore = result.hasMore;

        if (updateProgress) {
          await updateProgress(hasMore ? 50 : 100);
        }
      }

      // Persist updated provider data and sync time
      await this.integrationsService.updateConnection(connectionId, {
        providerData: currentProviderData,
        lastSyncedAt: new Date(),
      });

      this.logger.log(
        `Sync complete for connection ${connectionId}: ${totalSynced} synced, ${totalFailed} failed`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Sync failed for connection ${connectionId}: ${message}`);

      await this.integrationsService.updateConnection(connectionId, {
        status: 'DISCONNECTED',
      });

      throw error;
    }
  }

  private async processItemJob(data: IntegrationWebhookJobData): Promise<void> {
    const { connectionId, orgId, event } = data;
    this.logger.log(
      `Processing item for connection ${connectionId}: ${event.action} ${event.externalId}`
    );

    try {
      const { accessToken, connection } = await this.loadConnection(connectionId);
      const connector = this.providerRegistry.getConnector(connection.provider);
      const providerData = parseProviderData(connection.provider_data);

      const result = await connector.processWebhookItem(accessToken, providerData, event);

      if (result.item) {
        await this.processItem(result.item, connectionId, orgId, connection.provider);
      }

      if (result.deletedExternalId) {
        await this.deleteItem(result.deletedExternalId, connectionId);
      }

      await this.integrationsService.updateConnection(connectionId, {
        lastSyncedAt: new Date(),
      });

      this.logger.log(`Item processed for connection ${connectionId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Item processing failed for connection ${connectionId}: ${message}`);
      throw error;
    }
  }

  private async processScheduledJob(data: IntegrationScheduledJobData): Promise<void> {
    const { connectionId } = data;
    this.logger.log(`Processing scheduled sync for connection ${connectionId}`);

    // Load connection to get orgId, then delegate to full sync
    const connection = await this.integrationsService.getConnectionById(connectionId);
    if (!connection) {
      this.logger.warn(`Connection ${connectionId} not found for scheduled sync`);
      return;
    }

    if (connection.status !== 'ACTIVE') {
      this.logger.log(`Skipping scheduled sync for non-active connection ${connectionId}`);
      return;
    }

    await this.processDiscovery({
      connectionId,
      orgId: connection.org_id,
      trigger: 'SCHEDULED',
    });
  }

  private async loadConnection(connectionId: DbId<'Connection'>) {
    const connection = await this.integrationsService.getConnectionById(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const connector = this.providerRegistry.getConnector(connection.provider);

    // Refresh tokens if near expiry
    let accessToken = connection.access_token;
    if (connection.token_expires_at && connection.refresh_token) {
      const expiresAt = new Date(connection.token_expires_at).getTime();
      if (expiresAt - Date.now() < TOKEN_REFRESH_BUFFER_MS) {
        this.logger.log(`Refreshing tokens for connection ${connectionId}`);
        const newTokens = await connector.refreshTokens(connection.refresh_token);
        await this.integrationsService.updateConnection(connectionId, {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          tokenExpiresAt: newTokens.expiresAt,
        });
        accessToken = newTokens.accessToken;
      }
    }

    return { accessToken, connection };
  }

  private async processItem(
    item: SyncedItem,
    connectionId: DbId<'Connection'>,
    orgId: DbId<'Org'>,
    provider: IntegrationProvider
  ): Promise<void> {
    // Check if DataSource already exists for this external ID
    const existing = await this.db.kysely
      .selectFrom('data.data_sources')
      .select(['id', 'title'])
      .where('connection_id', '=', connectionId)
      .where('external_id', '=', item.externalId)
      .executeTakeFirst();

    if (existing) {
      // Update existing DataSource and re-queue for processing
      await this.db.kysely
        .updateTable('data.data_sources')
        .set({
          title: item.title,
          source_url: item.sourceUrl,
          status: 'UPLOADED',
          updated_at: new Date(),
        })
        .where('id', '=', existing.id)
        .execute();

      // Delete old chunks before re-processing
      await this.db.kysely
        .deleteFrom('data.chunks')
        .where('data_source_id', '=', existing.id)
        .execute();

      // Queue for chunking + embedding
      const jobData: DataSourceJobData = {
        dataSourceId: existing.id,
        orgId,
        storagePath: '',
        mimeType: 'text/plain',
        collectionId: null,
        content: item.content,
        messages: item.messages,
        sourceUrl: item.sourceUrl,
      };
      await this.dataSourceQueue.add('process', jobData);
    } else {
      // Create new DataSource
      const dataSourceId = packId('DataSource', extractOrgNumericId(orgId));

      await this.db.kysely
        .insertInto('data.data_sources')
        .values({
          id: dataSourceId,
          title: item.title,
          mime_type: 'text/plain',
          file_size: Buffer.byteLength(item.content, 'utf-8'),
          storage_path: '',
          type: provider,
          status: 'UPLOADED',
          connection_id: connectionId,
          external_id: item.externalId,
          source_url: item.sourceUrl,
          org_id: orgId,
          uploaded_by_id: null,
          updated_at: new Date(),
        })
        .execute();

      // Queue for chunking + embedding
      const jobData: DataSourceJobData = {
        dataSourceId,
        orgId,
        storagePath: '',
        mimeType: 'text/plain',
        collectionId: null,
        content: item.content,
        messages: item.messages,
        sourceUrl: item.sourceUrl,
      };
      await this.dataSourceQueue.add('process', jobData);
    }
  }

  private async deleteItem(externalId: string, connectionId: DbId<'Connection'>): Promise<void> {
    const existing = await this.db.kysely
      .selectFrom('data.data_sources')
      .select('id')
      .where('connection_id', '=', connectionId)
      .where('external_id', '=', externalId)
      .executeTakeFirst();

    if (existing) {
      // Chunks cascade via FK, but delete explicitly for clarity
      await this.db.kysely
        .deleteFrom('data.chunks')
        .where('data_source_id', '=', existing.id)
        .execute();

      await this.db.kysely.deleteFrom('data.data_sources').where('id', '=', existing.id).execute();
    }
  }
}
