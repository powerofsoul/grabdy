import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import {
  AiCallerType,
  CHUNK_META_DESCRIPTIONS,
  chunkMetaTypeEnum,
  type MetadataFilter,
} from '@grabdy/contracts';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { SearchService } from '../../retrieval/search.service';

@Injectable()
export class RagSearchTool {
  private readonly logger = new Logger(RagSearchTool.name);

  constructor(private searchService: SearchService) {}

  create(
    orgId: DbId<'Org'>,
    collectionIds?: DbId<'Collection'>[],
    defaultTopK = 5,
    userId?: DbId<'User'> | null
  ) {
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
