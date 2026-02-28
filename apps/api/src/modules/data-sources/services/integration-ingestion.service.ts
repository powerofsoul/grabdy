import { Injectable, Logger } from '@nestjs/common';

import { DbId, dbIdSchema, extractOrgNumericId, packId } from '@grabdy/common';
import type { IntegrationProvider } from '@grabdy/contracts';
import { integrationProviderEnum } from '@grabdy/contracts';
import type { Queue } from 'bullmq';

import { DbService } from '../../../db/db.module';
import { InjectTypedQueue } from '../../../queue/queue.decorators';
import {
  parseProviderData,
  type ProviderData,
  type SyncedItem,
  type SyncResult,
  type WebhookEvent,
} from '../../integrations/connector.interface';
import { IntegrationsService } from '../../integrations/integrations.service';
import { ProviderRegistry } from '../../integrations/provider-registry';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

@Injectable()
export class IntegrationIngestionService {
  private readonly logger = new Logger(IntegrationIngestionService.name);

  constructor(
    private db: DbService,
    private integrationsService: IntegrationsService,
    private providerRegistry: ProviderRegistry,
    @InjectTypedQueue('data-source-cleanup') private cleanupQueue: Queue
  ) {}

  async loadConnectionWithTokens(params: { connectionId: DbId<'Connection'> }): Promise<{
    accessToken: string;
    provider: IntegrationProvider;
    providerData: ProviderData;
    orgId: DbId<'Org'>;
  }> {
    const connectionId = dbIdSchema('Connection').parse(params.connectionId);
    const connection = await this.integrationsService.getConnectionById(connectionId);
    if (!connection) {
      throw new Error(`Connection ${params.connectionId} not found`);
    }

    const entry = this.providerRegistry.get(connection.provider);
    let accessToken = connection.access_token;

    if (connection.token_expires_at && connection.refresh_token) {
      const expiresAt = new Date(connection.token_expires_at).getTime();
      if (expiresAt - Date.now() < TOKEN_REFRESH_BUFFER_MS) {
        this.logger.log(`Refreshing tokens for connection ${params.connectionId}`);
        const newTokens = await entry.oauth.refreshTokens(connection.refresh_token);
        await this.integrationsService.updateConnection(connectionId, {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          tokenExpiresAt: newTokens.expiresAt,
        });
        accessToken = newTokens.accessToken;
      }
    }

    return {
      accessToken,
      provider: connection.provider,
      providerData: parseProviderData(connection.provider_data),
      orgId: connection.org_id,
    };
  }

  async upsertDataSource(params: {
    connectionId: DbId<'Connection'>;
    orgId: DbId<'Org'>;
    item: SyncedItem;
    provider: string;
  }): Promise<DbId<'DataSource'>> {
    const connectionId = dbIdSchema('Connection').parse(params.connectionId);
    const orgId = dbIdSchema('Org').parse(params.orgId);
    const provider = integrationProviderEnum.parse(params.provider);

    const existing = await this.db.kysely
      .selectFrom('data.data_sources')
      .select(['id'])
      .where('connection_id', '=', connectionId)
      .where('external_id', '=', params.item.externalId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (existing) {
      await this.db.kysely
        .updateTable('data.data_sources')
        .set({
          title: params.item.title,
          source_url: params.item.sourceUrl,
          status: params.item.appendOnly ? 'READY' : 'UPLOADED',
          updated_at: new Date(),
        })
        .where('id', '=', existing.id)
        .where('org_id', '=', orgId)
        .execute();

      if (!params.item.appendOnly) {
        await this.db.kysely
          .deleteFrom('data.chunks')
          .where('data_source_id', '=', existing.id)
          .where('org_id', '=', orgId)
          .execute();
      }

      return existing.id;
    }

    const dataSourceId = packId('DataSource', extractOrgNumericId(orgId));

    await this.db.kysely
      .insertInto('data.data_sources')
      .values({
        id: dataSourceId,
        title: params.item.title,
        mime_type: 'text/plain',
        file_size: Buffer.byteLength(params.item.content, 'utf-8'),
        storage_path: '',
        type: provider,
        status: 'UPLOADED',
        connection_id: connectionId,
        external_id: params.item.externalId,
        source_url: params.item.sourceUrl,
        org_id: orgId,
        uploaded_by_id: null,
        updated_at: new Date(),
      })
      .execute();

    return dataSourceId;
  }

  async deleteDataSourceByExternalId(params: {
    connectionId: DbId<'Connection'>;
    orgId: DbId<'Org'>;
    externalId: string;
  }): Promise<void> {
    const connectionId = dbIdSchema('Connection').parse(params.connectionId);
    const orgId = dbIdSchema('Org').parse(params.orgId);

    const existing = await this.db.kysely
      .selectFrom('data.data_sources')
      .select('id')
      .where('connection_id', '=', connectionId)
      .where('external_id', '=', params.externalId)
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

  async updateProviderData(params: {
    connectionId: DbId<'Connection'>;
    providerData: ProviderData;
  }): Promise<void> {
    const connectionId = dbIdSchema('Connection').parse(params.connectionId);
    await this.integrationsService.updateConnection(connectionId, {
      providerData: params.providerData,
    });
  }

  async updateLastSynced(params: { connectionId: DbId<'Connection'> }): Promise<void> {
    const connectionId = dbIdSchema('Connection').parse(params.connectionId);
    await this.integrationsService.updateConnection(connectionId, {
      lastSyncedAt: new Date(),
    });
  }

  async markConnectionDisconnected(params: { connectionId: DbId<'Connection'> }): Promise<void> {
    const connectionId = dbIdSchema('Connection').parse(params.connectionId);
    await this.integrationsService.updateConnection(connectionId, {
      status: 'DISCONNECTED',
    });
  }

  async runConnectorSync(params: {
    accessToken: string;
    provider: string;
    providerData: ProviderData;
    connectionId: DbId<'Connection'>;
    orgId: DbId<'Org'>;
  }): Promise<SyncResult> {
    const connectionId = dbIdSchema('Connection').parse(params.connectionId);
    const orgId = dbIdSchema('Org').parse(params.orgId);
    const provider = integrationProviderEnum.parse(params.provider);
    const entry = this.providerRegistry.get(provider);
    return entry.sync.sync(params.accessToken, params.providerData, {
      connectionId,
      orgId,
    });
  }

  async runWebhookFetchItem(params: {
    accessToken: string;
    provider: string;
    providerData: ProviderData;
    event: WebhookEvent;
  }): Promise<{ item: SyncedItem | null; deletedExternalId: string | null }> {
    const provider = integrationProviderEnum.parse(params.provider);
    const entry = this.providerRegistry.get(provider);
    return entry.webhook.fetchItem(params.accessToken, params.providerData, params.event);
  }

  async listDataSourcesByConnection(params: {
    connectionId: DbId<'Connection'>;
    orgId: DbId<'Org'>;
  }): Promise<Array<{ id: string; storagePath: string }>> {
    const connectionId = dbIdSchema('Connection').parse(params.connectionId);
    const orgId = dbIdSchema('Org').parse(params.orgId);

    const rows = await this.db.kysely
      .selectFrom('data.data_sources')
      .select(['id', 'storage_path'])
      .where('connection_id', '=', connectionId)
      .where('org_id', '=', orgId)
      .execute();

    return rows.map((r) => ({ id: r.id, storagePath: r.storage_path }));
  }

  async enqueueDataSourceCleanup(params: {
    orgId: DbId<'Org'>;
    dataSources: Array<{ id: string; storagePath: string }>;
  }): Promise<void> {
    if (params.dataSources.length === 0) return;

    await this.cleanupQueue.addBulk(
      params.dataSources.map((ds) => ({
        name: 'cleanup',
        data: {
          orgId: params.orgId,
          dataSourceId: ds.id,
          storagePath: ds.storagePath,
        },
      }))
    );
  }

  async deleteConnection(params: {
    connectionId: DbId<'Connection'>;
    orgId: DbId<'Org'>;
  }): Promise<void> {
    const connectionId = dbIdSchema('Connection').parse(params.connectionId);
    const orgId = dbIdSchema('Org').parse(params.orgId);

    await this.db.kysely
      .deleteFrom('integration.connections')
      .where('id', '=', connectionId)
      .where('org_id', '=', orgId)
      .execute();
  }
}
