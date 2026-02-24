import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { Job, Queue } from 'bullmq';

import { DbService } from '../../db/db.module';
import { InjectTypedQueue } from '../../queue/queue.decorators';

@Processor('integration-cleanup', { concurrency: 5 })
export class IntegrationCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationCleanupProcessor.name);

  constructor(
    private db: DbService,
    @InjectTypedQueue('data-source-cleanup') private cleanupQueue: Queue
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { orgId, connectionId } = job.data;

    const dataSources = await this.db.kysely
      .selectFrom('data.data_sources')
      .select(['id', 'storage_path'])
      .where('connection_id', '=', connectionId)
      .where('org_id', '=', orgId)
      .execute();

    if (dataSources.length > 0) {
      await this.cleanupQueue.addBulk(
        dataSources.map((ds) => ({
          name: 'cleanup',
          data: {
            orgId,
            dataSourceId: ds.id,
            storagePath: ds.storage_path,
          },
        }))
      );

      this.logger.log(
        `Queued cleanup for ${dataSources.length} data sources of connection ${connectionId}`
      );
    }

    await this.db.kysely
      .deleteFrom('integration.connections')
      .where('id', '=', connectionId)
      .where('org_id', '=', orgId)
      .execute();

    this.logger.log(`Connection ${connectionId} cleaned up`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
  }
}
