import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { packId } from '@grabdy/common';
import type { Job } from 'bullmq';

import { DbService } from '../../db/db.module';

@Processor('ai-usage', { concurrency: 10 })
export class AiUsageProcessor extends WorkerHost {
  private readonly logger = new Logger(AiUsageProcessor.name);

  constructor(private readonly db: DbService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const data = job.data;

    const values = {
      id: packId('AiUsageLog', data.orgId),
      model: data.model,
      provider: data.provider,
      caller_type: data.callerType,
      request_type: data.requestType,
      source: data.source,
      input_tokens: data.inputTokens,
      output_tokens: data.outputTokens,
      total_tokens: data.totalTokens,
      cost: data.cost,
      duration_ms: data.durationMs,
      finish_reason: data.finishReason,
      streaming: data.streaming,
      org_id: data.orgId,
      user_id: data.userId,
      description: data.description ?? null,
    };

    await this.db.kysely.insertInto('analytics.ai_usage_logs').values(values).execute();

    this.logger.debug('AI usage record inserted');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
  }
}
