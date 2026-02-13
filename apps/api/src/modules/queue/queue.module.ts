import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import {
  JOB_BACKOFF_DELAY_MS,
  JOB_MAX_ATTEMPTS,
  JOB_REMOVE_ON_COMPLETE_AGE_S,
  JOB_REMOVE_ON_COMPLETE_COUNT,
  JOB_REMOVE_ON_FAIL_AGE_S,
  JOB_REMOVE_ON_FAIL_COUNT,
} from '../../config/constants';
import { env } from '../../config/env.config';

import { CanvasOpsProcessor } from './processors/canvas-ops.processor';
import { DataSourceProcessor } from './processors/data-source.processor';
import { CanvasOpsService } from './canvas-ops.service';
import { CANVAS_OPS_QUEUE, DATA_SOURCE_QUEUE, INTEGRATION_SYNC_QUEUE } from './queue.constants';

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
        removeOnComplete: {
          age: JOB_REMOVE_ON_COMPLETE_AGE_S,
          count: JOB_REMOVE_ON_COMPLETE_COUNT,
        },
        removeOnFail: { age: JOB_REMOVE_ON_FAIL_AGE_S, count: JOB_REMOVE_ON_FAIL_COUNT },
        attempts: JOB_MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: JOB_BACKOFF_DELAY_MS },
      },
    }),
    BullModule.registerQueue({ name: DATA_SOURCE_QUEUE }),
    BullModule.registerQueue({ name: CANVAS_OPS_QUEUE }),
    BullModule.registerQueue({ name: INTEGRATION_SYNC_QUEUE }),
  ],
  providers: [DataSourceProcessor, CanvasOpsProcessor, CanvasOpsService],
  exports: [BullModule, CanvasOpsService],
})
export class QueueModule {}
