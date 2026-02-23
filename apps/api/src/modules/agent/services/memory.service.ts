import { Injectable, Logger } from '@nestjs/common';

import { type DbId, packId } from '@grabdy/common';

import { DbService } from '../../../db/db.module';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date | null;
}

export interface CoreMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AgentMemoryService {
  private readonly logger = new Logger(AgentMemoryService.name);
  private lastTimestamp = 0;

  constructor(private db: DbService) {}

  /**
   * Load recent messages for passing as context to the agent.
   */
  async getMessagesForContext(threadId: DbId<'ChatThread'>, limit = 20): Promise<CoreMessage[]> {
    const rows = await this.db.kysely
      .selectFrom('agent.chat_messages')
      .select(['role', 'content'])
      .where('thread_id', '=', threadId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute();

    // Reverse to chronological order
    rows.reverse();

    return rows
      .filter(
        (r): r is typeof r & { role: 'user' | 'assistant' | 'system' } =>
          r.role === 'user' || r.role === 'assistant' || r.role === 'system'
      )
      .map((r) => ({ role: r.role, content: r.content }));
  }

  /**
   * Save messages to the chat_messages table with sequential timestamps.
   */
  async saveMessages(
    threadId: DbId<'ChatThread'>,
    orgId: DbId<'Org'>,
    messages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }>
  ): Promise<void> {
    if (messages.length === 0) return;

    const now = Date.now();
    const baseTime = Math.max(now, this.lastTimestamp + 1);

    const rows = messages.map((msg, index) => ({
      id: packId('ChatMessage', orgId),
      thread_id: threadId,
      org_id: orgId,
      role: msg.role,
      content: msg.content,
      created_at: new Date(baseTime + index),
    }));

    this.lastTimestamp = baseTime + messages.length - 1;

    await this.db.kysely.insertInto('agent.chat_messages').values(rows).execute();
  }

  /**
   * Get chat history for display (UI messages).
   */
  async getHistory(
    threadId: DbId<'ChatThread'>,
    options?: { limit?: number }
  ): Promise<UIMessage[]> {
    const limit = options?.limit ?? 1000;

    const rows = await this.db.kysely
      .selectFrom('agent.chat_messages')
      .select(['id', 'role', 'content', 'created_at'])
      .where('thread_id', '=', threadId)
      .orderBy('created_at', 'asc')
      .limit(limit)
      .execute();

    return rows
      .filter((r) => r.role === 'user' || r.role === 'assistant')
      .filter((r) => r.content.length > 0)
      .map((r) => ({
        id: r.id,
        role: r.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: r.content,
        createdAt: r.created_at,
      }));
  }
}
