import { Injectable, Logger } from '@nestjs/common';

import { type DbId, extractOrgNumericId, packId } from '@grabdy/common';
import { calculateCost, MODEL_INFO, type ModelId } from '@grabdy/contracts';

import { DbService } from '../../db/db.module';
import type { AiCallerType, AiRequestType } from '../../db/enums';

export interface UsageContext {
  orgId: DbId<'Org'>;
  userId?: DbId<'User'> | null;
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
    extras?: UsageExtras,
  ): Promise<void> {
    try {
      const modelInfo = MODEL_INFO[model];
      const cost = calculateCost(model, inputTokens, outputTokens);
      const orgNum = extractOrgNumericId(context.orgId);

      await this.db.kysely
        .insertInto('analytics.ai_usage_logs')
        .values({
          id: packId('AiUsageLog', orgNum),
          model,
          provider: modelInfo.provider,
          caller_type: callerType,
          request_type: requestType,
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
