import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { z } from 'zod';

import { DbService } from '../../../db/db.module';
import { OrderedMemory } from '../ordered-memory';

import { AgentStorageProvider } from './storage.provider';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date | null;
}

// ---------------------------------------------------------------------------
// Zod schemas for Mastra message content parsing
// ---------------------------------------------------------------------------

/** Text part inside a Mastra "parts" array */
const textPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

/** Mastra v2 message content envelope */
const mastraContentSchema = z.object({
  parts: z.array(z.unknown()).optional(),
  content: z.string().optional(),
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

    for (const msg of allMessages) {
      if (msg.role !== 'user' && msg.role !== 'assistant') continue;

      const text = extractText(msg.content);
      if (text.length === 0) continue;

      result.push({
        id: msg.id,
        role: msg.role,
        content: text,
        createdAt: msg.createdAt,
      });
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
