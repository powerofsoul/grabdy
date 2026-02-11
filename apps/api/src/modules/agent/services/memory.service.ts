import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';

import { DbService } from '../../../db/db.module';
import { OrderedMemory } from '../ordered-memory';
import { AgentStorageProvider } from './storage.provider';

export interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date | null;
}

@Injectable()
export class AgentMemoryService implements OnModuleInit {
  private readonly logger = new Logger(AgentMemoryService.name);
  private memory: OrderedMemory | null = null;

  constructor(
    private storageProvider: AgentStorageProvider,
    private db: DbService,
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

  async getHistory(threadId: string, options?: { limit?: number }): Promise<UIMessage[]> {
    const limit = options?.limit ?? 1000;

    const rawMessages = await this.db.kysely
      .selectFrom('agent.mastra_messages' as never)
      .select(['id', 'role', 'content', 'createdAt'] as never[])
      .where('thread_id' as never, '=', threadId as never)
      .orderBy('createdAt' as never, 'asc')
      .limit(limit)
      .execute();

    return (rawMessages as Array<{ id: string; role: string; content: unknown; createdAt: Date | null }>)
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: extractText(msg.content),
        createdAt: msg.createdAt,
      }))
      .filter((msg) => msg.content.length > 0);
  }
}

function extractTextFromParts(parts: unknown[]): string {
  return parts
    .filter((part): part is { type: string; text: string } =>
      typeof part === 'object' && part !== null && 'type' in part && part.type === 'text',
    )
    .map((part) => part.text)
    .join('');
}

function parseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return undefined;
  }
}

function extractText(content: unknown): string {
  // Postgres may return JSON as a string — parse it first
  if (typeof content === 'string') {
    if (content.startsWith('{') || content.startsWith('[')) {
      const parsed = parseJson(content);
      if (parsed !== undefined) {
        return extractText(parsed);
      }
    }
    return content;
  }

  // Array of parts: [{ type: "text", text: "..." }, ...]
  if (Array.isArray(content)) {
    return extractTextFromParts(content);
  }

  // Mastra format: { format: 2, parts: [...], content: "..." }
  if (typeof content === 'object' && content !== null) {
    const obj = content as Record<string, unknown>;

    // Extract text from parts array if present
    if (Array.isArray(obj.parts)) {
      const text = extractTextFromParts(obj.parts);
      if (text.length > 0) return text;
    }

    // Fall back to content field
    if (typeof obj.content === 'string') {
      return obj.content;
    }
  }

  return '';
}
