import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';

import { type DbId, dbIdSchema } from '@grabdy/common';
import { z } from 'zod';

import { DbService } from '../../../db/db.module';
import { OrderedMemory } from '../ordered-memory';
import { ragResultItemSchema, summarizeToolCall } from '../tool-summary';

import { AgentStorageProvider } from './storage.provider';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UIThinkingStep {
  toolName: string;
  summary: string;
}

export interface UISource {
  dataSourceId: DbId<'DataSource'>;
  dataSourceName: string;
  score: number;
  pages?: number[];
}

export interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date | null;
  thinkingSteps: UIThinkingStep[] | null;
  sources: UISource[] | null;
}

// ---------------------------------------------------------------------------
// Zod schemas for Mastra message content parsing
// ---------------------------------------------------------------------------

/** Tool invocation inside a Mastra "parts" array */
const toolInvocationPartSchema = z.object({
  type: z.literal('tool-invocation'),
  toolInvocation: z.object({
    toolName: z.string(),
    args: z.unknown().optional(),
    result: z.unknown().optional(),
  }),
});

/** Text part inside a Mastra "parts" array */
const textPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

/** Mastra v2 message content envelope */
const mastraContentSchema = z.object({
  parts: z.array(z.unknown()).optional(),
  content: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Legacy array-of-parts format */
const legacyToolCallPartSchema = z.object({
  type: z.literal('tool-call'),
  toolName: z.string(),
});

const legacyToolResultPartSchema = z.object({
  type: z.literal('tool-result'),
  toolName: z.string(),
  result: z.unknown(),
});

/** Stored metadata schemas */
const storedSourceSchema = z.object({
  dataSourceId: dbIdSchema('DataSource'),
  dataSourceName: z.string(),
  score: z.number(),
  pages: z.array(z.number()).optional(),
});

const storedStepSchema = z.object({
  toolName: z.string(),
  summary: z.string(),
});

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AgentMemoryService implements OnModuleInit {
  private readonly logger = new Logger(AgentMemoryService.name);
  private memory: OrderedMemory | null = null;

  constructor(
    private storageProvider: AgentStorageProvider,
    private db: DbService
  ) {}

  async onModuleInit() {
    this.memory = new OrderedMemory({
      storage: this.storageProvider.getStore(),
      options: {
        lastMessages: 20,
        workingMemory: { enabled: false },
      },
    });
    this.logger.log('Agent Memory initialized with OrderedMemory');
  }

  getMemory(): OrderedMemory {
    if (!this.memory) {
      throw new InternalServerErrorException('AgentMemoryService not initialized');
    }
    return this.memory;
  }

  async getHistory(
    threadId: DbId<'ChatThread'>,
    options?: { limit?: number }
  ): Promise<UIMessage[]> {
    const limit = options?.limit ?? 1000;

    const allMessages = await this.db.kysely
      .selectFrom('agent.mastra_messages')
      .select(['id', 'role', 'content', 'createdAt'])
      .where('thread_id', '=', threadId)
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .execute();

    const result: UIMessage[] = [];
    let pendingToolCalls: Array<{ toolName: string }> = [];
    let pendingToolResults = new Map<string, string>();
    let pendingSources = new Map<string, UISource>();

    for (const msg of allMessages) {
      if (msg.role === 'assistant') {
        flushToolSteps(result, pendingToolCalls, pendingToolResults, pendingSources);
        pendingToolCalls = [];
        pendingToolResults = new Map();
        pendingSources = new Map();

        pendingToolCalls = extractToolCalls(msg.content);

        const text = extractText(msg.content);
        if (text.length > 0) {
          result.push({
            id: msg.id,
            role: 'assistant',
            content: text,
            createdAt: msg.createdAt,
            thinkingSteps: null,
            sources: null,
          });
        }
      } else if (msg.role === 'tool') {
        for (const [name, summary] of extractToolResults(msg.content)) {
          pendingToolResults.set(name, summary);
        }
        for (const source of extractRagSources(msg.content)) {
          const existing = pendingSources.get(source.dataSourceId);
          if (existing) {
            if (source.score > existing.score) existing.score = source.score;
            if (source.pages) {
              const merged = new Set(existing.pages ?? []);
              for (const p of source.pages) merged.add(p);
              existing.pages = [...merged].sort((a, b) => a - b);
            }
          } else {
            pendingSources.set(source.dataSourceId, { ...source });
          }
        }
      } else if (msg.role === 'user') {
        flushToolSteps(result, pendingToolCalls, pendingToolResults, pendingSources);
        pendingToolCalls = [];
        pendingToolResults = new Map();
        pendingSources = new Map();

        const text = extractText(msg.content);
        if (text.length > 0) {
          result.push({
            id: msg.id,
            role: 'user',
            content: text,
            createdAt: msg.createdAt,
            thinkingSteps: null,
            sources: null,
          });
        }
      }
    }

    flushToolSteps(result, pendingToolCalls, pendingToolResults, pendingSources);

    // Override with metadata stored in Mastra message content.metadata
    for (const rawMsg of allMessages) {
      if (rawMsg.role !== 'assistant') continue;
      const meta = parseContentMetadata(rawMsg.content);
      if (!meta) continue;

      const uiMsg = result.find((m) => m.id === rawMsg.id);
      if (!uiMsg) continue;

      const sources = z.array(storedSourceSchema).safeParse(meta['sources']);
      if (sources.success && sources.data.length > 0) {
        uiMsg.sources = sources.data;
      }
      const steps = z.array(storedStepSchema).safeParse(meta['thinkingSteps']);
      if (steps.success && steps.data.length > 0) {
        uiMsg.thinkingSteps = steps.data;
      }
    }

    return result;
  }
}

// ---------------------------------------------------------------------------
// Content parsing helpers
// ---------------------------------------------------------------------------

function parseContent(content: unknown): unknown {
  if (typeof content === 'string') {
    if (content.startsWith('{') || content.startsWith('[')) {
      try {
        return JSON.parse(content);
      } catch {
        return content;
      }
    }
    return content;
  }
  return content;
}

function parseContentMetadata(content: unknown): Record<string, unknown> | null {
  const parsed = parseContent(content);
  const result = mastraContentSchema.safeParse(parsed);
  if (!result.success || !result.data.metadata) return null;
  return result.data.metadata;
}

function extractText(content: unknown): string {
  const parsed = parseContent(content);

  if (typeof parsed === 'string') return parsed;

  if (Array.isArray(parsed)) {
    return parsed
      .map((p) => textPartSchema.safeParse(p))
      .filter((r) => r.success)
      .map((r) => r.data.text)
      .join('');
  }

  const envelope = mastraContentSchema.safeParse(parsed);
  if (envelope.success) {
    if (envelope.data.parts) {
      const text = envelope.data.parts
        .map((p) => textPartSchema.safeParse(p))
        .filter((r) => r.success)
        .map((r) => r.data.text)
        .join('');
      if (text.length > 0) return text;
    }
    if (envelope.data.content) return envelope.data.content;
  }

  return '';
}

function extractToolCalls(content: unknown): Array<{ toolName: string }> {
  const parsed = parseContent(content);

  const envelope = mastraContentSchema.safeParse(parsed);
  if (envelope.success && envelope.data.parts) {
    return envelope.data.parts
      .map((p) => toolInvocationPartSchema.safeParse(p))
      .filter((r) => r.success)
      .map((r) => ({ toolName: r.data.toolInvocation.toolName }));
  }

  if (Array.isArray(parsed)) {
    return parsed
      .map((p) => legacyToolCallPartSchema.safeParse(p))
      .filter((r) => r.success)
      .map((r) => ({ toolName: r.data.toolName }));
  }

  return [];
}

function extractToolResults(content: unknown): Array<[string, string]> {
  const parsed = parseContent(content);

  const envelope = mastraContentSchema.safeParse(parsed);
  if (envelope.success && envelope.data.parts) {
    return envelope.data.parts
      .map((p) => toolInvocationPartSchema.safeParse(p))
      .filter((r) => r.success)
      .map((r) => [
        r.data.toolInvocation.toolName,
        summarizeToolCall(
          r.data.toolInvocation.toolName,
          r.data.toolInvocation.args,
          r.data.toolInvocation.result
        ),
      ]);
  }

  if (Array.isArray(parsed)) {
    return parsed
      .map((p) => legacyToolResultPartSchema.safeParse(p))
      .filter((r) => r.success)
      .map((r) => [r.data.toolName, summarizeToolCall(r.data.toolName, undefined, r.data.result)]);
  }

  return [];
}

function extractRagSources(content: unknown): UISource[] {
  const parsed = parseContent(content);
  const sources: UISource[] = [];

  function extractFromResult(result: unknown): void {
    const obj = z.object({ results: z.array(z.unknown()) }).safeParse(result);
    if (!obj.success) return;
    for (const item of obj.data.results) {
      const parsed = ragResultItemSchema.safeParse(item);
      if (!parsed.success) continue;
      if (parsed.data.score < 0.3) continue;
      const pages = parsed.data.metadata?.pages;
      sources.push({
        dataSourceId: parsed.data.dataSourceId,
        dataSourceName: parsed.data.dataSourceName,
        score: parsed.data.score,
        pages: pages && pages.length > 0 ? pages : undefined,
      });
    }
  }

  const envelope = mastraContentSchema.safeParse(parsed);
  if (envelope.success && envelope.data.parts) {
    for (const p of envelope.data.parts) {
      const inv = toolInvocationPartSchema.safeParse(p);
      if (inv.success && inv.data.toolInvocation.toolName === 'rag-search') {
        extractFromResult(inv.data.toolInvocation.result);
      }
    }
  }

  if (Array.isArray(parsed)) {
    for (const p of parsed) {
      const res = legacyToolResultPartSchema.safeParse(p);
      if (res.success && res.data.toolName === 'rag-search') {
        extractFromResult(res.data.result);
      }
    }
  }

  return sources;
}

function flushToolSteps(
  result: UIMessage[],
  toolCalls: Array<{ toolName: string }>,
  toolResults: Map<string, string>,
  sources: Map<string, UISource>
): void {
  if (toolCalls.length === 0 && sources.size === 0) return;

  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].role === 'assistant') {
      result[i] = {
        ...result[i],
        thinkingSteps:
          toolCalls.length > 0
            ? toolCalls.map((tc) => ({
                toolName: tc.toolName,
                summary: toolResults.get(tc.toolName) ?? 'Done',
              }))
            : result[i].thinkingSteps,
        sources: sources.size > 0 ? [...sources.values()] : result[i].sources,
      };
      break;
    }
  }
}
