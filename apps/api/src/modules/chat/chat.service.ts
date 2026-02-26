import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { type DbId, packId } from '@grabdy/common';
import {
  type BotSourceConfig,
  botSourceConfigSchema,
  type ChatAttachment,
  chatSourceSchema,
} from '@grabdy/contracts';
import { sql } from 'kysely';
import { z } from 'zod';

import { THREAD_TITLE_MAX_LENGTH } from '../../config/constants';
import { DbService } from '../../db/db.module';
import { DataAgent } from '../agent/agents/data-agent';
import type { AttachmentContext } from '../agent/base-agent';
import { AgentMemoryService } from '../agent/services/memory.service';

const sourcesArraySchema = z.array(chatSourceSchema);

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private db: DbService,
    private dataAgent: DataAgent,
    private agentMemory: AgentMemoryService
  ) {}

  private async getBotConfig(
    orgId: DbId<'Org'>,
    botId: DbId<'Bot'>
  ): Promise<{
    systemPrompt: string | null;
    collectionIds: DbId<'Collection'>[];
    dataSourceIds: DbId<'DataSource'>[];
  }> {
    const row = await this.db.kysely
      .selectFrom('sdk.bots')
      .select(['data_source_config', 'system_prompt'])
      .where('id', '=', botId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!row) {
      throw new NotFoundException('Bot not found');
    }

    const config = botSourceConfigSchema.parse(row.data_source_config);
    const collectionIds: DbId<'Collection'>[] = [];
    const dataSourceIds: DbId<'DataSource'>[] = [];

    for (const entry of config) {
      if (entry.type === 'COLLECTION') {
        collectionIds.push(entry.collectionId);
      } else {
        dataSourceIds.push(entry.dataSourceId);
      }
    }

    return { systemPrompt: row.system_prompt, collectionIds, dataSourceIds };
  }

  private async ensureThread(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    message: string,
    options: {
      threadId?: DbId<'ChatThread'>;
      collectionId?: DbId<'Collection'>;
      botId?: DbId<'Bot'>;
    }
  ): Promise<DbId<'ChatThread'>> {
    if (options.threadId) {
      await this.db.kysely
        .updateTable('data.chat_threads')
        .set({
          title: sql`COALESCE(title, ${message.slice(0, THREAD_TITLE_MAX_LENGTH)})`,
          updated_at: new Date(),
        })
        .where('id', '=', options.threadId)
        .where('org_id', '=', orgId)
        .execute();
      return options.threadId;
    }

    const thread = await this.db.kysely
      .insertInto('data.chat_threads')
      .values({
        id: packId('ChatThread', orgId),
        title: message.slice(0, THREAD_TITLE_MAX_LENGTH),
        collection_id: options.collectionId ?? null,
        bot_id: options.botId ?? null,
        org_id: orgId,
        membership_id: membershipId,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return thread.id;
  }

  async chat(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    userId: DbId<'User'>,
    message: string,
    options: {
      threadId?: DbId<'ChatThread'>;
      collectionId?: DbId<'Collection'>;
    }
  ): Promise<{
    answer: string;
    threadId: DbId<'ChatThread'>;
    sources: never[];
  }> {
    const threadId = await this.ensureThread(orgId, membershipId, message, options);

    const ctx = this.dataAgent.create({
      orgId,
      userId,
      source: 'WEB',
      collectionIds: options.collectionId ? [options.collectionId] : undefined,
    });

    const result = await this.dataAgent.generate(ctx, { threadId, message });

    return {
      answer: result.text,
      threadId,
      sources: [],
    };
  }

  async streamChat(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    userId: DbId<'User'>,
    message: string,
    options: {
      threadId?: DbId<'ChatThread'>;
      collectionId?: DbId<'Collection'>;
      botId?: DbId<'Bot'>;
      attachments?: ChatAttachment[];
      attachmentContext?: AttachmentContext;
    }
  ) {
    const threadId = await this.ensureThread(orgId, membershipId, message, options);

    let collectionIds: DbId<'Collection'>[] | undefined;
    let dataSourceIds: DbId<'DataSource'>[] | undefined;
    let instructions: string | undefined;

    if (options.botId) {
      const botConfig = await this.getBotConfig(orgId, options.botId);
      if (botConfig.collectionIds.length > 0) collectionIds = botConfig.collectionIds;
      if (botConfig.dataSourceIds.length > 0) dataSourceIds = botConfig.dataSourceIds;
      if (botConfig.systemPrompt) instructions = botConfig.systemPrompt;
    } else if (options.collectionId) {
      collectionIds = [options.collectionId];
    }

    const ctx = this.dataAgent.create({
      orgId,
      userId,
      source: 'WEB',
      collectionIds,
      dataSourceIds,
      instructions,
    });

    return this.dataAgent.stream(ctx, {
      threadId,
      message,
      attachments: options.attachments,
      attachmentContext: options.attachmentContext,
    });
  }

  async createThread(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    options: {
      title?: string;
      collectionId?: DbId<'Collection'>;
      botId?: DbId<'Bot'>;
    }
  ) {
    const thread = await this.db.kysely
      .insertInto('data.chat_threads')
      .values({
        id: packId('ChatThread', orgId),
        title: options.title ?? null,
        collection_id: options.collectionId ?? null,
        bot_id: options.botId ?? null,
        org_id: orgId,
        membership_id: membershipId,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: thread.id,
      title: thread.title,
      collectionId: thread.collection_id,
      botId: thread.bot_id,
      createdAt: new Date(thread.created_at).toISOString(),
      updatedAt: new Date(thread.updated_at).toISOString(),
    };
  }

  async listThreads(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    options?: { botId?: DbId<'Bot'> }
  ) {
    let query = this.db.kysely
      .selectFrom('data.chat_threads')
      .select(['id', 'title', 'collection_id', 'bot_id', 'created_at', 'updated_at'])
      .where('org_id', '=', orgId)
      .where('membership_id', '=', membershipId);

    if (options?.botId) {
      query = query.where('bot_id', '=', options.botId);
    } else {
      query = query.where('bot_id', 'is', null);
    }

    const threads = await query.orderBy('updated_at', 'desc').execute();

    return threads.map((t) => ({
      id: t.id,
      title: t.title,
      collectionId: t.collection_id,
      botId: t.bot_id,
      createdAt: new Date(t.created_at).toISOString(),
      updatedAt: new Date(t.updated_at).toISOString(),
    }));
  }

  async getThread(orgId: DbId<'Org'>, threadId: DbId<'ChatThread'>) {
    const thread = await this.db.kysely
      .selectFrom('data.chat_threads')
      .selectAll()
      .where('id', '=', threadId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const messages = await this.agentMemory.getHistory(threadId);

    return {
      id: thread.id,
      title: thread.title,
      collectionId: thread.collection_id,
      botId: thread.bot_id,
      createdAt: new Date(thread.created_at).toISOString(),
      updatedAt: new Date(thread.updated_at).toISOString(),
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: (() => {
          if (!m.sources) return null;
          const parsed = sourcesArraySchema.safeParse(m.sources);
          return parsed.success ? parsed.data : null;
        })(),
        thinkingTexts: m.thinkingTexts ?? null,
        durationMs: m.durationMs ?? null,
        attachments: m.attachments ?? null,
        createdAt: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
      })),
    };
  }

  async deleteThread(orgId: DbId<'Org'>, threadId: DbId<'ChatThread'>): Promise<void> {
    const result = await this.db.kysely
      .deleteFrom('data.chat_threads')
      .where('id', '=', threadId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      throw new NotFoundException('Thread not found');
    }
  }

  async renameThread(orgId: DbId<'Org'>, threadId: DbId<'ChatThread'>, title: string) {
    const thread = await this.db.kysely
      .updateTable('data.chat_threads')
      .set({ title, updated_at: new Date() })
      .where('id', '=', threadId)
      .where('org_id', '=', orgId)
      .returningAll()
      .executeTakeFirst();

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    return {
      id: thread.id,
      title: thread.title,
      collectionId: thread.collection_id,
      botId: thread.bot_id,
      createdAt: new Date(thread.created_at).toISOString(),
      updatedAt: new Date(thread.updated_at).toISOString(),
    };
  }
}
