import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import {
  AiCallerType,
  CHUNK_META_DESCRIPTIONS,
  type ChunkMeta,
  chunkMetaTypeEnum,
  type MetadataFilter,
} from '@grabdy/contracts';
import { tool } from 'ai';
import { z } from 'zod';

import { env } from '../../../config/env.config';
import { SearchService } from '../../retrieval/search.service';

@Injectable()
export class RagSearchTool {
  private readonly logger = new Logger(RagSearchTool.name);

  constructor(private searchService: SearchService) {}

  create(
    orgId: DbId<'Org'>,
    collectionIds?: DbId<'Collection'>[],
    dataSourceIds?: DbId<'DataSource'>[],
    defaultTopK = 5,
    userId?: DbId<'User'> | null
  ) {
    const searchService = this.searchService;

    const metadataDesc = Object.entries(CHUNK_META_DESCRIPTIONS)
      .map(([type, shape]) => `${type}: ${shape}`)
      .join(', ');

    return tool({
      description: `Search the knowledge base. Each result includes:
- content: the matched text
- contextBefore/contextAfter: surrounding text from adjacent chunks for richer context
- dataSourceName: human-readable source name
- sourceUrl: direct link to the source (use this to create clickable links when citing)
- imageUrl: if this result is an image, a URL to display it. Use markdown ![description](imageUrl) to show it.
- metadata: depends on type. ${metadataDesc}
Use metadata to give context (page numbers, sheet names, Slack authors, etc.) when citing sources.
Never mention internal field names, IDs, scores, or storage keys in your response.

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
          dataSourceIds,
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

        // Build stable image URLs and strip internal metadata
        const cleanResults = results.map((r) => {
          let imageUrl: string | undefined;
          const meta: ChunkMeta | null = r.metadata;
          if (meta && meta.type === 'PDF' && meta.imageStorageKey) {
            const encodedKey = Buffer.from(meta.imageStorageKey).toString('base64url');
            imageUrl = `${env.apiUrl}/orgs/${orgId}/storage/${encodedKey}`;
          }

          // Strip internal fields from metadata before passing to the AI
          let cleanMeta = r.metadata;
          if (cleanMeta && cleanMeta.type === 'PDF') {
            const { imageStorageKey: _, ...rest } = cleanMeta;
            cleanMeta = rest;
          }

          return {
            content: r.content,
            dataSourceId: r.dataSourceId,
            dataSourceName: r.dataSourceName,
            sourceUrl: r.sourceUrl,
            score: r.score,
            metadata: cleanMeta,
            ...(imageUrl ? { imageUrl } : {}),
            ...(r.contextBefore ? { contextBefore: r.contextBefore } : {}),
            ...(r.contextAfter ? { contextAfter: r.contextAfter } : {}),
          };
        });

        return {
          results: cleanResults,
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
