import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { Job } from 'bullmq';

import { EnrichmentService } from '../services/enrichment.service';
import { IntegrationIngestionService } from '../services/integration-ingestion.service';
import { FileIngestionService } from '../sources/file/file-ingestion.service';

import type { IntegrationWebhookJobData } from './job-data.types';

@Processor('integration-webhook', { concurrency: 10 })
export class IntegrationWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationWebhookProcessor.name);

  constructor(
    private integrationIngestion: IntegrationIngestionService,
    private fileIngestion: FileIngestionService,
    private enrichment: EnrichmentService
  ) {
    super();
  }

  async process(job: Job<IntegrationWebhookJobData>): Promise<void> {
    const { connectionId, orgId, event } = job.data;

    const conn = await this.integrationIngestion.loadConnectionWithTokens({ connectionId });

    const result = await this.integrationIngestion.runWebhookFetchItem({
      accessToken: conn.accessToken,
      provider: conn.provider,
      providerData: conn.providerData,
      event,
    });

    if (result.item) {
      const dataSourceId = await this.integrationIngestion.upsertDataSource({
        connectionId,
        orgId,
        item: result.item,
        provider: conn.provider,
      });

      const { chunks: rawChunks } = await this.fileIngestion.extractContent({
        dataSourceId,
        orgId,
        storagePath: '',
        mimeType: 'text/plain',
        content: result.item.content,
        messages: result.item.messages,
        sourceUrl: result.item.sourceUrl,
      });

      const chunks = await this.enrichment.enrichChunks({
        orgId,
        chunks: rawChunks,
        title: result.item.sourceUrl ?? '',
      });

      await this.fileIngestion.deleteChunks({ dataSourceId, orgId });
      await this.fileIngestion.embedAndStore({
        chunks,
        chunkIndexOffset: 0,
        dataSourceId,
        collectionId: null,
        orgId,
        progressBase: 15,
      });

      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId,
        status: 'READY',
        progress: 100,
      });
    }

    if (result.deletedExternalId) {
      await this.integrationIngestion.deleteDataSourceByExternalId({
        connectionId,
        orgId,
        externalId: result.deletedExternalId,
      });
    }

    await this.integrationIngestion.updateLastSynced({ connectionId });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
  }
}
