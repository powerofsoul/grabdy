import { Injectable, Logger } from '@nestjs/common';

import { type DbId, packId } from '@grabdy/common';
import { type ChatAttachment, chatAttachmentSchema } from '@grabdy/contracts';
import { z } from 'zod';

import { DbService } from '../../../db/db.module';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments: ChatAttachment[] | null;
  thinkingTexts: string[] | null;
  sources: unknown[] | null;
  durationMs: number | null;
  createdAt: Date | null;
}

export interface CoreMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: ChatAttachment[];
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
      .select(['role', 'content', 'attachments'])
      .where('thread_id', '=', threadId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute();

    // Reverse to chronological order
    rows.reverse();

    const attachmentsArraySchema = z.array(chatAttachmentSchema);

    return rows
      .filter(
        (r): r is typeof r & { role: 'user' | 'assistant' | 'system' } =>
          r.role === 'user' || r.role === 'assistant' || r.role === 'system'
      )
      .map((r) => {
        const parsed = r.attachments ? attachmentsArraySchema.safeParse(r.attachments) : null;
        const attachments = parsed?.success && parsed.data.length > 0 ? parsed.data : undefined;

        return attachments
          ? { role: r.role, content: r.content, attachments }
          : { role: r.role, content: r.content };
      });
  }

  /**
   * Save messages to the chat_messages table with sequential timestamps.
   */
  async saveMessages(
    threadId: DbId<'ChatThread'>,
    orgId: DbId<'Org'>,
    messages: Array<{
      role: 'user' | 'assistant' | 'system' | 'tool';
      content: string;
      attachments?: ChatAttachment[];
      thinkingTexts?: string[];
      sources?: unknown[];
      durationMs?: number;
    }>
  ): Promise<void> {
    if (messages.length === 0) return;

    const now = Date.now();
    const baseTime = Math.max(now, this.lastTimestamp + 1);

    const rows = messages.map((msg, index) => {
      const hasMetadata = msg.thinkingTexts || msg.sources;
      const metadata = hasMetadata
        ? JSON.stringify({
            ...(msg.thinkingTexts ? { thinkingTexts: msg.thinkingTexts } : {}),
            ...(msg.sources ? { sources: msg.sources } : {}),
          })
        : null;

      return {
        id: packId('ChatMessage', orgId),
        thread_id: threadId,
        org_id: orgId,
        role: msg.role,
        content: msg.content,
        attachments: msg.attachments ? JSON.stringify(msg.attachments) : null,
        metadata,
        duration_ms: msg.durationMs ?? null,
        created_at: new Date(baseTime + index),
      };
    });

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
      .select(['id', 'role', 'content', 'attachments', 'metadata', 'duration_ms', 'created_at'])
      .where('thread_id', '=', threadId)
      .orderBy('created_at', 'asc')
      .limit(limit)
      .execute();

    const attachmentsArraySchema = z.array(chatAttachmentSchema);
    const metadataSchema = z
      .object({
        thinkingTexts: z.array(z.string()).optional(),
        sources: z.array(z.unknown()).optional(),
      })
      .nullable();

    return rows
      .filter((r) => r.role === 'user' || r.role === 'assistant')
      .filter((r) => r.content.length > 0)
      .map((r) => {
        const parsedAttachments = r.attachments
          ? attachmentsArraySchema.safeParse(r.attachments)
          : null;
        const parsedMeta = r.metadata ? metadataSchema.safeParse(r.metadata) : null;
        const meta = parsedMeta?.success ? parsedMeta.data : null;

        return {
          id: r.id,
          role: r.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: r.content,
          attachments: parsedAttachments?.success ? parsedAttachments.data : null,
          thinkingTexts: meta?.thinkingTexts ?? null,
          sources: meta?.sources ?? null,
          durationMs: r.duration_ms,
          createdAt: r.created_at,
        };
      });
  }
}
