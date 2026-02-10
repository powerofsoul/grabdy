import { Injectable, Logger } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import { embed, generateText } from 'ai';
import { sql } from 'kysely';

import { type DbId, extractOrgNumericId, packId } from '@grabdy/common';

import { DbService } from '../../db/db.module';

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

  constructor(private db: DbService) {}

  async query(
    orgId: DbId<'Org'>,
    queryText: string,
    options: { collectionId?: DbId<'Collection'>; limit?: number }
  ): Promise<{ results: SearchResult[]; queryTimeMs: number }> {
    const start = Date.now();

    // Generate embedding for the query
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
      .limit(options.limit ?? 10)
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
    }
  ): Promise<{
    answer: string;
    threadId: DbId<'ChatThread'>;
    sources: SearchResult[];
  }> {
    // Search for relevant context
    const { results } = await this.query(orgId, message, {
      collectionId: options.collectionId,
      limit: 5,
    });

    const context = results.map((r) => r.content).join('\n\n---\n\n');

    // Generate answer
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: `You are a helpful assistant that answers questions based on the provided context. If the context doesn't contain relevant information, say so. Always cite the source when possible.`,
      prompt: `Context:\n${context}\n\nQuestion: ${message}`,
    });

    // Create or update chat thread
    const orgNum = extractOrgNumericId(orgId);
    let threadId = options.threadId;

    if (!threadId) {
      const thread = await this.db.kysely
        .insertInto('data.chat_threads')
        .values({
          id: packId('ChatThread', orgNum),
          title: message.slice(0, 100),
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

    return {
      answer: text,
      threadId,
      sources: results,
    };
  }
}
