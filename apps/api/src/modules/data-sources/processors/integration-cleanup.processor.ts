import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { Job } from 'bullmq';

import { IntegrationIngestionService } from '../services/integration-ingestion.service';

import type { IntegrationCleanupJobData } from './job-data.types';

@Processor('integration-cleanup', { concurrency: 3 })
export class IntegrationCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationCleanupProcessor.name);

  constructor(private integrationIngestion: IntegrationIngestionService) {
    super();
  }

  async process(job: Job<IntegrationCleanupJobData>): Promise<void> {
    const { connectionId, orgId } = job.data;

    const dataSources = await this.integrationIngestion.listDataSourcesByConnection({
      connectionId,
      orgId,
    });

    if (dataSources.length > 0) {
      await this.integrationIngestion.enqueueDataSourceCleanup({
        orgId,
        dataSources,
      });
    }

    await this.integrationIngestion.deleteConnection({
      connectionId,
      orgId,
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
  }
}
