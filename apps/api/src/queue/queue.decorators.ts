import { InjectQueue } from '@nestjs/bullmq';

import type { QueueName } from './queue.constants';

/**
 * Type-safe version of @InjectQueue that only accepts known queue names.
 */
export const InjectTypedQueue = (name: QueueName): ReturnType<typeof InjectQueue> =>
  InjectQueue(name);
