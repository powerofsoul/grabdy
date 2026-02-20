import { Injectable, Logger } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import type { DbId } from '@grabdy/common';
import {
  type AiCallerType,
  type AiRequestSource,
  AiRequestType,
  type ChunkMeta,
  EMBEDDING_MODEL,
  HYDE_MODEL,
  type MetadataFilter,
} from '@grabdy/contracts';
import { embed, generateText } from 'ai';
import type { RawBuilder } from 'kysely';
import { sql } from 'kysely';

import {
  CONTEXT_PREVIEW_MAX_LENGTH,
  DEFAULT_SEARCH_LIMIT,
  HYDE_MAX_LENGTH,
  HYDE_TIMEOUT_MS,
} from '../../config/constants';
import { DbService } from '../../db/db.module';
import { AiUsageService } from '../ai/ai-usage.service';

import { reciprocalRankFusion } from './hybrid-search';
import { RerankService } from './rerank.service';

export interface SearchResult {
  chunkId: DbId<'Chunk'>;
  content: string;
  score: number;
  metadata: ChunkMeta | null;
  dataSourceName: string;
  dataSourceId: DbId<'DataSource'>;
  sourceUrl: string | null;
  collectionId: DbId<'Collection'> | null;
  contextBefore?: string;
  contextAfter?: string;
}

export interface SearchOptions {
  collectionIds?: DbId<'Collection'>[];
  limit?: number;
  filters?: MetadataFilter[];
  callerType: AiCallerType;
  source: AiRequestSource;
  userId?: DbId<'User'> | null;
  rerank?: boolean;
  hyde?: boolean;
  expandContext?: boolean;
}

type NeighborKey = `${string}:${number}`;

/**
 * Build raw SQL conditions from metadata filters.
 * All filter values are Zod-validated (enum or string) before reaching here.
 */
function buildMetadataConditions(filters: MetadataFilter[]): Array<RawBuilder<boolean>> {
  const conditions: Array<RawBuilder<boolean>> = [];

  for (const filter of filters) {
    switch (filter.field) {
      case 'type': {
        if (filter.operator === 'eq') {
          conditions.push(sql<boolean>`data.chunks.metadata->>'type' = ${filter.value}`);
        } else {
          const values: string[] = Array.isArray(filter.value) ? filter.value : [filter.value];
          conditions.push(
            sql<boolean>`data.chunks.metadata->>'type' IN (${sql.join(values.map((v: string) => sql`${v}`))})`
          );
        }
        break;
      }
      case 'slackChannelId':
        conditions.push(sql<boolean>`data.chunks.metadata->>'slackChannelId' = ${filter.value}`);
        break;
      case 'slackAuthors':
        // Handle both old format (slackAuthor string) and new format (slackAuthors array)
        conditions.push(
          sql<boolean>`(
            data.chunks.metadata->'slackAuthors' @> ${sql`${JSON.stringify([filter.value])}::jsonb`}
            OR data.chunks.metadata->>'slackAuthor' = ${filter.value}
          )`
        );
        break;
      case 'notionPageId':
        conditions.push(sql<boolean>`data.chunks.metadata->>'notionPageId' = ${filter.value}`);
        break;
      case 'linearIssueId':
        conditions.push(sql<boolean>`data.chunks.metadata->>'linearIssueId' = ${filter.value}`);
        break;
      default: {
        const exhaustive: never = filter;
        throw new Error(`Unhandled metadata filter field: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  return conditions;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private db: DbService,
    private aiUsageService: AiUsageService,
    private rerankService: RerankService
  ) {}

  async search(
    orgId: DbId<'Org'>,
    queryText: string,
    options: SearchOptions
  ): Promise<{ results: SearchResult[]; queryTimeMs: number }> {
    const start = Date.now();
    const limit = options.limit ?? DEFAULT_SEARCH_LIMIT;

    // HyDE: generate hypothetical answer and blend with original query for better vector search
    let vectorQueryText = queryText;
    if (options.hyde) {
      const hydeResult = await this.generateHyDE(queryText, orgId, options);
      if (hydeResult) {
        vectorQueryText = `${queryText}\n\n${hydeResult.slice(0, HYDE_MAX_LENGTH)}`;
      }
    }

    const { embedding, usage: embedUsage } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: vectorQueryText,
    });

    // Log embedding usage (fire-and-forget)
    this.aiUsageService
      .logUsage(
        EMBEDDING_MODEL,
        embedUsage.tokens,
        0,
        options.callerType,
        AiRequestType.EMBEDDING,
        { orgId, userId: options.userId, source: options.source }
      )
      .catch((err) => this.logger.error(`Search embedding usage logging failed: ${err}`));

    const embeddingStr = `[${embedding.join(',')}]`;

    // Over-fetch for RRF merging (and more for reranking)
    const fetchLimit = options.rerank ? limit * 3 : limit * 2;

    // Run vector + full-text + trigram search in parallel
    const searchResults = await Promise.all([
      this.vectorSearch(orgId, embeddingStr, fetchLimit, options),
      this.fullTextSearch(orgId, queryText, fetchLimit, options),
      this.trigramSearch(orgId, queryText, fetchLimit, options),
    ]);

    // Fuse and optionally rerank results
    let merged = await this.fuseAndRerank(searchResults, queryText, orgId, limit, options);

    // Expand context with adjacent chunks if requested
    if (options.expandContext && merged.length > 0) {
      merged = await this.expandContext(orgId, merged);
    }

    const queryTimeMs = Date.now() - start;
    return { results: merged, queryTimeMs };
  }

  private async fuseAndRerank(
    searchResults: SearchResult[][],
    queryText: string,
    orgId: DbId<'Org'>,
    limit: number,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const hasAnyResults = searchResults.some((list) => list.length > 0);
    if (!hasAnyResults) return [];

    const fused = reciprocalRankFusion(searchResults, (item) => item.chunkId);

    const results = fused.map((f) => ({
      ...f.item,
      score: f.score,
    }));

    // Apply reranking if requested
    if (options.rerank && results.length > 1) {
      const reranked = await this.rerankService.rerank(
        queryText,
        results.map((r) => ({ id: r.chunkId, content: r.content, vectorScore: r.score })),
        orgId,
        { userId: options.userId }
      );

      if (reranked) {
        const resultMap = new Map<string, SearchResult>(results.map((r) => [r.chunkId, r]));
        return reranked
          .slice(0, limit)
          .map((rr) => {
            const original = resultMap.get(rr.id);
            if (!original) return null;
            return { ...original, score: rr.score };
          })
          .filter((r): r is SearchResult => r !== null);
      }

      this.logger.warn('Rerank returned null, using hybrid search order');
    }

    return results.slice(0, limit);
  }

  private async generateHyDE(
    queryText: string,
    orgId: DbId<'Org'>,
    options: SearchOptions
  ): Promise<string | null> {
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), HYDE_TIMEOUT_MS);

    try {
      let text: string;
      let usage: { inputTokens?: number; outputTokens?: number };
      try {
        const result = await generateText({
          model: openai('gpt-4o-mini'),
          maxOutputTokens: 150,
          abortSignal: abortController.signal,
          prompt: `Write a short passage (~100 words) that directly answers this question. Write as if you are quoting from a relevant document. Do not preface or explain — just write the answer passage.\n\nQuestion: ${queryText}`,
        });
        text = result.text;
        usage = result.usage;
      } finally {
        clearTimeout(timer);
      }

      // Log HyDE usage (fire-and-forget)
      this.aiUsageService
        .logUsage(
          HYDE_MODEL,
          usage.inputTokens ?? 0,
          usage.outputTokens ?? 0,
          options.callerType,
          AiRequestType.HYDE,
          { orgId, userId: options.userId, source: options.source }
        )
        .catch((err) => this.logger.error(`HyDE usage logging failed: ${err}`));

      return text;
    } catch (error) {
      this.logger.warn(`HyDE generation failed, using raw query: ${error}`);
      return null;
    }
  }

  private baseChunkQuery(orgId: DbId<'Org'>, options: SearchOptions) {
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
        'data.chunks.collection_id',
      ])
      .where('data.chunks.org_id', '=', orgId);

    if (options.collectionIds && options.collectionIds.length > 0) {
      query = query.where('data.chunks.collection_id', 'in', options.collectionIds);
    }

    if (options.filters && options.filters.length > 0) {
      for (const condition of buildMetadataConditions(options.filters)) {
        query = query.where(condition);
      }
    }

    return query;
  }

  private toSearchResults(
    rows: Array<{
      chunk_id: DbId<'Chunk'>;
      content: string;
      score: number;
      metadata: ChunkMeta | null;
      data_source_name: string;
      data_source_id: DbId<'DataSource'>;
      source_url: string | null;
      collection_id: DbId<'Collection'> | null;
    }>
  ): SearchResult[] {
    return rows.map((r) => ({
      chunkId: r.chunk_id,
      content: r.content,
      score: Number(r.score),
      metadata: r.metadata,
      dataSourceName: r.data_source_name,
      dataSourceId: r.data_source_id,
      sourceUrl: r.source_url,
      collectionId: r.collection_id,
    }));
  }

  private async vectorSearch(
    orgId: DbId<'Org'>,
    embeddingStr: string,
    limit: number,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const results = await this.baseChunkQuery(orgId, options)
      .select(sql<number>`1 - (data.chunks.embedding <=> ${embeddingStr}::vector)`.as('score'))
      .orderBy(sql`data.chunks.embedding <=> ${embeddingStr}::vector`)
      .limit(limit)
      .execute();

    return this.toSearchResults(results);
  }

  private async fullTextSearch(
    orgId: DbId<'Org'>,
    queryText: string,
    limit: number,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const results = await this.baseChunkQuery(orgId, options)
      .select(
        sql<number>`ts_rank_cd(data.chunks.tsv, websearch_to_tsquery('english', ${queryText}))`.as(
          'score'
        )
      )
      .where(sql<boolean>`data.chunks.tsv @@ websearch_to_tsquery('english', ${queryText})`)
      .orderBy(
        sql`ts_rank_cd(data.chunks.tsv, websearch_to_tsquery('english', ${queryText}))`,
        'desc'
      )
      .limit(limit)
      .execute();

    return this.toSearchResults(results);
  }

  private async trigramSearch(
    orgId: DbId<'Org'>,
    queryText: string,
    limit: number,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    try {
      const results = await this.baseChunkQuery(orgId, options)
        .select(sql<number>`word_similarity(${queryText}, data.chunks.content)`.as('score'))
        .where(sql<boolean>`${queryText} <% data.chunks.content`)
        .orderBy(sql`word_similarity(${queryText}, data.chunks.content)`, 'desc')
        .limit(limit)
        .execute();

      return this.toSearchResults(results);
    } catch (error) {
      // pg_trgm extension may not be available — fall back gracefully
      this.logger.warn(`Trigram search failed (pg_trgm may be missing): ${error}`);
      return [];
    }
  }

  private async expandContext(
    orgId: DbId<'Org'>,
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    const chunkIds = results.map((r) => r.chunkId);

    const chunkIndices = await this.db.kysely
      .selectFrom('data.chunks')
      .select(['id', 'chunk_index', 'data_source_id'])
      .where('id', 'in', chunkIds)
      .where('org_id', '=', orgId)
      .execute();

    const chunkIndexLookup = new Map(chunkIndices.map((c) => [c.id, c]));

    // Build neighbor queries: for each result, get chunk_index - 1 and chunk_index + 1
    const pendingNeighborKeys = new Set<NeighborKey>();
    const neighborQueries: Array<{ dataSourceId: DbId<'DataSource'>; chunkIndex: number }> = [];

    for (const result of results) {
      const info = chunkIndexLookup.get(result.chunkId);
      if (!info) continue;

      const prevKey: NeighborKey = `${info.data_source_id}:${info.chunk_index - 1}`;
      const nextKey: NeighborKey = `${info.data_source_id}:${info.chunk_index + 1}`;

      if (!pendingNeighborKeys.has(prevKey) && info.chunk_index > 0) {
        pendingNeighborKeys.add(prevKey);
        neighborQueries.push({
          dataSourceId: info.data_source_id,
          chunkIndex: info.chunk_index - 1,
        });
      }
      if (!pendingNeighborKeys.has(nextKey)) {
        pendingNeighborKeys.add(nextKey);
        neighborQueries.push({
          dataSourceId: info.data_source_id,
          chunkIndex: info.chunk_index + 1,
        });
      }
    }

    if (neighborQueries.length === 0) return results;

    // Batch query all neighbors using VALUES join (efficient for large sets)
    const valuesRows = neighborQueries.map(
      (l) => sql`(${l.dataSourceId}::uuid, ${l.chunkIndex}::int)`
    );

    const neighbors = await this.db.kysely
      .selectFrom('data.chunks')
      .select(['data_source_id', 'chunk_index', 'content'])
      .where('org_id', '=', orgId)
      .where(
        sql<boolean>`(data.chunks.data_source_id, data.chunks.chunk_index) IN (VALUES ${sql.join(valuesRows)})`
      )
      .execute();

    const neighborContentMap = new Map<NeighborKey, string>();
    for (const n of neighbors) {
      const key: NeighborKey = `${n.data_source_id}:${n.chunk_index}`;
      neighborContentMap.set(key, n.content.slice(0, CONTEXT_PREVIEW_MAX_LENGTH));
    }

    // Attach context to results
    return results.map((result) => {
      const info = chunkIndexLookup.get(result.chunkId);
      if (!info) return result;

      const prevKey: NeighborKey = `${info.data_source_id}:${info.chunk_index - 1}`;
      const nextKey: NeighborKey = `${info.data_source_id}:${info.chunk_index + 1}`;

      return {
        ...result,
        contextBefore: neighborContentMap.get(prevKey),
        contextAfter: neighborContentMap.get(nextKey),
      };
    });
  }
}
