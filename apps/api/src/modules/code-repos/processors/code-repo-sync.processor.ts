import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { Job } from 'bullmq';

import { DbService } from '../../../db/db.module';
import { CODE_REPO_QUEUE } from '../../queue/queue.constants';
import { CodeIndexerSpawnerService } from '../services/code-indexer-spawner.service';

export interface CodeRepoSyncJobData {
  dataSourceId: DbId<'DataSource'>;
  orgId: DbId<'Org'>;
  repoFullName: string;
  branch: string;
  connectionId: DbId<'Connection'>;
  mode: 'full' | 'incremental';
}

@Processor(CODE_REPO_QUEUE, { concurrency: 2 })
export class CodeRepoSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(CodeRepoSyncProcessor.name);

  constructor(
    private spawner: CodeIndexerSpawnerService,
    private db: DbService
  ) {
    super();
  }

  async process(job: Job<CodeRepoSyncJobData>): Promise<void> {
    const { data } = job;
    this.logger.log(`Processing code repo sync: ${data.repoFullName} (${data.mode})`);

    try {
      await this.spawner.spawn(data);
      this.logger.log(`Spawned indexer for ${data.repoFullName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to spawn indexer for ${data.repoFullName}: ${message}`);
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<CodeRepoSyncJobData>) {
    this.logger.warn(
      `Job ${job.id} exhausted retries for ${job.data.repoFullName}, resetting status to FAILED`
    );
    await this.db.kysely
      .updateTable('data.data_sources')
      .set({ status: 'FAILED', updated_at: new Date() })
      .where('id', '=', job.data.dataSourceId)
      .where('org_id', '=', job.data.orgId)
      .where('status', '=', 'PROCESSING')
      .execute();
  }
}
