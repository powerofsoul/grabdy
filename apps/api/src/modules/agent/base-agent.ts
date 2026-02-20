import { Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import type { AiCallerType, AiRequestType, ModelId } from '@grabdy/contracts';
import type { ToolsInput } from '@mastra/core/agent';
import { Agent } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import type { Memory } from '@mastra/memory';

import type { AiUsageService, UsageContext } from '../ai/ai-usage.service';

export interface AgentUsageConfig {
  callerType: AiCallerType;
  requestType: AiRequestType;
  context: UsageContext;
}

export class BaseAgent {
  protected agent: Agent;
  protected logger: Logger;
  private usageService: AiUsageService | null;
  private usageConfig: AgentUsageConfig | null;
  private modelName: ModelId;
  private maxSteps: number;
  private hasMemory: boolean;

  constructor(
    id: string,
    name: string,
    instructions: string,
    tools: ToolsInput,
    model: ModelId,
    usageService?: AiUsageService,
    usageConfig?: AgentUsageConfig,
    memory?: Memory,
    maxSteps = 25,
    languageModel?: MastraModelConfig
  ) {
    this.logger = new Logger(this.constructor.name);
    this.usageService = usageService ?? null;
    this.usageConfig = usageConfig ?? null;
    this.modelName = model;
    this.maxSteps = maxSteps;
    this.hasMemory = Boolean(memory);

    this.agent = new Agent({
      id,
      name,
      instructions,
      model: languageModel ?? model,
      tools,
      ...(memory ? { memory } : {}),
    });
  }

  stream(message: string, threadId: DbId<'ChatThread'>, membershipId: DbId<'OrgMembership'>) {
    this.logger.debug(`Streaming message for thread: ${threadId}`);

    const result = this.agent.stream(message, {
      memory: {
        thread: threadId,
        resource: membershipId,
      },
      maxSteps: this.maxSteps,
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
            { streaming: true }
          );
        })
        .catch((err) => this.logger.error(`Usage logging failed: ${err}`));
    }

    return result;
  }

  generate(message: string, threadId?: DbId<'ChatThread'>, membershipId?: DbId<'OrgMembership'>) {
    this.logger.debug(`Generating message${threadId ? ` for thread: ${threadId}` : ''}`);

    const memoryOpts =
      this.hasMemory && threadId && membershipId
        ? { memory: { thread: threadId, resource: membershipId } }
        : {};

    const result = this.agent.generate(message, {
      ...memoryOpts,
      maxSteps: this.maxSteps,
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
            cfg.context
          );
        })
        .catch((err) => this.logger.error(`Usage logging failed: ${err}`));
    }

    return result;
  }
}
