import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { Job } from 'bullmq';

import { DbService } from '../../../db/db.module';
import { S3FileStorage } from '../../storage/s3-file-storage';
import { findDescendants } from '../find-descendants';

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

    // Collect ALL descendant DS storage paths (recursive: PST -> Email -> Attachment)
    const descendants = await findDescendants(this.db.kysely, orgId, dataSourceId);

    // Delete chunks for parent and all descendants
    const allDsIds = [dataSourceId, ...descendants.map((c) => c.id)];
    await this.db.kysely
      .deleteFrom('data.chunks')
      .where('data_source_id', 'in', allDsIds)
      .where('org_id', '=', orgId)
      .execute();

    // Delete parent DS (children cascade via FK)
    await this.db.kysely
      .deleteFrom('data.data_sources')
      .where('id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .execute();

    // Clean up S3: source files + extracted images for parent and all descendants
    const s3Deletes: Promise<void>[] = [];

    if (storagePath) s3Deletes.push(this.storage.delete(storagePath));
    s3Deletes.push(this.storage.deletePrefix(`${orgId}/extracted-images/${dataSourceId}/`));

    for (const child of descendants) {
      if (child.storage_path) s3Deletes.push(this.storage.delete(child.storage_path));
      s3Deletes.push(this.storage.deletePrefix(`${orgId}/extracted-images/${child.id}/`));
    }

    const results = await Promise.allSettled(s3Deletes);
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.warn(`S3 cleanup failed: ${result.reason}`);
      }
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
  }
}
