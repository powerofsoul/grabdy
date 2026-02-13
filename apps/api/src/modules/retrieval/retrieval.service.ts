import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import { type DbId, type NonDbId, packId, packNonDbId } from '@grabdy/common';
import type { CanvasEdge, CanvasState, Card } from '@grabdy/contracts';
import { CHAT_MODEL } from '@grabdy/contracts';
import { embed } from 'ai';
import { sql } from 'kysely';
import { z } from 'zod';

import { DEFAULT_SEARCH_LIMIT, THREAD_TITLE_MAX_LENGTH } from '../../config/constants';

const ragResultSchema = z.object({
  results: z.array(z.object({
    content: z.string(),
    score: z.number(),
    dataSourceId: z.string(),
    dataSourceName: z.string(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })),
});
import { DbService } from '../../db/db.module';
import { AiCallerType } from '../../db/enums';
import { AgentFactory } from '../agent/services/agent.factory';
import { AgentMemoryService } from '../agent/services/memory.service';
import { CanvasOpsService } from '../queue/canvas-ops.service';

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
    private canvasOps: CanvasOpsService
  ) {}

  private async getCanvasState(threadId: DbId<'ChatThread'>): Promise<CanvasState | undefined> {
    const row = await this.db.kysely
      .selectFrom('data.chat_threads')
      .select('canvas_state')
      .where('id', '=', threadId)
      .executeTakeFirst();

    return row?.canvas_state ?? undefined;
  }

  async query(
    orgId: DbId<'Org'>,
    queryText: string,
    options: { collectionIds?: DbId<'Collection'>[]; limit?: number }
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

    if (options.collectionIds && options.collectionIds.length > 0) {
      query = query.where('data.chunks.collection_id', 'in', options.collectionIds);
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
        metadata: r.metadata ?? {},
        dataSourceName: r.data_source_name,
        dataSourceId: r.data_source_id,
      })),
      queryTimeMs,
    };
  }

  async publicQuery(
    orgId: DbId<'Org'>,
    queryText: string,
    options: { collectionIds?: DbId<'Collection'>[]; topK?: number }
  ): Promise<{
    answer: string;
    sources: Array<{
      content: string;
      score: number;
      dataSource: { id: string; name: string };
      metadata: Record<string, unknown>;
    }>;
    model: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  }> {
    const agent = this.agentFactory.createDataAgent({
      orgId,
      collectionIds: options.collectionIds,
      callerType: AiCallerType.API_KEY,
      enableCanvas: false,
      defaultTopK: options.topK,
    });

    const result = await agent.generate(queryText);

    // Extract sources from rag-search tool results across all steps
    const sources: Array<{
      content: string;
      score: number;
      dataSource: { id: string; name: string };
      metadata: Record<string, unknown>;
    }> = [];

    for (const step of result.steps) {
      for (const tr of step.toolResults) {
        if (tr.payload.toolName !== 'rag-search') continue;
        const parsed = ragResultSchema.safeParse(tr.payload.result);
        if (!parsed.success) {
          this.logger.warn(`Failed to parse rag-search result: ${parsed.error.message}`);
          continue;
        }

        for (const r of parsed.data.results) {
          sources.push({
            content: r.content,
            score: r.score,
            dataSource: { id: r.dataSourceId, name: r.dataSourceName },
            metadata: r.metadata,
          });
        }
      }
    }

    const totalUsage = result.totalUsage;
    const promptTokens = totalUsage.inputTokens ?? 0;
    const completionTokens = totalUsage.outputTokens ?? 0;

    return {
      answer: result.text,
      sources,
      model: CHAT_MODEL,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  async chat(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    message: string,
    options: {
      threadId?: DbId<'ChatThread'>;
      collectionId?: DbId<'Collection'>;
    }
  ): Promise<{
    answer: string;
    threadId: DbId<'ChatThread'>;
    sources: SearchResult[];
  }> {
    let threadId = options.threadId;

    if (!threadId) {
      const thread = await this.db.kysely
        .insertInto('data.chat_threads')
        .values({
          id: packId('ChatThread', orgId),
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
      // Set title from first message if thread is untitled
      await this.db.kysely
        .updateTable('data.chat_threads')
        .set({
          title: sql`COALESCE(title, ${message.slice(0, THREAD_TITLE_MAX_LENGTH)})`,
          updated_at: new Date(),
        })
        .where('id', '=', threadId)
        .execute();
    }

    const canvasState = threadId ? await this.getCanvasState(threadId) : undefined;

    const chatAgent = this.agentFactory.createDataAgent({
      orgId,
      collectionIds: options.collectionId ? [options.collectionId] : undefined,
      threadId,
      canvasState,
    });
    const result = await chatAgent.generate(message, threadId, membershipId);

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
    }
  ) {
    let threadId = options.threadId;

    if (!threadId) {
      const thread = await this.db.kysely
        .insertInto('data.chat_threads')
        .values({
          id: packId('ChatThread', orgId),
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
      // Set title from first message if thread is untitled
      await this.db.kysely
        .updateTable('data.chat_threads')
        .set({
          title: sql`COALESCE(title, ${message.slice(0, THREAD_TITLE_MAX_LENGTH)})`,
          updated_at: new Date(),
        })
        .where('id', '=', threadId)
        .execute();
    }

    const canvasState = threadId ? await this.getCanvasState(threadId) : undefined;

    const agent = this.agentFactory.createDataAgent({
      orgId,
      collectionIds: options.collectionId ? [options.collectionId] : undefined,
      threadId,
      canvasState,
    });
    const streamResult = await agent.stream(message, threadId, membershipId);

    return {
      threadId,
      streamResult,
    };
  }

  async createThread(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>,
    options: { title?: string; collectionId?: DbId<'Collection'> }
  ): Promise<{
    id: DbId<'ChatThread'>;
    title: string | null;
    collectionId: DbId<'Collection'> | null;
    createdAt: string;
    updatedAt: string;
  }> {
    const thread = await this.db.kysely
      .insertInto('data.chat_threads')
      .values({
        id: packId('ChatThread', orgId),
        title: options.title ?? null,
        collection_id: options.collectionId ?? null,
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
      createdAt: new Date(thread.created_at).toISOString(),
      updatedAt: new Date(thread.updated_at).toISOString(),
    };
  }

  async listThreads(
    orgId: DbId<'Org'>,
    membershipId: DbId<'OrgMembership'>
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
      createdAt: new Date(thread.created_at).toISOString(),
      updatedAt: new Date(thread.updated_at).toISOString(),
      canvasState: thread.canvas_state ?? null,
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
    title: string
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

  async moveCanvasCard(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    cardId: NonDbId<'CanvasCard'>,
    update: {
      position?: { x: number; y: number };
      width?: number;
      height?: number;
      title?: string;
      zIndex?: number;
    }
  ): Promise<CanvasState> {
    return this.canvasOps.execute({ type: 'move_card', threadId, orgId, cardId, ...update });
  }

  async updateCanvasEdges(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    edges: CanvasEdge[]
  ): Promise<CanvasState> {
    return this.canvasOps.execute({ type: 'update_edges', threadId, orgId, edges });
  }

  async addCanvasEdge(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    edge: CanvasEdge
  ): Promise<CanvasState> {
    return this.canvasOps.execute({ type: 'add_edge', threadId, orgId, edge });
  }

  async deleteCanvasEdge(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    edgeId: NonDbId<'CanvasEdge'>
  ): Promise<CanvasState> {
    return this.canvasOps.execute({ type: 'delete_edge', threadId, orgId, edgeId });
  }

  async deleteCanvasCard(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    cardId: NonDbId<'CanvasCard'>
  ): Promise<CanvasState> {
    return this.canvasOps.execute({ type: 'remove_card', threadId, orgId, cardId });
  }

  async updateCanvasComponent(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    cardId: NonDbId<'CanvasCard'>,
    componentId: NonDbId<'CanvasComponent'>,
    data: Record<string, unknown>
  ): Promise<CanvasState> {
    return this.canvasOps.execute({
      type: 'update_component',
      threadId,
      orgId,
      cardId,
      componentId,
      data,
    });
  }

  async addCanvasCard(
    orgId: DbId<'Org'>,
    threadId: DbId<'ChatThread'>,
    card: Card
  ): Promise<CanvasState> {
    // Replace client-provided id with a proper packed UUID
    const cardId = packNonDbId('CanvasCard', orgId);
    return this.canvasOps.execute({
      type: 'add_card',
      threadId,
      orgId,
      cards: [{ ...card, id: cardId }],
    });
  }
}
