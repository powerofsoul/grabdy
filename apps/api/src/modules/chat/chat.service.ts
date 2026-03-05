import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { type DbId, packId } from '@grabdy/common';
import { type ChatAttachment, chatSourceSchema, type DataSourceConfig } from '@grabdy/contracts';
import { sql } from 'kysely';
import { z } from 'zod';

import { THREAD_TITLE_MAX_LENGTH } from '../../config/constants';
import { DbService } from '../../db/db.module';
import { DataAgent } from '../agent/agents/data-agent';
import type { SearchScope } from '../agent/agents/search-scope';
import type { AttachmentContext } from '../agent/base-agent';
import { AgentMemoryService } from '../agent/services/memory.service';
import { CollectionsService } from '../collections/collections.service';

const sourcesArraySchema = z.array(chatSourceSchema);

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private db: DbService,
    private dataAgent: DataAgent,
    private agentMemory: AgentMemoryService,
    private collectionsService: CollectionsService
  ) {}

  /**
   * Resolve a DataSourceConfig array into expanded IDs for building a SearchScope.
   */
  private async resolveSourceConfig(
    orgId: DbId<'Org'>,
    config: DataSourceConfig
  ): Promise<{
    collectionIds: DbId<'Collection'>[];
    dataSourceIds: DbId<'DataSource'>[];
  }> {
    const collectionIds: DbId<'Collection'>[] = [];
    const dataSourceIds: DbId<'DataSource'>[] = [];

    for (const entry of config) {
      if (entry.type === 'COLLECTION') {
        collectionIds.push(entry.collectionId);
      } else if (entry.type === 'DATA_SOURCE') {
        dataSourceIds.push(entry.dataSourceId);
      }
    }

    // Expand collection IDs to include all descendant folders
    const descendants = await this.collectionsService.getDescendantIdsForMultiple(
      orgId,
      collectionIds
    );
    const expandedCollectionIds = [...collectionIds, ...descendants];

    return {
      collectionIds: expandedCollectionIds,
      dataSourceIds,
    };
  }

  private async ensureThread(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    message: string,
    threadId?: DbId<'ChatThread'>
  ): Promise<DbId<'ChatThread'>> {
    if (threadId) {
      await this.db.kysely
        .updateTable('data.chat_threads')
        .set({
          title: sql`COALESCE(title, ${message.slice(0, THREAD_TITLE_MAX_LENGTH)})`,
          updated_at: new Date(),
        })
        .where('id', '=', threadId)
        .where('org_id', '=', orgId)
        .execute();
      return threadId;
    }

    const thread = await this.db.kysely
      .insertInto('data.chat_threads')
      .values({
        id: packId('ChatThread', orgId),
        title: message.slice(0, THREAD_TITLE_MAX_LENGTH),
        org_id: orgId,
        membership_id: membershipId,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return thread.id;
  }

  async streamChat(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    userId: DbId<'User'>,
    message: string,
    options: {
      threadId?: DbId<'ChatThread'>;
      dataSourceConfig?: DataSourceConfig;
      attachments?: ChatAttachment[];
      attachmentContext?: AttachmentContext;
    }
  ) {
    const threadId = await this.ensureThread(orgId, membershipId, message, options.threadId);

    let searchScope: SearchScope = { type: 'all' };

    if (options.dataSourceConfig && options.dataSourceConfig.length > 0) {
      const resolved = await this.resolveSourceConfig(orgId, options.dataSourceConfig);
      searchScope = {
        type: 'scoped',
        ...resolved,
      };
    }

    const ctx = this.dataAgent.create({
      orgId,
      userId,
      source: 'WEB',
      searchScope,
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
    }
  ) {
    const thread = await this.db.kysely
      .insertInto('data.chat_threads')
      .values({
        id: packId('ChatThread', orgId),
        title: options.title ?? null,
        org_id: orgId,
        membership_id: membershipId,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: thread.id,
      title: thread.title,
      createdAt: new Date(thread.created_at).toISOString(),
      updatedAt: new Date(thread.updated_at).toISOString(),
    };
  }

  async listThreads(orgId: DbId<'Org'>, membershipId: DbId<'OrgMembership'>) {
    const threads = await this.db.kysely
      .selectFrom('data.chat_threads')
      .select(['id', 'title', 'created_at', 'updated_at'])
      .where('org_id', '=', orgId)
      .where('membership_id', '=', membershipId)
      .orderBy('updated_at', 'desc')
      .execute();

    return threads.map((t) => ({
      id: t.id,
      title: t.title,
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
      createdAt: new Date(thread.created_at).toISOString(),
      updatedAt: new Date(thread.updated_at).toISOString(),
    };
  }
}
