import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { env } from '../../config/env.config';

import { DataSourceProcessor } from './processors/data-source.processor';
import { DATA_SOURCE_QUEUE } from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: env.redisHost,
        port: env.redisPort,
        password: env.redisPassword,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 86400, count: 200 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),
    BullModule.registerQueue({ name: DATA_SOURCE_QUEUE }),
  ],
  providers: [DataSourceProcessor],
  exports: [BullModule],
})
export class QueueModule {}
