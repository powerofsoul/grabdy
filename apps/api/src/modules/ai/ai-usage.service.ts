import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import {
  type AiCallerType,
  type AiRequestSource,
  type AiRequestType,
  calculateCost,
  MODEL_INFO,
  type ModelKey,
} from '@grabdy/contracts';

import { InngestService } from '../../inngest/inngest.service';

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

  constructor(private inngestService: InngestService) {}

  async logUsage(
    model: ModelKey,
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

      await this.inngestService.send('app/ai-usage.log', {
        orgId: context.orgId,
        model,
        provider: modelInfo.provider,
        callerType,
        requestType,
        source: context.source,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost,
        userId: context.userId ?? null,
        durationMs: extras?.durationMs ?? null,
        finishReason: extras?.finishReason ?? null,
        streaming: extras?.streaming ?? false,
      });
    } catch (error) {
      this.logger.error(`Failed to send AI usage event: ${error}`);
    }
  }
}
