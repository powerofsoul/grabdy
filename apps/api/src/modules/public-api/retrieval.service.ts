import { Injectable, Logger } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import type { DbId } from '@grabdy/common';
import { dbIdSchema } from '@grabdy/common';
import {
  AiCallerType,
  AiRequestType,
  CHAT_MODEL,
  type ChunkMeta,
  EMBEDDING_MODEL,
} from '@grabdy/contracts';
import { chunkMetaSchema } from '@grabdy/contracts';
import { embed } from 'ai';
import { sql } from 'kysely';
import { z } from 'zod';

import { DEFAULT_SEARCH_LIMIT } from '../../config/constants';
import { DbService } from '../../db/db.module';
import { AgentFactory } from '../agent/services/agent.factory';
import { AiUsageService } from '../ai/ai-usage.service';

const ragResultItemSchema = z.object({
  dataSourceId: dbIdSchema('DataSource'),
  dataSourceName: z.string(),
  content: z.string(),
  score: z.number(),
  metadata: chunkMetaSchema.optional(),
  sourceUrl: z.string().nullable().optional(),
});

const ragResultsSchema = z.object({ results: z.array(z.unknown()) });

interface SearchResult {
  chunkId: DbId<'Chunk'>;
  content: string;
  score: number;
  metadata: ChunkMeta | null;
  dataSourceName: string;
  dataSourceId: DbId<'DataSource'>;
  sourceUrl: string | null;
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private db: DbService,
    private agentFactory: AgentFactory,
    private aiUsageService: AiUsageService
  ) {}

  async query(
    orgId: DbId<'Org'>,
    queryText: string,
    options: { collectionIds?: DbId<'Collection'>[]; limit?: number }
  ): Promise<{ results: SearchResult[]; queryTimeMs: number }> {
    const start = Date.now();

    const { embedding, usage: embedUsage } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: queryText,
    });

    // Log embedding usage
    this.aiUsageService
      .logUsage(
        EMBEDDING_MODEL,
        embedUsage.tokens,
        0,
        AiCallerType.SYSTEM,
        AiRequestType.EMBEDDING,
        { orgId, source: 'API' }
      )
      .catch((err) => this.logger.error(`Query embedding usage logging failed: ${err}`));

    const embeddingStr = `[${embedding.join(',')}]`;

    let query = this.db.kysely
      .selectFrom('data.chunks')
      .innerJoin('data.data_sources', 'data.data_sources.id', 'data.chunks.data_source_id')
      .select([
        'data.chunks.id as chunk_id',
        'data.chunks.content',
        'data.chunks.metadata',
        'data.chunks.source_url',
        'data.data_sources.title as data_source_name',
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
        metadata: r.metadata,
        dataSourceName: r.data_source_name,
        dataSourceId: r.data_source_id,
        sourceUrl: r.source_url,
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
      metadata: ChunkMeta | null;
    }>;
    model: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  }> {
    const agent = this.agentFactory.createDataAgent({
      orgId,
      source: 'API',
      collectionIds: options.collectionIds,
      callerType: AiCallerType.API_KEY,
      defaultTopK: options.topK,
    });

    const result = await agent.generate(queryText);

    // Extract sources from rag-search tool results across all steps
    const sources: Array<{
      content: string;
      score: number;
      dataSource: { id: string; name: string };
      metadata: ChunkMeta | null;
    }> = [];

    for (const step of result.steps) {
      for (const tr of step.toolResults) {
        if (tr.payload.toolName !== 'rag-search') continue;
        const parsed = ragResultsSchema.safeParse(tr.payload.result);
        if (!parsed.success) {
          this.logger.warn(`Failed to parse rag-search result: ${parsed.error.message}`);
          continue;
        }

        for (const rawItem of parsed.data.results) {
          const item = ragResultItemSchema.safeParse(rawItem);
          if (!item.success) continue;
          sources.push({
            content: item.data.content,
            score: item.data.score,
            dataSource: { id: item.data.dataSourceId, name: item.data.dataSourceName },
            metadata: item.data.metadata ?? null,
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
}
