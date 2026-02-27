import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { extractOrgNumericId, packId } from '@grabdy/common';
import type { IntegrationProvider } from '@grabdy/contracts';
import type { Job, Queue } from 'bullmq';

import { DbService } from '../../db/db.module';
import { InjectTypedQueue } from '../../queue/queue.decorators';
import type { DataSourceJobData } from '../data-sources/data-source.types';
import { DataSourceDispatchService } from '../data-sources/data-source-dispatch.service';

import { ProviderRegistry } from './providers/provider-registry';
import { parseProviderData, type ProviderData, type SyncedItem } from './connector.interface';
import { IntegrationsService } from './integrations.service';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

@Processor('integration-discover', { concurrency: 5 })
export class IntegrationDiscoverProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationDiscoverProcessor.name);

  constructor(
    private db: DbService,
    private providerRegistry: ProviderRegistry,
    private integrationsService: IntegrationsService,
    private dataSourceDispatch: DataSourceDispatchService,
    @InjectTypedQueue('integration-process-item') private processItemQueue: Queue,
    @InjectTypedQueue('notification') private notificationQueue: Queue
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { connectionId, orgId, trigger } = job.data;
    this.logger.log(`Processing ${trigger} sync for connection ${connectionId}`);

    const { accessToken, connection } = await this.loadConnection(connectionId);
    const connector = this.providerRegistry.getConnector(connection.provider);

    let currentProviderData: ProviderData = parseProviderData(connection.provider_data);
    let totalSynced = 0;
    let totalFailed = 0;

    let hasMore = true;
    while (hasMore) {
      const result = await connector.sync(accessToken, currentProviderData, {
        connectionId,
        orgId,
      });
      let synced = 0;
      let failed = 0;

      for (const item of result.items) {
        try {
          await this.processItem(item, connectionId, orgId, connection.provider);
          synced++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`Failed to process item ${item.externalId}: ${msg}`);
          failed++;
        }
      }

      for (const deletedId of result.deletedExternalIds) {
        try {
          await this.deleteItem(deletedId, connectionId, orgId);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`Failed to delete item ${deletedId}: ${msg}`);
        }
      }

      totalSynced += synced;
      totalFailed += failed;

      // Fan-out discovered items as individual webhook jobs
      if (result.webhookEvents && result.webhookEvents.length > 0) {
        await this.processItemQueue.addBulk(
          result.webhookEvents.map((webhookEvent) => ({
            name: 'process',
            data: { connectionId, orgId, event: webhookEvent },
          }))
        );
        this.logger.log(
          `Queued ${result.webhookEvents.length} items for connection ${connectionId}`
        );
      }

      currentProviderData = result.updatedProviderData;
      hasMore = result.hasMore;

      // Persist progress after each iteration so work is not lost if the job fails mid-sync
      await this.integrationsService.updateConnection(connectionId, {
        providerData: currentProviderData,
      });
    }

    await this.integrationsService.updateConnection(connectionId, {
      lastSyncedAt: new Date(),
    });

    this.logger.log(
      `Sync complete for connection ${connectionId}: ${totalSynced} synced, ${totalFailed} failed`
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
    this.notificationQueue
      .add('slack', {
        orgId: null,
        type: 'integration-failure',
        text: `Integration discover failed: ${job.name}(${job.id}) - ${err.message}`,
      })
      .catch((e) => this.logger.error('Failed to enqueue failure notification', e));

    // On final failure, mark connection as disconnected so scheduled sync stops retrying
    const maxAttempts = job.opts.attempts ?? 3;
    if (job.attemptsMade >= maxAttempts) {
      const { connectionId } = job.data;
      this.integrationsService
        .updateConnection(connectionId, {
          status: 'DISCONNECTED',
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          this.logger.error(`Failed to mark connection ${connectionId} as DISCONNECTED: ${msg}`);
        });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private async loadConnection(connectionId: DbId<'Connection'>) {
    const connection = await this.integrationsService.getConnectionById(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const connector = this.providerRegistry.getConnector(connection.provider);

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
    const existing = await this.db.kysely
      .selectFrom('data.data_sources')
      .select(['id', 'title'])
      .where('connection_id', '=', connectionId)
      .where('external_id', '=', item.externalId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (existing) {
      await this.db.kysely
        .updateTable('data.data_sources')
        .set({
          title: item.title,
          source_url: item.sourceUrl,
          status: item.appendOnly ? 'READY' : 'UPLOADED',
          updated_at: new Date(),
        })
        .where('id', '=', existing.id)
        .where('org_id', '=', orgId)
        .execute();

      if (!item.appendOnly) {
        await this.db.kysely
          .deleteFrom('data.chunks')
          .where('data_source_id', '=', existing.id)
          .where('org_id', '=', orgId)
          .execute();
      }

      const jobData: DataSourceJobData = {
        dataSourceId: existing.id,
        orgId,
        storagePath: '',
        mimeType: 'text/plain',
        collectionId: null,
        content: item.content,
        messages: item.messages,
        sourceUrl: item.sourceUrl,
        appendOnly: item.appendOnly,
      };
      await this.dataSourceDispatch.dispatch(jobData);
    } else {
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
      await this.dataSourceDispatch.dispatch(jobData);
    }
  }

  private async deleteItem(
    externalId: string,
    connectionId: DbId<'Connection'>,
    orgId: DbId<'Org'>
  ): Promise<void> {
    const existing = await this.db.kysely
      .selectFrom('data.data_sources')
      .select('id')
      .where('connection_id', '=', connectionId)
      .where('external_id', '=', externalId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (existing) {
      await this.db.kysely
        .deleteFrom('data.chunks')
        .where('data_source_id', '=', existing.id)
        .where('org_id', '=', orgId)
        .execute();

      await this.db.kysely
        .deleteFrom('data.data_sources')
        .where('id', '=', existing.id)
        .where('org_id', '=', orgId)
        .execute();
    }
  }
}
