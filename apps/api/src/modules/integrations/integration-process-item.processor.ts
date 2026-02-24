import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { extractOrgNumericId, packId } from '@grabdy/common';
import type { Job } from 'bullmq';

import { DbService } from '../../db/db.module';
import type { DataSourceJobData } from '../data-sources/data-source.types';
import { DataSourceDispatchService } from '../data-sources/data-source-dispatch.service';

import { ProviderRegistry } from './providers/provider-registry';
import { parseProviderData } from './connector.interface';
import { IntegrationsService } from './integrations.service';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

@Processor('integration-process-item', { concurrency: 10 })
export class IntegrationProcessItemProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationProcessItemProcessor.name);

  constructor(
    private db: DbService,
    private providerRegistry: ProviderRegistry,
    private integrationsService: IntegrationsService,
    private dataSourceDispatch: DataSourceDispatchService
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { connectionId, orgId, event: webhookEvent } = job.data;
    this.logger.log(
      `Processing item for connection ${connectionId}: ${webhookEvent.action} ${webhookEvent.externalId}`
    );

    const { accessToken, connection } = await this.loadConnection(connectionId);

    const providerData = parseProviderData(connection.provider_data);
    const connector = this.providerRegistry.getConnector(connection.provider);
    const result = await connector.processWebhookItem(accessToken, providerData, webhookEvent);

    if (result.item) {
      const existing = await this.db.kysely
        .selectFrom('data.data_sources')
        .select(['id', 'title'])
        .where('connection_id', '=', connectionId)
        .where('external_id', '=', result.item.externalId)
        .where('org_id', '=', orgId)
        .executeTakeFirst();

      if (existing) {
        await this.db.kysely
          .updateTable('data.data_sources')
          .set({
            title: result.item.title,
            source_url: result.item.sourceUrl,
            status: result.item.appendOnly ? 'READY' : 'UPLOADED',
            updated_at: new Date(),
          })
          .where('id', '=', existing.id)
          .where('org_id', '=', orgId)
          .execute();

        if (!result.item.appendOnly) {
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
          content: result.item.content,
          messages: result.item.messages,
          sourceUrl: result.item.sourceUrl,
          appendOnly: result.item.appendOnly,
        };
        await this.dataSourceDispatch.dispatch(jobData);
      } else {
        const dataSourceId = packId('DataSource', extractOrgNumericId(orgId));

        await this.db.kysely
          .insertInto('data.data_sources')
          .values({
            id: dataSourceId,
            title: result.item.title,
            mime_type: 'text/plain',
            file_size: Buffer.byteLength(result.item.content, 'utf-8'),
            storage_path: '',
            type: connection.provider,
            status: 'UPLOADED',
            connection_id: connectionId,
            external_id: result.item.externalId,
            source_url: result.item.sourceUrl,
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
          content: result.item.content,
          messages: result.item.messages,
          sourceUrl: result.item.sourceUrl,
        };
        await this.dataSourceDispatch.dispatch(jobData);
      }
    }

    if (result.deletedExternalId) {
      const existing = await this.db.kysely
        .selectFrom('data.data_sources')
        .select('id')
        .where('connection_id', '=', connectionId)
        .where('external_id', '=', result.deletedExternalId)
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

    await this.integrationsService.updateConnection(connectionId, {
      lastSyncedAt: new Date(),
    });

    this.logger.log(`Item processed for connection ${connectionId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
  }

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
}
