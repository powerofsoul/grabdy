import { Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import {
  type AiCallerType,
  type AiRequestSource,
  type AiRequestType,
  CHAT_MODEL,
  type ChatAttachment,
  type ChatSource,
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

/** Max retries when GPT-OSS produces empty output after tool results. */
const MAX_RETRIES = 10;

function retryMessage(attempt: number): CoreMessage {
  return {
    role: 'user',
    content: `[System: your previous response produced no text output (attempt ${attempt}/${MAX_RETRIES}). You MUST produce a text response based on the tool results above. Do not call any tools, just answer the question.]`,
  };
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

  protected createAgent(opts: AgentCallOptions, hooks?: Record<string, Tool>): ToolLoopAgent {
    const modelKey: ModelKey = CHAT_MODEL;

    // Collect systemPrompt sections from tool hooks and append to instructions
    const toolPrompts = Object.values(hooks ?? {})
      .map((hook) => hook.systemPrompt)
      .filter(Boolean)
      .join('\n\n');

    const instructions = toolPrompts ? `${opts.instructions}\n\n${toolPrompts}` : opts.instructions;

    const prepareStep = opts.prepareStep;

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
      onStepFinish: async ({ usage, finishReason }) => {
        this.logger.log(
          `Step finished: reason=${finishReason}, input=${usage.inputTokens ?? 0}, output=${usage.outputTokens ?? 0}`
        );
        if (finishReason === 'length') {
          this.logger.warn(`Agent step hit token limit (finishReason=length)`);
        }
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
            },
            { description: 'Agent chat step' }
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

  /** Run a non-streaming generation from raw messages. */
  protected async runGenerate(
    opts: AgentCallOptions,
    messages: CoreMessage[]
  ): Promise<{ text: string }> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const input = attempt === 1 ? messages : [...messages, retryMessage(attempt)];
      const result = await this.createAgent(opts).generate({ messages: input });
      if (result.text.trim()) return result;
      this.logger.warn(`Empty response on attempt ${attempt}/${MAX_RETRIES}, retrying`);
    }
    return { text: '' };
  }

  async stream(ctx: AgentContext, input: StreamInput): Promise<AsyncIterable<string>> {
    const { orgId } = ctx.callOptions;

    const history: CoreMessage[] = input.threadId
      ? await this.agentMemory.getMessagesForContext(input.threadId)
      : [];

    const userContent = this.prepareInput(ctx, input);
    const messages: CoreMessage[] = [...history, { role: 'user' as const, content: userContent }];

    if (input.threadId) {
      await this.agentMemory.saveMessages(input.threadId, orgId, [
        { role: 'user', content: input.message, attachments: input.attachments },
      ]);
    }

    const agentMemory = this.agentMemory;
    const logger = this.logger;
    const { threadId } = input;
    const createAgent = this.createAgent.bind(this);

    async function* generateSSE(): AsyncIterable<string> {
      const streamStart = Date.now();
      let fullText = '';
      let thinkingTexts: string[] = [];
      let sources: ChatSource[] = [];
      let finishReason = '';

      // GPT-OSS on Bedrock sometimes produces empty output after tool results
      // (output tokens but 0 text-delta chunks). Retry with a nudge message.
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const prefix = attempt === 1 ? ctx.logPrefix : `${ctx.logPrefix ?? '[stream]'} retry`;
        const input = attempt === 1 ? messages : [...messages, retryMessage(attempt)];
        const agent = createAgent(ctx.callOptions, ctx.hooks);
        const streamResult = await agent.stream({ messages: input });
        const processed = processStream(streamResult.fullStream, ctx.hooks, prefix);

        for await (const chunk of processed.chunks) {
          if (chunk.type === 'text') {
            yield sseText(chunk.text);
          } else {
            yield sseMeta(chunk);
          }
        }

        fullText = processed.getFullText();
        thinkingTexts = processed.getThinkingTexts();
        sources = processed.getSources();
        finishReason = processed.getLastFinishReason();

        if (fullText.trim()) break;

        logger.warn(
          `${ctx.logPrefix ?? '[stream]'} Empty response on attempt ${attempt}/${MAX_RETRIES}, retrying`
        );
      }

      yield sseMeta({ type: 'text_done' });

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
        finishReason: finishReason || undefined,
      });
    }

    return generateSSE();
  }

  async generate(ctx: AgentContext, input: StreamInput) {
    const { orgId } = ctx.callOptions;

    const history: CoreMessage[] = input.threadId
      ? await this.agentMemory.getMessagesForContext(input.threadId)
      : [];

    const userContent = this.prepareInput(ctx, input);
    const messages: CoreMessage[] = [...history, { role: 'user' as const, content: userContent }];

    let result = await this.createAgent(ctx.callOptions, ctx.hooks).generate({ messages });
    for (let attempt = 2; attempt <= MAX_RETRIES && !result.text.trim(); attempt++) {
      this.logger.warn(
        `${ctx.logPrefix ?? '[generate]'} Empty response on attempt ${attempt - 1}/${MAX_RETRIES}, retrying`
      );
      const input = [...messages, retryMessage(attempt)];
      result = await this.createAgent(ctx.callOptions, ctx.hooks).generate({ messages: input });
    }

    if (input.threadId) {
      await this.agentMemory.saveMessages(input.threadId, orgId, [
        { role: 'user', content: input.message, attachments: input.attachments },
        { role: 'assistant', content: result.text },
      ]);
    }

    return result;
  }
}
