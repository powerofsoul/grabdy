import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  RequestTimeoutException,
} from '@nestjs/common';

import type { CanvasState } from '@grabdy/contracts';
import { Queue, QueueEvents } from 'bullmq';

import { env } from '../../config/env.config';

import { NOT_FOUND_PREFIX } from './processors/canvas-ops.processor';
import type { CanvasOp } from './processors/canvas-ops.types';
import { CANVAS_OPS_QUEUE } from './queue.constants';

@Injectable()
export class CanvasOpsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CanvasOpsService.name);
  private queueEvents: QueueEvents;

  constructor(@InjectQueue(CANVAS_OPS_QUEUE) private queue: Queue) {
    this.queueEvents = new QueueEvents(CANVAS_OPS_QUEUE, {
      connection: {
        host: env.redisHost,
        port: env.redisPort,
        password: env.redisPassword,
        maxRetriesPerRequest: null,
      },
    });
  }

  async onModuleInit() {
    await this.queueEvents.waitUntilReady();
    this.logger.log('Canvas ops QueueEvents ready');
  }

  async onModuleDestroy() {
    await this.queueEvents.close();
  }

  async execute(op: CanvasOp): Promise<CanvasState> {
    this.logger.debug(`Enqueuing canvas op: ${op.type} for thread ${op.threadId}`);
    const job = await this.queue.add(op.type, op, { attempts: 1 });
    this.logger.debug(`Job ${job.id} enqueued, waiting for result...`);

    try {
      const result = await job.waitUntilFinished(this.queueEvents, 15_000);
      this.logger.debug(
        `Job ${job.id} finished with ${(result satisfies CanvasState).cards.length} cards`,
      );
      return result satisfies CanvasState;
    } catch (err) {
      // BullMQ serializes processor errors as plain Error, losing the class.
      // The processor uses a NOT_FOUND_PREFIX so we can reliably re-throw.
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Canvas op ${op.type} failed (job ${job.id}): ${msg}`);

      if (msg.startsWith(NOT_FOUND_PREFIX)) {
        throw new NotFoundException(msg.slice(NOT_FOUND_PREFIX.length));
      }
      if (msg.includes('timed out')) {
        throw new RequestTimeoutException('Canvas operation timed out');
      }
      throw err;
    }
  }
}
