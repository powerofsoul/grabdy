import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { Job } from 'bullmq';

import { EnrichmentService } from '../services/enrichment.service';
import { IntegrationIngestionService } from '../services/integration-ingestion.service';
import { FileIngestionService } from '../sources/file/file-ingestion.service';
import { SlackIngestionService } from '../sources/slack/slack-ingestion.service';

import type { IntegrationSyncJobData } from './job-data.types';

const MAX_SYNC_PAGES = 100;

@Processor('integration-sync', { concurrency: 3 })
export class IntegrationSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationSyncProcessor.name);

  constructor(
    private integrationIngestion: IntegrationIngestionService,
    private slackIngestion: SlackIngestionService,
    private fileIngestion: FileIngestionService,
    private enrichment: EnrichmentService
  ) {
    super();
  }

  async process(job: Job<IntegrationSyncJobData>): Promise<void> {
    switch (job.name) {
      case 'slack':
        await this.syncSlack(job.data);
        break;
      case 'github':
      case 'linear':
        await this.syncPaginated(job.data, job.name);
        break;
      case 'notion':
        await this.syncNotion(job.data);
        break;
      default:
        this.logger.warn(`Unknown sync job name: ${job.name}`);
    }
  }

  private async syncSlack(data: IntegrationSyncJobData): Promise<void> {
    const conn = await this.integrationIngestion.loadConnectionWithTokens({
      connectionId: data.connectionId,
    });

    if (conn.providerData.provider !== 'SLACK') {
      throw new Error('Expected SLACK provider data');
    }

    const selectedIds = conn.providerData.selectedChannels ?? [];
    if (selectedIds.length > 0) {
      await this.slackIngestion.joinSlackChannels({
        accessToken: conn.accessToken,
        channels: selectedIds,
      });
    }

    const channels = await this.slackIngestion.fetchSlackMemberChannels({
      accessToken: conn.accessToken,
    });

    for (const channel of channels) {
      const channelConn = await this.integrationIngestion.loadConnectionWithTokens({
        connectionId: data.connectionId,
      });

      if (channelConn.providerData.provider !== 'SLACK') {
        throw new Error('Expected SLACK provider data');
      }

      const result = await this.slackIngestion.fetchSlackChannelMessages({
        accessToken: channelConn.accessToken,
        channel,
        providerData: channelConn.providerData,
      });

      if (result.newTimestamp) {
        const updatedTimestamps = { ...channelConn.providerData.channelTimestamps };
        updatedTimestamps[channel.id] = result.newTimestamp;
        await this.integrationIngestion.updateProviderData({
          connectionId: data.connectionId,
          providerData: { ...channelConn.providerData, channelTimestamps: updatedTimestamps },
        });
      }

      if (!result.item) continue;

      const dataSourceId = await this.integrationIngestion.upsertDataSource({
        connectionId: data.connectionId,
        orgId: data.orgId,
        item: result.item,
        provider: 'SLACK',
      });

      const { chunks: rawChunks } = await this.fileIngestion.extractContent({
        dataSourceId,
        orgId: data.orgId,
        storagePath: '',
        mimeType: 'text/plain',
        content: result.item.content,
        messages: result.item.messages,
        sourceUrl: result.item.sourceUrl,
      });

      const chunks = await this.enrichment.enrichChunks({
        orgId: data.orgId,
        chunks: rawChunks,
        title: result.item.title,
      });

      let chunkIndexOffset = 0;
      if (result.item.appendOnly) {
        chunkIndexOffset = await this.fileIngestion.getChunkOffset({
          dataSourceId,
          orgId: data.orgId,
        });
      } else {
        await this.fileIngestion.deleteChunks({ dataSourceId, orgId: data.orgId });
      }

      await this.fileIngestion.embedAndStore({
        chunks,
        chunkIndexOffset,
        dataSourceId,
        collectionId: null,
        orgId: data.orgId,
        progressBase: 15,
      });

      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId: data.orgId,
        status: 'READY',
        progress: 100,
      });
    }

    await this.integrationIngestion.updateLastSynced({ connectionId: data.connectionId });
  }

  private async syncPaginated(data: IntegrationSyncJobData, provider: string): Promise<void> {
    const conn = await this.integrationIngestion.loadConnectionWithTokens({
      connectionId: data.connectionId,
    });

    let currentProviderData = conn.providerData;
    let hasMore = true;
    let page = 0;

    while (hasMore) {
      if (++page > MAX_SYNC_PAGES) {
        throw new Error(
          `${provider} sync exceeded ${MAX_SYNC_PAGES} pages, aborting to prevent infinite loop`
        );
      }

      const result = await this.integrationIngestion.runConnectorSync({
        accessToken: conn.accessToken,
        provider: conn.provider,
        providerData: currentProviderData,
        connectionId: data.connectionId,
        orgId: data.orgId,
      });

      if (result.type !== 'items') {
        throw new Error(`${provider} sync expected items result, got ${result.type}`);
      }

      for (const item of result.items) {
        const dataSourceId = await this.integrationIngestion.upsertDataSource({
          connectionId: data.connectionId,
          orgId: data.orgId,
          item,
          provider: conn.provider,
        });

        const { chunks: rawChunks } = await this.fileIngestion.extractContent({
          dataSourceId,
          orgId: data.orgId,
          storagePath: '',
          mimeType: 'text/plain',
          content: item.content,
          messages: item.messages,
          sourceUrl: item.sourceUrl,
        });

        const chunks = await this.enrichment.enrichChunks({
          orgId: data.orgId,
          chunks: rawChunks,
          title: item.title,
        });

        if (!item.appendOnly) {
          await this.fileIngestion.deleteChunks({ dataSourceId, orgId: data.orgId });
        }

        const chunkOffset = item.appendOnly
          ? await this.fileIngestion.getChunkOffset({ dataSourceId, orgId: data.orgId })
          : 0;

        await this.fileIngestion.embedAndStore({
          chunks,
          chunkIndexOffset: chunkOffset,
          dataSourceId,
          collectionId: null,
          orgId: data.orgId,
          progressBase: 15,
        });

        await this.fileIngestion.updateDataSourceStatus({
          dataSourceId,
          orgId: data.orgId,
          status: 'READY',
          progress: 100,
        });
      }

      for (const deletedId of result.deletedExternalIds) {
        await this.integrationIngestion.deleteDataSourceByExternalId({
          connectionId: data.connectionId,
          orgId: data.orgId,
          externalId: deletedId,
        });
      }

      currentProviderData = result.updatedProviderData;
      hasMore = result.hasMore;

      await this.integrationIngestion.updateProviderData({
        connectionId: data.connectionId,
        providerData: currentProviderData,
      });
    }

    await this.integrationIngestion.updateLastSynced({ connectionId: data.connectionId });
  }

  private async syncNotion(data: IntegrationSyncJobData): Promise<void> {
    const conn = await this.integrationIngestion.loadConnectionWithTokens({
      connectionId: data.connectionId,
    });

    const result = await this.integrationIngestion.runConnectorSync({
      accessToken: conn.accessToken,
      provider: conn.provider,
      providerData: conn.providerData,
      connectionId: data.connectionId,
      orgId: data.orgId,
    });

    if (result.type !== 'events') {
      throw new Error(`Notion sync expected events result, got ${result.type}`);
    }

    for (const event of result.events) {
      const eventConn = await this.integrationIngestion.loadConnectionWithTokens({
        connectionId: data.connectionId,
      });

      const fetchResult = await this.integrationIngestion.runWebhookFetchItem({
        accessToken: eventConn.accessToken,
        provider: eventConn.provider,
        providerData: eventConn.providerData,
        event,
      });

      if (fetchResult.item) {
        const dataSourceId = await this.integrationIngestion.upsertDataSource({
          connectionId: data.connectionId,
          orgId: data.orgId,
          item: fetchResult.item,
          provider: eventConn.provider,
        });

        const { chunks: rawChunks } = await this.fileIngestion.extractContent({
          dataSourceId,
          orgId: data.orgId,
          storagePath: '',
          mimeType: 'text/plain',
          content: fetchResult.item.content,
          messages: fetchResult.item.messages,
          sourceUrl: fetchResult.item.sourceUrl,
        });

        const chunks = await this.enrichment.enrichChunks({
          orgId: data.orgId,
          chunks: rawChunks,
          title: fetchResult.item.title,
        });

        await this.fileIngestion.deleteChunks({ dataSourceId, orgId: data.orgId });
        await this.fileIngestion.embedAndStore({
          chunks,
          chunkIndexOffset: 0,
          dataSourceId,
          collectionId: null,
          orgId: data.orgId,
          progressBase: 15,
        });

        await this.fileIngestion.updateDataSourceStatus({
          dataSourceId,
          orgId: data.orgId,
          status: 'READY',
          progress: 100,
        });
      }

      if (fetchResult.deletedExternalId) {
        await this.integrationIngestion.deleteDataSourceByExternalId({
          connectionId: data.connectionId,
          orgId: data.orgId,
          externalId: fetchResult.deletedExternalId,
        });
      }
    }

    for (const deletedId of result.deletedExternalIds) {
      await this.integrationIngestion.deleteDataSourceByExternalId({
        connectionId: data.connectionId,
        orgId: data.orgId,
        externalId: deletedId,
      });
    }

    await this.integrationIngestion.updateProviderData({
      connectionId: data.connectionId,
      providerData: result.updatedProviderData,
    });

    await this.integrationIngestion.updateLastSynced({ connectionId: data.connectionId });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
  }
}
