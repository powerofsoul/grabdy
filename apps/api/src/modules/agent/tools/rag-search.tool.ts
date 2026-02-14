import { Inject, Injectable, Logger } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import type { DbId } from '@grabdy/common';
import { EMBEDDING_MODEL } from '@grabdy/contracts';
import { createTool } from '@mastra/core/tools';
import { embed } from 'ai';
import { sql } from 'kysely';
import { z } from 'zod';

import { DbService } from '../../../db/db.module';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
import { AiCallerType, AiRequestType } from '../../../db/enums';
import { AiUsageService } from '../../ai/ai-usage.service';
import type { FileStorage } from '../../storage/file-storage.interface';
import { FILE_STORAGE } from '../../storage/file-storage.interface';

@Injectable()
export class RagSearchTool {
  private readonly logger = new Logger(RagSearchTool.name);

  constructor(
    private db: DbService,
    @Inject(FILE_STORAGE) private storage: FileStorage,
    private aiUsageService: AiUsageService,
  ) {}

  create(orgId: DbId<'Org'>, collectionIds?: DbId<'Collection'>[], defaultTopK = 5) {
    const db = this.db;
    const storage = this.storage;
    const aiUsageService = this.aiUsageService;
    const logger = this.logger;

    return createTool({
      id: 'rag-search',
      description:
        'Search the knowledge base for relevant information. Use this tool to find context before answering questions. Results may include extracted image URLs from documents.',
      inputSchema: z.object({
        query: z.string().describe('The search query to find relevant documents'),
        topK: z.number().optional().default(defaultTopK).describe('Number of results to return'),
      }),
      execute: async (input) => {
        const { embedding, usage } = await embed({
          model: openai.embedding('text-embedding-3-small'),
          value: input.query,
        });

        // Log embedding usage
        aiUsageService.logUsage(
          EMBEDDING_MODEL,
          usage.tokens,
          0,
          AiCallerType.SYSTEM,
          AiRequestType.EMBEDDING,
          { orgId },
        ).catch((err) => logger.error(`RAG embedding usage logging failed: ${err}`));

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
            'data.data_sources.collection_id',
            sql<number>`1 - (data.chunks.embedding <=> ${embeddingStr}::vector)`.as('score'),
          ])
          .where('data.chunks.org_id', '=', orgId);

        if (collectionIds && collectionIds.length > 0) {
          query = query.where('data.chunks.collection_id', 'in', collectionIds);
        }

        const results = await query
          .orderBy(sql`data.chunks.embedding <=> ${embeddingStr}::vector`)
          .limit(input.topK)
          .execute();

        // Collect unique data source IDs to query for extracted images
        const dataSourceIds = [...new Set(results.map((r) => r.data_source_id))];

        // Query extracted images for matched data sources
        let extractedImageUrls: Array<{ dataSourceId: DbId<'DataSource'>; url: string; pageNumber: number | null; aiDescription: string | null }> = [];
        if (dataSourceIds.length > 0) {
          const images = await db.kysely
            .selectFrom('data.extracted_images')
            .select(['data_source_id', 'storage_path', 'page_number', 'ai_description'])
            .where('data_source_id', 'in', dataSourceIds)
            .orderBy('page_number', 'asc')
            .limit(10)
            .execute();

          extractedImageUrls = await Promise.all(
            images.map(async (img) => ({
              dataSourceId: img.data_source_id,
              url: await storage.getUrl(img.storage_path),
              pageNumber: img.page_number,
              aiDescription: img.ai_description,
            }))
          );
        }

        return {
          results: results.map((r) => ({
            chunkId: r.chunk_id,
            content: r.content,
            score: Number(r.score),
            metadata: isRecord(r.metadata) ? r.metadata : {},
            dataSourceName: r.data_source_name,
            dataSourceId: r.data_source_id,
            collectionId: r.collection_id,
          })),
          extractedImages: extractedImageUrls.length > 0 ? extractedImageUrls : undefined,
        };
      },
    });
  }
}
