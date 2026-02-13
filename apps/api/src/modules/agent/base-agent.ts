import { Logger } from '@nestjs/common';

import { Agent } from '@mastra/core/agent';
import type { Memory } from '@mastra/memory';
import type { ToolsInput } from '@mastra/core/agent';

import type { ModelId } from '@grabdy/contracts';

import type { AiCallerType, AiRequestType } from '../../db/enums';
import type { AiUsageService, UsageContext } from '../ai/ai-usage.service';

export interface AgentUsageConfig {
  callerType: AiCallerType;
  requestType: AiRequestType;
  context: UsageContext;
}

export abstract class BaseAgent {
  protected agent: Agent;
  protected logger: Logger;
  private usageService: AiUsageService | null;
  private usageConfig: AgentUsageConfig | null;
  private modelName: ModelId;

  constructor(
    id: string,
    name: string,
    instructions: string,
    tools: ToolsInput,
    memory: Memory,
    model: ModelId,
    usageService?: AiUsageService,
    usageConfig?: AgentUsageConfig,
  ) {
    this.logger = new Logger(this.constructor.name);
    this.usageService = usageService ?? null;
    this.usageConfig = usageConfig ?? null;
    this.modelName = model;

    this.agent = new Agent({
      id,
      name,
      instructions,
      model,
      tools,
      memory,
    });
  }

  stream(message: string, threadId: string, resourceId: string) {
    this.logger.debug(`Streaming message for thread: ${threadId}`);

    const result = this.agent.stream(message, {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
      maxSteps: 10,
    });

    // Fire-and-forget usage logging after stream completes
    if (this.usageService && this.usageConfig) {
      const svc = this.usageService;
      const cfg = this.usageConfig;
      const modelName = this.modelName;

      result
        .then(async (streamResult) => {
          const usage = await streamResult.usage;
          await svc.logUsage(
            modelName,
            usage.inputTokens ?? 0,
            usage.outputTokens ?? 0,
            cfg.callerType,
            cfg.requestType,
            cfg.context,
            { streaming: true },
          );
        })
        .catch((err) => this.logger.error(`Usage logging failed: ${err}`));
    }

    return result;
  }

  generate(message: string, threadId?: string, resourceId?: string) {
    this.logger.debug(`Generating message${threadId ? ` for thread: ${threadId}` : ''}`);

    const memoryOpts = threadId && resourceId
      ? { memory: { thread: threadId, resource: resourceId } }
      : {};

    const result = this.agent.generate(message, {
      ...memoryOpts,
      maxSteps: 10,
    });

    // Fire-and-forget usage logging after generation completes
    if (this.usageService && this.usageConfig) {
      const svc = this.usageService;
      const cfg = this.usageConfig;
      const modelName = this.modelName;

      result
        .then(async (genResult) => {
          const usage = genResult.usage;
          await svc.logUsage(
            modelName,
            usage.inputTokens ?? 0,
            usage.outputTokens ?? 0,
            cfg.callerType,
            cfg.requestType,
            cfg.context,
          );
        })
        .catch((err) => this.logger.error(`Usage logging failed: ${err}`));
    }

    return result;
  }
}
