import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import type { DbId } from '@grabdy/common';
import { extractOrgNumericId, packId } from '@grabdy/common';

import type { SyncTrigger } from '../../../db/enums';
import { DbService } from '../../../db/db.module';
import type { SyncedItem } from '../../integrations/connector.interface';
import { IntegrationsService } from '../../integrations/integrations.service';
import { ProviderRegistry } from '../../integrations/providers/provider-registry';
import { TokenEncryptionService } from '../../integrations/token-encryption.service';
import { DATA_SOURCE_QUEUE, INTEGRATION_SYNC_QUEUE } from '../queue.constants';

import type { DataSourceJobData } from './data-source.processor';

export interface IntegrationSyncJobData {
  connectionId: DbId<'Connection'>;
  syncLogId: DbId<'SyncLog'>;
  orgId: DbId<'Org'>;
  trigger: SyncTrigger;
}

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

@Processor(INTEGRATION_SYNC_QUEUE)
export class IntegrationSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationSyncProcessor.name);

  constructor(
    private db: DbService,
    private providerRegistry: ProviderRegistry,
    private tokenEncryption: TokenEncryptionService,
    private integrationsService: IntegrationsService,
    @InjectQueue(DATA_SOURCE_QUEUE) private dataSourceQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<IntegrationSyncJobData>): Promise<void> {
    const { connectionId, syncLogId, orgId, trigger } = job.data;
    this.logger.log(`Processing ${trigger} sync for connection ${connectionId}`);

    try {
      // Load connection with decrypted tokens
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

      // Update sync log to RUNNING
      await this.integrationsService.updateSyncLog(syncLogId, {
        status: 'RUNNING',
        startedAt: new Date(),
      });

      // Sync loop
      let cursor = connection.sync_cursor;
      let totalSynced = 0;
      let totalFailed = 0;

      let hasMore = true;
      while (hasMore) {
        const result = await connector.sync(accessToken, connection.config, cursor);

        // Process synced items
        for (const item of result.items) {
          try {
            await this.processItem(item, connectionId, orgId);
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

        cursor = result.cursor;
        hasMore = result.hasMore;

        // Update progress
        await job.updateProgress(hasMore ? 50 : 100);
      }

      // Update connection cursor and sync time
      await this.integrationsService.updateConnection(connectionId, {
        syncCursor: cursor,
        lastSyncedAt: new Date(),
      });

      // Mark sync complete
      await this.integrationsService.updateSyncLog(syncLogId, {
        status: 'COMPLETED',
        itemsSynced: totalSynced,
        itemsFailed: totalFailed,
        completedAt: new Date(),
      });

      this.logger.log(`Sync complete for connection ${connectionId}: ${totalSynced} synced, ${totalFailed} failed`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Sync failed for connection ${connectionId}: ${message}`);

      await this.integrationsService.updateSyncLog(syncLogId, {
        status: 'FAILED',
        errorMessage: message,
        completedAt: new Date(),
      });

      throw error;
    }
  }

  private async processItem(
    item: SyncedItem,
    connectionId: DbId<'Connection'>,
    orgId: DbId<'Org'>,
  ): Promise<void> {
    // Check if DataSource already exists for this external ID
    const existing = await this.db.kysely
      .selectFrom('data.data_sources')
      .select(['id', 'name'])
      .where('connection_id', '=', connectionId)
      .where('external_id', '=', item.externalId)
      .executeTakeFirst();

    if (existing) {
      // Update existing DataSource and re-queue for processing
      await this.db.kysely
        .updateTable('data.data_sources')
        .set({
          name: item.title,
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
      };
      await this.dataSourceQueue.add('process', jobData);
    } else {
      // Create new DataSource
      const dataSourceId = packId('DataSource', extractOrgNumericId(orgId));

      await this.db.kysely
        .insertInto('data.data_sources')
        .values({
          id: dataSourceId,
          name: item.title,
          filename: item.externalId,
          mime_type: 'text/plain',
          file_size: Buffer.byteLength(item.content, 'utf-8'),
          storage_path: '',
          type: 'INTEGRATION',
          status: 'UPLOADED',
          connection_id: connectionId,
          external_id: item.externalId,
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
      };
      await this.dataSourceQueue.add('process', jobData);
    }
  }

  private async deleteItem(
    externalId: string,
    connectionId: DbId<'Connection'>,
  ): Promise<void> {
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

      await this.db.kysely
        .deleteFrom('data.data_sources')
        .where('id', '=', existing.id)
        .execute();
    }
  }
}
