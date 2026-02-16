import { Injectable, Logger } from '@nestjs/common';

import { type DbId, packId } from '@grabdy/common';
import {
  type AiCallerType,
  type AiRequestSource,
  type AiRequestType,
  calculateCost,
  MODEL_INFO,
  type ModelId,
} from '@grabdy/contracts';

import { DbService } from '../../db/db.module';

export interface UsageContext {
  orgId: DbId<'Org'>;
  userId?: DbId<'User'> | null;
  source: AiRequestSource;
}

interface UsageExtras {
  durationMs?: number;
  streaming?: boolean;
  finishReason?: string;
}

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(private db: DbService) {}

  async logUsage(
    model: ModelId,
    inputTokens: number,
    outputTokens: number,
    callerType: AiCallerType,
    requestType: AiRequestType,
    context: UsageContext,
    extras?: UsageExtras
  ): Promise<void> {
    try {
      const modelInfo = MODEL_INFO[model];
      const cost = calculateCost(model, inputTokens, outputTokens);
      await this.db.kysely
        .insertInto('analytics.ai_usage_logs')
        .values({
          id: packId('AiUsageLog', context.orgId),
          model,
          provider: modelInfo.provider,
          caller_type: callerType,
          request_type: requestType,
          source: context.source,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
          cost,
          duration_ms: extras?.durationMs ?? null,
          finish_reason: extras?.finishReason ?? null,
          streaming: extras?.streaming ?? false,
          org_id: context.orgId,
          user_id: context.userId ?? null,
        })
        .execute();
    } catch (error) {
      this.logger.error(`Failed to log AI usage: ${error}`);
    }
  }
}
