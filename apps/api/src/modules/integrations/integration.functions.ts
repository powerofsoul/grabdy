import { Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { extractOrgNumericId, packId } from '@grabdy/common';
import type { IntegrationProvider } from '@grabdy/contracts';

import { DbService } from '../../db/db.module';
import { inngest } from '../../inngest/inngest.client';
import { InngestFunctions } from '../../inngest/inngest.decorator';
import { InngestService } from '../../inngest/inngest.service';
import type { DataSourceJobData } from '../data-sources/data-source.types';

import { ProviderRegistry } from './providers/provider-registry';
import { parseProviderData, type ProviderData, type SyncedItem } from './connector.interface';
import { IntegrationsService } from './integrations.service';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

@InngestFunctions()
export class IntegrationFunctions {
  private readonly logger = new Logger(IntegrationFunctions.name);

  constructor(
    private db: DbService,
    private providerRegistry: ProviderRegistry,
    private integrationsService: IntegrationsService,
    private inngestService: InngestService
  ) {}

  definitions() {
    return [
      this.integrationDiscover(),
      this.integrationProcessItem(),
      this.connectionCleanup(),
      this.integrationScheduledSync(),
    ];
  }

  // ── Helpers ───────────────────────────────────────────────────────────

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
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (existing) {
      // Update existing DataSource and re-queue for processing
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
        // Full rebuild: delete old chunks before re-processing
        await this.db.kysely
          .deleteFrom('data.chunks')
          .where('data_source_id', '=', existing.id)
          .where('org_id', '=', orgId)
          .execute();
      }

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
        appendOnly: item.appendOnly,
      };
      await this.inngestService.send('app/data-source.process', jobData);
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
      await this.inngestService.send('app/data-source.process', jobData);
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
      // Chunks cascade via FK, but delete explicitly for clarity
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

  // ── Function definitions ──────────────────────────────────────────────

  private integrationDiscover() {
    return inngest.createFunction(
      {
        id: 'integration-discover',
        concurrency: [
          { scope: 'fn', limit: 50 },
          { scope: 'fn', key: 'event.data.connectionId', limit: 1 },
        ],
        retries: 3,
        onFailure: async ({ event }) => {
          const { connectionId } = event.data.event.data;
          await this.integrationsService.updateConnection(connectionId, {
            status: 'DISCONNECTED',
          });
        },
      },
      { event: 'app/integration.discover' },
      async ({ event, step }) => {
        const { connectionId, orgId, trigger } = event.data;
        this.logger.log(`Processing ${trigger} sync for connection ${connectionId}`);

        // Outside step.run so access_token is never serialized into Inngest step state/logs.
        // Re-executing on replay is safe: fetches a fresh token and refresh is idempotent.
        const { accessToken, connection } = await this.loadConnection(connectionId);

        const connector = this.providerRegistry.getConnector(connection.provider);

        // Sync loop with pagination. Counters are accumulated from step results
        // so replays produce correct totals.
        let currentProviderData: ProviderData = parseProviderData(connection.provider_data);
        let totalSynced = 0;
        let totalFailed = 0;
        let pageIndex = 0;

        let hasMore = true;
        while (hasMore) {
          // All sync + process + delete operations in one step per page to avoid
          // hitting Inngest's ~1000 step limit on large workspaces.
          const pageResult = await step.run(`sync-page-${pageIndex}`, async () => {
            const result = await connector.sync(accessToken, currentProviderData);
            let synced = 0;
            let failed = 0;

            // Process synced items
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

            // Handle deleted items
            for (const deletedId of result.deletedExternalIds) {
              try {
                await this.deleteItem(deletedId, connectionId, orgId);
              } catch (error) {
                const msg = error instanceof Error ? error.message : 'Unknown error';
                this.logger.warn(`Failed to delete item ${deletedId}: ${msg}`);
              }
            }

            return { ...result, synced, failed };
          });

          totalSynced += pageResult.synced;
          totalFailed += pageResult.failed;

          // Fan-out discovered items as individual webhook jobs (for bulk-discover providers like Notion)
          if (pageResult.webhookEvents && pageResult.webhookEvents.length > 0) {
            await step.run(`fan-out-page-${pageIndex}`, async () => {
              const events = pageResult.webhookEvents ?? [];
              await this.inngestService.sendBulk(
                events.map((webhookEvent) => ({
                  name: 'app/integration.process-item',
                  data: { connectionId, orgId, event: webhookEvent },
                }))
              );
            });
            this.logger.log(
              `Queued ${pageResult.webhookEvents.length} items for connection ${connectionId}`
            );
          }

          currentProviderData = pageResult.updatedProviderData;
          hasMore = pageResult.hasMore;
          pageIndex++;
        }

        // Persist updated provider data and sync time
        await step.run('finalize', async () => {
          await this.integrationsService.updateConnection(connectionId, {
            providerData: currentProviderData,
            lastSyncedAt: new Date(),
          });
        });

        this.logger.log(
          `Sync complete for connection ${connectionId}: ${totalSynced} synced, ${totalFailed} failed`
        );
      }
    );
  }

  private integrationProcessItem() {
    return inngest.createFunction(
      {
        id: 'integration-process-item',
        concurrency: [
          { scope: 'fn', limit: 50 },
          { scope: 'fn', key: 'event.data.orgId', limit: 10 },
        ],
        retries: 3,
      },
      { event: 'app/integration.process-item' },
      async ({ event, step }) => {
        const { connectionId, orgId, event: webhookEvent } = event.data;
        this.logger.log(
          `Processing item for connection ${connectionId}: ${webhookEvent.action} ${webhookEvent.externalId}`
        );

        // Outside step.run so access_token is never serialized into Inngest step state/logs.
        // Re-executing on replay is safe: fetches a fresh token and refresh is idempotent.
        const { accessToken, connection } = await this.loadConnection(connectionId);

        const providerData = parseProviderData(connection.provider_data);

        const result = await step.run('process-webhook-item', async () => {
          const connector = this.providerRegistry.getConnector(connection.provider);
          return connector.processWebhookItem(accessToken, providerData, webhookEvent);
        });

        if (result.item) {
          const item = result.item;
          await step.run('upsert-data-source', async () => {
            return this.processItem(item, connectionId, orgId, connection.provider);
          });
        }

        if (result.deletedExternalId) {
          const deletedId = result.deletedExternalId;
          await step.run('delete-data-source', async () => {
            return this.deleteItem(deletedId, connectionId, orgId);
          });
        }

        await step.run('update-sync-time', async () => {
          await this.integrationsService.updateConnection(connectionId, {
            lastSyncedAt: new Date(),
          });
        });

        this.logger.log(`Item processed for connection ${connectionId}`);
      }
    );
  }

  private connectionCleanup() {
    return inngest.createFunction(
      { id: 'connection-cleanup', retries: 5 },
      { event: 'app/connection.cleanup' },
      async ({ event, step }) => {
        const { orgId, connectionId } = event.data;

        // Find all data sources for this connection
        const dataSources = await step.run('find-data-sources', async () => {
          return this.db.kysely
            .selectFrom('data.data_sources')
            .select(['id', 'storage_path'])
            .where('connection_id', '=', connectionId)
            .where('org_id', '=', orgId)
            .execute();
        });

        // Fan-out cleanup events for each data source
        if (dataSources.length > 0) {
          await step.run('fan-out-cleanup', async () => {
            await this.inngestService.sendBulk(
              dataSources.map((ds) => ({
                name: 'app/data-source.cleanup',
                data: {
                  orgId,
                  dataSourceId: ds.id,
                  storagePath: ds.storage_path,
                },
              }))
            );
          });

          this.logger.log(
            `Queued cleanup for ${dataSources.length} data sources of connection ${connectionId}`
          );
        }

        // Delete connection record
        await step.run('delete-connection', async () => {
          await this.db.kysely
            .deleteFrom('integration.connections')
            .where('id', '=', connectionId)
            .where('org_id', '=', orgId)
            .execute();
        });

        this.logger.log(`Connection ${connectionId} cleaned up`);
      }
    );
  }

  private integrationScheduledSync() {
    return inngest.createFunction(
      { id: 'integration-scheduled-sync' },
      { cron: '*/30 * * * *' }, // Every 30 minutes
      async ({ step }) => {
        const connections = await step.run('fetch-active-connections', async () => {
          // org-safe: scheduled sync cron fetches all active connections across orgs
          return this.db.kysely
            .selectFrom('integration.connections')
            .select(['id', 'org_id'])
            .where('status', '=', 'ACTIVE')
            .execute();
        });

        if (connections.length === 0) {
          this.logger.log('No active connections for scheduled sync');
          return;
        }

        await step.run('fan-out-syncs', async () => {
          await this.inngestService.sendBulk(
            connections.map((conn) => ({
              name: 'app/integration.discover',
              data: {
                connectionId: conn.id,
                orgId: conn.org_id,
                trigger: 'SCHEDULED',
              },
            }))
          );
        });

        this.logger.log(`Scheduled sync triggered for ${connections.length} connections`);
      }
    );
  }
}
