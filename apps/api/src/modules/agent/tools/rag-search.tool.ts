import { Inject, Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import {
  AiCallerType,
  CHUNK_META_DESCRIPTIONS,
  chunkMetaTypeEnum,
  type MetadataFilter,
} from '@grabdy/contracts';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { DbService } from '../../../db/db.module';
import { SearchService } from '../../retrieval/search.service';
import type { FileStorage } from '../../storage/file-storage.interface';
import { FILE_STORAGE } from '../../storage/file-storage.interface';

@Injectable()
export class RagSearchTool {
  private readonly logger = new Logger(RagSearchTool.name);

  constructor(
    private db: DbService,
    @Inject(FILE_STORAGE) private storage: FileStorage,
    private searchService: SearchService
  ) {}

  create(
    orgId: DbId<'Org'>,
    collectionIds?: DbId<'Collection'>[],
    defaultTopK = 5,
    userId?: DbId<'User'> | null
  ) {
    const db = this.db;
    const storage = this.storage;
    const searchService = this.searchService;

    const metadataDesc = Object.entries(CHUNK_META_DESCRIPTIONS)
      .map(([type, shape]) => `${type}: ${shape}`)
      .join(', ');

    return createTool({
      id: 'rag-search',
      description: `Search the knowledge base. Each result includes:
- content: the matched text
- contextBefore/contextAfter: surrounding text from adjacent chunks for richer context
- dataSourceName: human-readable source name
- sourceUrl: direct link to the source (use this to create clickable links when citing)
- metadata: depends on type — ${metadataDesc}
- extractedImages: image URLs from documents (if any)

Use metadata to give context (page numbers, sheet names, Slack authors, etc.) when citing sources.

You can optionally filter by source type (PDF, SLACK, LINEAR, etc.) or by Slack author name.

searchMeta.suggestion will tell you if results have low relevance and you should refine your query.`,
      inputSchema: z.object({
        query: z.string().describe('The search query to find relevant documents'),
        topK: z.number().optional().default(defaultTopK).describe('Number of results to return'),
        sourceTypes: z
          .array(chunkMetaTypeEnum)
          .optional()
          .describe('Filter by source type: PDF, DOCX, SLACK, LINEAR, GITHUB, NOTION, etc.'),
        slackAuthor: z
          .string()
          .optional()
          .describe('Filter Slack messages by author name (matches any author in the chunk)'),
      }),
      execute: async (input) => {
        // Build metadata filters from simplified agent params
        const filters: MetadataFilter[] = [];
        if (input.sourceTypes && input.sourceTypes.length > 0) {
          if (input.sourceTypes.length === 1) {
            filters.push({ field: 'type', operator: 'eq', value: input.sourceTypes[0] });
          } else {
            filters.push({ field: 'type', operator: 'in', value: input.sourceTypes });
          }
        }
        if (input.slackAuthor) {
          filters.push({ field: 'slackAuthors', operator: 'eq', value: input.slackAuthor });
        }

        const { results, queryTimeMs } = await searchService.search(orgId, input.query, {
          collectionIds,
          limit: input.topK,
          filters: filters.length > 0 ? filters : undefined,
          callerType: AiCallerType.SYSTEM,
          source: 'SYSTEM',
          userId,
          rerank: true,
          hyde: true,
          expandContext: true,
        });

        // Collect unique data source IDs to query for extracted images
        const dataSourceIds = [...new Set(results.map((r) => r.dataSourceId))];

        // Query extracted images for matched data sources
        let extractedImageUrls: Array<{
          dataSourceId: DbId<'DataSource'>;
          url: string;
          pageNumber: number | null;
          aiDescription: string | null;
        }> = [];

        if (dataSourceIds.length > 0) {
          const images = await db.kysely
            .selectFrom('data.extracted_images')
            .select(['data_source_id', 'storage_path', 'page_number', 'ai_description'])
            .where('data_source_id', 'in', dataSourceIds)
            .where('org_id', '=', orgId)
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

        // Compute search meta for agent feedback
        const suggestion =
          results.length === 0
            ? 'No results found. Consider searching with different terms or breaking the query into sub-queries.'
            : null;

        return {
          results: results.map((r) => ({
            chunkId: r.chunkId,
            content: r.content,
            score: Number(r.score),
            metadata: r.metadata,
            dataSourceName: r.dataSourceName,
            dataSourceId: r.dataSourceId,
            sourceUrl: r.sourceUrl,
            collectionId: r.collectionId,
            contextBefore: r.contextBefore,
            contextAfter: r.contextAfter,
          })),
          extractedImages: extractedImageUrls.length > 0 ? extractedImageUrls : undefined,
          searchMeta: {
            queryTimeMs,
            totalResults: results.length,
            suggestion,
          },
        };
      },
    });
  }
}
