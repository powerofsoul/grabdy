import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';

import type { Job, Queue } from 'bullmq';

import { DbService } from '../../db/db.module';
import { InjectTypedQueue } from '../../queue/queue.decorators';

@Processor('integration-scheduled-sync', { concurrency: 1 })
export class IntegrationScheduledSyncProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(IntegrationScheduledSyncProcessor.name);

  constructor(
    private db: DbService,
    @InjectTypedQueue('integration-discover') private discoverQueue: Queue,
    @InjectTypedQueue('integration-scheduled-sync') private scheduledSyncQueue: Queue
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // Remove stale repeatable jobs before registering (handles cron pattern changes)
    const existing = await this.scheduledSyncQueue.getRepeatableJobs();
    for (const job of existing) {
      if (job.name === 'scheduled-sync') {
        await this.scheduledSyncQueue.removeRepeatableByKey(job.key);
      }
    }

    await this.scheduledSyncQueue.add(
      'scheduled-sync',
      {},
      {
        repeat: { pattern: '*/30 * * * *' },
      }
    );
    this.logger.log('Registered repeatable job: scheduled-sync (every 30 min)');
  }

  async process(_job: Job): Promise<void> {
    // org-safe: scheduled sync cron fetches all active connections across orgs
    const connections = await this.db.kysely
      .selectFrom('integration.connections')
      .select(['id', 'org_id'])
      .where('status', '=', 'ACTIVE')
      .execute();

    if (connections.length === 0) {
      this.logger.log('No active connections for scheduled sync');
      return;
    }

    // Remove completed/failed discover jobs so static jobIds can be re-enqueued
    for (const conn of connections) {
      const jobId = `discover-${conn.id}`;
      const existing = await this.discoverQueue.getJob(jobId);
      const state = await existing?.getState();
      if (state === 'completed' || state === 'failed') {
        await existing?.remove();
      }
    }

    await this.discoverQueue.addBulk(
      connections.map((conn) => ({
        name: 'discover',
        data: {
          connectionId: conn.id,
          orgId: conn.org_id,
          trigger: 'SCHEDULED',
        },
        opts: { jobId: `discover-${conn.id}` },
      }))
    );

    this.logger.log(`Scheduled sync triggered for ${connections.length} connections`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
  }
}
