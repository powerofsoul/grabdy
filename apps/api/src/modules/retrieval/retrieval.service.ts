import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { sql } from 'kysely';

import { type DbId, extractOrgNumericId, packId } from '@grabdy/common';

import { DEFAULT_SEARCH_LIMIT, THREAD_TITLE_MAX_LENGTH } from '../../config/constants';
import { DbService } from '../../db/db.module';
import { AgentFactory } from '../agent/services/agent.factory';
import { AgentMemoryService } from '../agent/services/memory.service';

interface SearchResult {
  chunkId: DbId<'Chunk'>;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  dataSourceName: string;
  dataSourceId: DbId<'DataSource'>;
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private db: DbService,
    private agentFactory: AgentFactory,
    private agentMemory: AgentMemoryService,
  ) {}

  async query(
    orgId: DbId<'Org'>,
    queryText: string,
    options: { collectionId?: DbId<'Collection'>; limit?: number },
  ): Promise<{ results: SearchResult[]; queryTimeMs: number }> {
    const start = Date.now();

    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: queryText,
    });

    const embeddingStr = `[${embedding.join(',')}]`;

    let query = this.db.kysely
      .selectFrom('data.chunks')
      .innerJoin('data.data_sources', 'data.data_sources.id', 'data.chunks.data_source_id')
      .select([
        'data.chunks.id as chunk_id',
        'data.chunks.content',
        'data.chunks.metadata',
        'data.data_sources.name as data_source_name',
        'data.data_sources.id as data_source_id',
        sql<number>`1 - (data.chunks.embedding <=> ${embeddingStr}::vector)`.as('score'),
      ])
      .where('data.chunks.org_id', '=', orgId);

    if (options.collectionId) {
      query = query.where('data.chunks.collection_id', '=', options.collectionId);
    }

    const results = await query
      .orderBy(sql`data.chunks.embedding <=> ${embeddingStr}::vector`)
      .limit(options.limit ?? DEFAULT_SEARCH_LIMIT)
      .execute();

    const queryTimeMs = Date.now() - start;

    return {
      results: results.map((r) => ({
        chunkId: r.chunk_id,
        content: r.content,
        score: Number(r.score),
        metadata: (r.metadata ?? {}) as Record<string, unknown>,
        dataSourceName: r.data_source_name,
        dataSourceId: r.data_source_id,
      })),
      queryTimeMs,
    };
  }

  async chat(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    message: string,
    options: {
      threadId?: DbId<'ChatThread'>;
      collectionId?: DbId<'Collection'>;
    },
  ): Promise<{
    answer: string;
    threadId: DbId<'ChatThread'>;
    sources: SearchResult[];
  }> {
    const orgNum = extractOrgNumericId(orgId);
    let threadId = options.threadId;

    if (!threadId) {
      const thread = await this.db.kysely
        .insertInto('data.chat_threads')
        .values({
          id: packId('ChatThread', orgNum),
          title: message.slice(0, THREAD_TITLE_MAX_LENGTH),
          collection_id: options.collectionId ?? null,
          org_id: orgId,
          membership_id: membershipId,
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      threadId = thread.id;
    } else {
      await this.db.kysely
        .updateTable('data.chat_threads')
        .set({ updated_at: new Date() })
        .where('id', '=', threadId)
        .execute();
    }

    const agent = this.agentFactory.createDataAgent(orgId, options.collectionId);
    const result = await agent.generate(message, threadId, membershipId);

    return {
      answer: result.text,
      threadId,
      sources: [],
    };
  }

  async streamChat(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    message: string,
    options: {
      threadId?: DbId<'ChatThread'>;
      collectionId?: DbId<'Collection'>;
    },
  ) {
    const orgNum = extractOrgNumericId(orgId);
    let threadId = options.threadId;

    if (!threadId) {
      const thread = await this.db.kysely
        .insertInto('data.chat_threads')
        .values({
          id: packId('ChatThread', orgNum),
          title: message.slice(0, THREAD_TITLE_MAX_LENGTH),
          collection_id: options.collectionId ?? null,
          org_id: orgId,
          membership_id: membershipId,
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      threadId = thread.id;
    } else {
      await this.db.kysely
        .updateTable('data.chat_threads')
        .set({ updated_at: new Date() })
        .where('id', '=', threadId)
        .execute();
    }

    const agent = this.agentFactory.createDataAgent(orgId, options.collectionId);
    const streamResult = await agent.stream(message, threadId, membershipId);

    return {
      threadId,
      streamResult,
    };
  }

  async listThreads(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
  ): Promise<
    Array<{
      id: DbId<'ChatThread'>;
      title: string | null;
      collectionId: DbId<'Collection'> | null;
      createdAt: string;
      updatedAt: string;
    }>
  > {
    const threads = await this.db.kysely
      .selectFrom('data.chat_threads')
      .select(['id', 'title', 'collection_id', 'created_at', 'updated_at'])
      .where('org_id', '=', orgId)
      .where('membership_id', '=', membershipId)
      .orderBy('updated_at', 'desc')
      .execute();

    return threads.map((t) => ({
      id: t.id,
      title: t.title,
      collectionId: t.collection_id,
      createdAt: new Date(t.created_at).toISOString(),
      updatedAt: new Date(t.updated_at).toISOString(),
    }));
  }

  async getThread(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
  ): Promise<{
    id: DbId<'ChatThread'>;
    title: string | null;
    collectionId: DbId<'Collection'> | null;
    createdAt: string;
    updatedAt: string;
    messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      sources: null;
      createdAt: string;
    }>;
  }> {
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
      createdAt: new Date(thread.created_at).toISOString(),
      updatedAt: new Date(thread.updated_at).toISOString(),
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: null,
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

  async renameThread(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    title: string,
  ): Promise<{
    id: DbId<'ChatThread'>;
    title: string | null;
    collectionId: DbId<'Collection'> | null;
    createdAt: string;
    updatedAt: string;
  }> {
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
      createdAt: new Date(thread.created_at).toISOString(),
      updatedAt: new Date(thread.updated_at).toISOString(),
    };
  }
}
