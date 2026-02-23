import { Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import {
  type AiCallerType,
  type AiRequestSource,
  type AiRequestType,
  CHAT_MODEL,
  type ModelKey,
} from '@grabdy/contracts';
import { type PrepareStepFunction, stepCountIs, ToolLoopAgent, type ToolSet } from 'ai';

import type { AiUsageService } from '../ai/ai-usage.service';
import { CHAT_LANGUAGE_MODEL } from '../ai/bedrock.provider';

export interface AgentCallOptions {
  orgId: DbId<'Org'>;
  source: AiRequestSource;
  callerType?: AiCallerType;
  requestType?: AiRequestType;
  userId?: DbId<'User'>;
  tools: ToolSet;
  instructions: string;
  maxSteps?: number;
  prepareStep?: PrepareStepFunction;
}

export abstract class BaseAgent {
  protected abstract readonly agentId: string;
  protected abstract readonly defaultMaxSteps: number;
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly aiUsageService: AiUsageService) {}

  protected buildAgent(opts: AgentCallOptions): ToolLoopAgent {
    const modelKey: ModelKey = CHAT_MODEL;

    return new ToolLoopAgent({
      id: this.agentId,
      model: CHAT_LANGUAGE_MODEL,
      instructions: opts.instructions,
      tools: opts.tools,
      stopWhen: stepCountIs(opts.maxSteps ?? this.defaultMaxSteps),
      prepareStep: opts.prepareStep,
      experimental_telemetry: {
        isEnabled: true,
        functionId: this.agentId,
        metadata: { orgId: opts.orgId },
      },
      onStepFinish: async ({ usage }) => {
        await this.aiUsageService
          .logUsage(
            modelKey,
            usage.inputTokens ?? 0,
            usage.outputTokens ?? 0,
            opts.callerType ?? 'MEMBER',
            opts.requestType ?? 'CHAT',
            { orgId: opts.orgId, userId: opts.userId, source: opts.source }
          )
          .catch((err) => this.logger.error(`Usage logging failed: ${err}`));
      },
    });
  }
}
