import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { chunkMetaSchema } from '@grabdy/contracts';
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

    // Collect image storage keys before deleting chunks
    const chunks = await this.db.kysely
      .selectFrom('data.chunks')
      .select('metadata')
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .execute();

    const imageKeys: string[] = [];
    for (const chunk of chunks) {
      const parsed = chunkMetaSchema.safeParse(chunk.metadata);
      if (parsed.success && parsed.data.type === 'PDF' && parsed.data.imageStorageKey) {
        imageKeys.push(parsed.data.imageStorageKey);
      }
    }

    await this.db.kysely
      .deleteFrom('data.chunks')
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .execute();

    if (imageKeys.length > 0) {
      await Promise.all(imageKeys.map((key) => this.storage.delete(key).catch(() => {})));
    }

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
