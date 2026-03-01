import { BullModule } from '@nestjs/bullmq';
import {
  Global,
  Logger,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
  Optional,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';

import { env } from '../config/env.config';

import { QUEUE_NAMES } from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: env.redisHost,
        port: env.redisPort,
        password: env.redisPassword,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    }),
    ...QUEUE_NAMES.map((name) => BullModule.registerQueue({ name })),
  ],
  exports: [BullModule],
})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueModule.name);
  private boardQueues: Queue[] = [];
  private readonly httpAdapterHost: HttpAdapterHost | null;

  constructor(@Optional() httpAdapterHost?: HttpAdapterHost) {
    this.httpAdapterHost = httpAdapterHost ?? null;
  }

  onModuleInit() {
    if (!this.httpAdapterHost?.httpAdapter) {
      this.logger.log('No HTTP adapter, skipping Bull Board (worker mode)');
      return;
    }

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    const connection = {
      host: env.redisHost,
      port: env.redisPort,
      password: env.redisPassword,
    };

    this.boardQueues = QUEUE_NAMES.map((name) => new Queue(name, { connection }));

    createBullBoard({
      queues: this.boardQueues.map((q) => new BullMQAdapter(q)),
      serverAdapter,
    });

    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const app = httpAdapter.getInstance();
    app.use('/admin/queues', serverAdapter.getRouter());

    this.logger.log(`Bull Board mounted at /admin/queues (${this.boardQueues.length} queues)`);
  }

  async onModuleDestroy() {
    await Promise.all(this.boardQueues.map((q) => q.close()));
  }
}
