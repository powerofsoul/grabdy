import { Injectable } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core/tools';
import { embed } from 'ai';
import { sql } from 'kysely';
import { z } from 'zod';

import type { DbId } from '@grabdy/common';

import { DbService } from '../../../db/db.module';

@Injectable()
export class RagSearchTool {
  constructor(private db: DbService) {}

  create(orgId: DbId<'Org'>, collectionId?: DbId<'Collection'>) {
    const db = this.db;

    return createTool({
      id: 'rag-search',
      description:
        'Search the knowledge base for relevant information. Use this tool to find context before answering questions.',
      inputSchema: z.object({
        query: z.string().describe('The search query to find relevant documents'),
        topK: z.number().optional().default(5).describe('Number of results to return'),
      }),
      execute: async (input) => {
        const { embedding } = await embed({
          model: openai.embedding('text-embedding-3-small'),
          value: input.query,
        });

        const embeddingStr = `[${embedding.join(',')}]`;

        let query = db.kysely
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

        if (collectionId) {
          query = query.where('data.chunks.collection_id', '=', collectionId);
        }

        const results = await query
          .orderBy(sql`data.chunks.embedding <=> ${embeddingStr}::vector`)
          .limit(input.topK)
          .execute();

        return {
          results: results.map((r) => ({
            chunkId: r.chunk_id,
            content: r.content,
            score: Number(r.score),
            metadata: (r.metadata ?? {}) as Record<string, unknown>,
            dataSourceName: r.data_source_name,
            dataSourceId: r.data_source_id,
          })),
        };
      },
    });
  }
}
