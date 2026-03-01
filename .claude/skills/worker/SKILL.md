---
name: worker
description: Scaffold a BullMQ background job with queue registration, processor, and payload types. Use when user says "new worker", "background job", "queue processor", "add queue", "bullmq job", or "async task".
disable-model-invocation: false
argument-hint: '[job description]'
---

# BullMQ Worker Scaffolder

## Step 1: Understand the job

From `$ARGUMENTS`, determine:

- Job purpose and when it's triggered
- Input data (payload type)
- Whether it calls AI SDK functions (requires AiUsageService)
- Concurrency needs and retry strategy

## Step 2: Register the queue name

File: `apps/api/src/queue/queue.constants.ts`

Add the new queue name to the `QUEUE_NAMES` array. Use kebab-case.

## Step 3: Create the processor

File: `apps/api/src/modules/{domain}/{domain}.processor.ts`

```typescript
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

interface JobPayload {
  orgId: string;
  // ... typed fields
}

@Processor('queue-name', { concurrency: 3 })
export class DomainProcessor extends WorkerHost {
  private readonly logger = new Logger(DomainProcessor.name);

  constructor(
    private db: DbService
    // If AI: private aiUsageService: AiUsageService,
  ) {
    super();
  }

  async process(job: Job<JobPayload>): Promise<void> {
    const { orgId } = job.data;
    this.logger.log(`Processing job ${job.name} (${job.id})`);

    // Job logic here

    this.logger.log(`Completed job ${job.name} (${job.id})`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
  }
}
```

## Step 4: Register in module

Add the processor to the module's `providers` array.

## Step 5: Add the producer

In the service that queues jobs:

```typescript
constructor(@InjectTypedQueue('queue-name') private myQueue: Queue) {}

async triggerJob(data: JobPayload): Promise<void> {
  await this.myQueue.add('job-name', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}
```

## Rules

- Queue names typed in `QUEUE_NAMES` constant array
- Processor extends `WorkerHost`, uses `@Processor('name', { concurrency: N })`
- Use `@OnWorkerEvent('failed')` for error logging
- If calling AI SDK: inject `AiUsageService` and call `logUsage()` after every AI call
- Jobs must be idempotent (safe to retry)
- Use `@InjectTypedQueue('name')` for type-safe queue injection
- Log job start and completion with job ID
