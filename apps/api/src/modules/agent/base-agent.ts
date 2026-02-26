import { Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import {
  type AiCallerType,
  type AiRequestSource,
  type AiRequestType,
  CHAT_MODEL,
  type ChatAttachment,
  type ModelKey,
  type SseMetaEvent,
} from '@grabdy/contracts';
import { type PrepareStepFunction, stepCountIs, ToolLoopAgent, type ToolSet } from 'ai';

import type { AiUsageService } from '../ai/ai-usage.service';
import { CHAT_LANGUAGE_MODEL } from '../ai/bedrock.provider';

import type { AgentMemoryService, CoreMessage } from './services/memory.service';
import type { ImageStore } from './tools/image-analysis.tool';
import type { Tool } from './base-tool';
import { processStream } from './stream-processor';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type AttachmentContext = Array<
  { type: 'text'; text: string } | { type: 'image'; image: Buffer; mimeType: string }
>;

interface StreamInput {
  threadId?: DbId<'ChatThread'>;
  message: string;
  attachments?: ChatAttachment[];
  attachmentContext?: AttachmentContext;
}

export interface AgentContext {
  callOptions: AgentCallOptions;
  /** Tools with stream hooks (onToolCall/onToolResult). Only tools that emit text. */
  hooks: Record<string, Tool>;
  /** Mutable image store shared with the analyze-image tool definition. */
  imageStore?: ImageStore;
  logPrefix?: string;
}

export interface AgentCallOptions {
  orgId: DbId<'Org'>;
  source: AiRequestSource;
  callerType?: AiCallerType;
  requestType?: AiRequestType;
  userId?: DbId<'User'>;
  botId?: DbId<'Bot'>;
  externalUser?: string;
  tools: ToolSet;
  instructions: string;
  maxSteps?: number;
  prepareStep?: PrepareStepFunction;
}

// ---------------------------------------------------------------------------
// Helpers (module-private)
// ---------------------------------------------------------------------------

function buildUserContent(
  message: string,
  attachmentContext?: AttachmentContext,
  imageFileNames?: string[]
): string {
  if (!attachmentContext || attachmentContext.length === 0) {
    return message;
  }

  const textParts = attachmentContext.filter(
    (p): p is { type: 'text'; text: string } => p.type === 'text'
  );

  const textPrefix = textParts.map((p) => p.text).join('\n\n');
  let fullMessage = textPrefix ? `${textPrefix}\n\n${message}` : message;

  if (imageFileNames && imageFileNames.length > 0) {
    const imageList = imageFileNames.join(', ');
    fullMessage += `\n\n[The user attached ${imageFileNames.length} image(s): ${imageList}. Use the \`analyze-image\` tool to inspect them.]`;
  }

  return fullMessage;
}

function extractImages(
  attachmentContext?: AttachmentContext,
  attachments?: ChatAttachment[]
): Array<{ fileName: string; image: Buffer; mimeType: string }> {
  if (!attachmentContext || !attachments) return [];
  const imageAttachments = attachments.filter((a) => a.mimeType.startsWith('image/'));
  const imageParts = attachmentContext.filter(
    (p): p is { type: 'image'; image: Buffer; mimeType: string } => p.type === 'image'
  );
  return imageParts.map((part, i) => ({
    fileName: imageAttachments[i]?.fileName ?? `image-${i + 1}`,
    image: part.image,
    mimeType: part.mimeType,
  }));
}

function sseText(text: string): string {
  return `0:${JSON.stringify(text)}\n`;
}

function sseMeta(data: SseMetaEvent): string {
  return `8:${JSON.stringify(data)}\n`;
}

// ---------------------------------------------------------------------------
// Base agent
// ---------------------------------------------------------------------------

export abstract class BaseAgent {
  protected abstract readonly agentId: string;
  protected abstract readonly defaultMaxSteps: number;
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly aiUsageService: AiUsageService,
    protected readonly agentMemory: AgentMemoryService
  ) {}

  protected buildAgent(opts: AgentCallOptions, hooks?: Record<string, Tool>): ToolLoopAgent {
    const modelKey: ModelKey = CHAT_MODEL;

    // Collect systemPrompt sections from tool hooks and append to instructions
    const toolPrompts = Object.values(hooks ?? {})
      .map((hook) => hook.systemPrompt)
      .filter(Boolean)
      .join('\n\n');

    const instructions = toolPrompts ? `${opts.instructions}\n\n${toolPrompts}` : opts.instructions;

    const outerPrepareStep = opts.prepareStep;
    const enforceableHooks = Object.values(hooks ?? {}).filter(
      (hook): hook is Tool & Required<Pick<Tool, 'mustBeCalled'>> => hook.mustBeCalled != null
    );

    const prepareStep: PrepareStepFunction | undefined =
      enforceableHooks.length > 0
        ? (stepOpts) => {
            const { steps } = stepOpts;

            const calledToolNames = new Set(
              steps.flatMap((step) => step.toolCalls.map((tc) => tc.toolName))
            );

            const needsEnforcement = enforceableHooks.some(
              (hook) => !calledToolNames.has(hook.toolName) && hook.mustBeCalled(calledToolNames)
            );

            if (needsEnforcement) {
              return { toolChoice: 'required' };
            }

            if (outerPrepareStep) {
              return outerPrepareStep(stepOpts);
            }

            return {};
          }
        : outerPrepareStep;

    return new ToolLoopAgent({
      id: this.agentId,
      model: CHAT_LANGUAGE_MODEL,
      instructions,
      tools: opts.tools,
      stopWhen: stepCountIs(opts.maxSteps ?? this.defaultMaxSteps),
      prepareStep,
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
            {
              orgId: opts.orgId,
              userId: opts.userId,
              source: opts.source,
              botId: opts.botId,
              externalUser: opts.externalUser,
            }
          )
          .catch((err) => this.logger.error(`Usage logging failed: ${err}`));
      },
    });
  }

  private prepareInput(ctx: AgentContext, input: StreamInput): string {
    const images = extractImages(input.attachmentContext, input.attachments);
    if (ctx.imageStore) {
      ctx.imageStore.images = images;
    }
    const imageFileNames = images.map((img) => img.fileName);
    return buildUserContent(input.message, input.attachmentContext, imageFileNames);
  }

  async stream(ctx: AgentContext, input: StreamInput): Promise<AsyncIterable<string>> {
    const agent = this.buildAgent(ctx.callOptions, ctx.hooks);
    const { orgId } = ctx.callOptions;

    const history: CoreMessage[] = input.threadId
      ? await this.agentMemory.getMessagesForContext(input.threadId)
      : [];

    const userContent = this.prepareInput(ctx, input);

    const streamResult = await agent.stream({
      messages: [...history, { role: 'user' as const, content: userContent }],
    });

    if (input.threadId) {
      await this.agentMemory.saveMessages(input.threadId, orgId, [
        { role: 'user', content: input.message, attachments: input.attachments },
      ]);
    }

    const processed = processStream(streamResult.fullStream, ctx.hooks, ctx.logPrefix);
    const agentMemory = this.agentMemory;
    const { threadId } = input;

    async function* generateSSE(): AsyncIterable<string> {
      const streamStart = Date.now();

      for await (const chunk of processed.chunks) {
        yield chunk.type === 'text' ? sseText(chunk.text) : sseMeta(chunk);
      }

      yield sseMeta({ type: 'text_done' });

      const fullText = processed.getFullText();
      const thinkingTexts = processed.getThinkingTexts();
      const sources = processed.getSources();
      const durationMs = Date.now() - streamStart;

      if (threadId && fullText.trim()) {
        await agentMemory.saveMessages(threadId, orgId, [
          {
            role: 'assistant',
            content: fullText,
            thinkingTexts: thinkingTexts.length > 0 ? thinkingTexts : undefined,
            sources: sources.length > 0 ? sources : undefined,
            durationMs,
          },
        ]);
      }

      yield sseMeta({
        type: 'done',
        threadId: threadId ?? null,
        durationMs: Date.now() - streamStart,
      });
    }

    return generateSSE();
  }

  async generate(ctx: AgentContext, input: StreamInput) {
    const agent = this.buildAgent(ctx.callOptions, ctx.hooks);
    const { orgId } = ctx.callOptions;

    const history: CoreMessage[] = input.threadId
      ? await this.agentMemory.getMessagesForContext(input.threadId)
      : [];

    const userContent = this.prepareInput(ctx, input);

    const result = await agent.generate({
      messages: [...history, { role: 'user' as const, content: userContent }],
    });

    if (input.threadId) {
      await this.agentMemory.saveMessages(input.threadId, orgId, [
        { role: 'user', content: input.message, attachments: input.attachments },
        { role: 'assistant', content: result.text },
      ]);
    }

    return result;
  }
}
