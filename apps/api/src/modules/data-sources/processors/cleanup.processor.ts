import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { Job } from 'bullmq';

import { DbService } from '../../../db/db.module';
import { S3FileStorage } from '../../storage/s3-file-storage';

@Processor('data-source-cleanup', { concurrency: 5 })
export class DataSourceCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(DataSourceCleanupProcessor.name);

  constructor(
    private db: DbService,
    private storage: S3FileStorage
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { orgId, dataSourceId, storagePath } = job.data;

    await this.db.kysely
      .deleteFrom('data.chunks')
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .execute();

    if (storagePath) {
      await this.storage.delete(storagePath);
    }

    await this.db.kysely
      .deleteFrom('data.data_sources')
      .where('id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .execute();
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
  }
}
