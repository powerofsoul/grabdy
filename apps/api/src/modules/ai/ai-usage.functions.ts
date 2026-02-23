import { Logger } from '@nestjs/common';

import { packId } from '@grabdy/common';

import { DbService } from '../../db/db.module';
import { inngest } from '../../inngest/inngest.client';
import { InngestFunctions } from '../../inngest/inngest.decorator';

@InngestFunctions()
export class AiUsageFunctions {
  private readonly logger = new Logger(AiUsageFunctions.name);

  constructor(private db: DbService) {}

  definitions() {
    return [this.aiUsageLog()];
  }

  private aiUsageLog() {
    return inngest.createFunction(
      {
        id: 'ai-usage-log',
        batchEvents: { maxSize: 50, timeout: '5s' },
        retries: 3,
      },
      { event: 'app/ai-usage.log' },
      async ({ events, step }) => {
        await step.run('batch-insert', async () => {
          const values = events.map((evt) => ({
            id: packId('AiUsageLog', evt.data.orgId),
            model: evt.data.model,
            provider: evt.data.provider,
            caller_type: evt.data.callerType,
            request_type: evt.data.requestType,
            source: evt.data.source,
            input_tokens: evt.data.inputTokens,
            output_tokens: evt.data.outputTokens,
            total_tokens: evt.data.totalTokens,
            cost: evt.data.cost,
            duration_ms: evt.data.durationMs,
            finish_reason: evt.data.finishReason,
            streaming: evt.data.streaming,
            org_id: evt.data.orgId,
            user_id: evt.data.userId,
          }));

          await this.db.kysely.insertInto('analytics.ai_usage_logs').values(values).execute();

          this.logger.log(`Batch-inserted ${values.length} AI usage records`);
        });
      }
    );
  }
}
