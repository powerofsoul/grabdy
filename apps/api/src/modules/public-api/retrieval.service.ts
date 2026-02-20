import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { dbIdSchema } from '@grabdy/common';
import {
  AiCallerType,
  CHAT_MODEL,
  type ChunkMeta,
  type MetadataFilter,
} from '@grabdy/contracts';
import { chunkMetaSchema } from '@grabdy/contracts';
import { z } from 'zod';

import { AgentFactory } from '../agent/services/agent.factory';
import type { SearchResult } from '../retrieval/search.service';
import { SearchService } from '../retrieval/search.service';

const ragResultItemSchema = z.object({
  dataSourceId: dbIdSchema('DataSource'),
  dataSourceName: z.string(),
  content: z.string(),
  score: z.number(),
  metadata: chunkMetaSchema.optional(),
  sourceUrl: z.string().nullable().optional(),
});

const ragResultsSchema = z.object({ results: z.array(z.unknown()) });

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private searchService: SearchService,
    private agentFactory: AgentFactory
  ) {}

  async query(
    orgId: DbId<'Org'>,
    queryText: string,
    options: {
      collectionIds?: DbId<'Collection'>[];
      limit?: number;
      filters?: MetadataFilter[];
      rerank?: boolean;
      hyde?: boolean;
      expandContext?: boolean;
    }
  ): Promise<{ results: SearchResult[]; queryTimeMs: number }> {
    return this.searchService.search(orgId, queryText, {
      collectionIds: options.collectionIds,
      limit: options.limit,
      filters: options.filters,
      rerank: options.rerank,
      hyde: options.hyde,
      expandContext: options.expandContext,
      callerType: AiCallerType.API_KEY,
      source: 'API',
    });
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
