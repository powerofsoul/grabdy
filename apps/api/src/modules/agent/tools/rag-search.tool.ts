import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import {
  AiCallerType,
  CHUNK_META_DESCRIPTIONS,
  chunkMetaTypeEnum,
  type MetadataFilter,
} from '@grabdy/contracts';
import { tool } from 'ai';
import { z } from 'zod';

import { SearchService } from '../../retrieval/search.service';
import type { Tool } from '../base-tool';

@Injectable()
export class RagSearchTool implements Tool {
  systemPrompt = `## Search strategy

You are a researcher. Search aggressively. One search is almost never enough.

**Query formulation:**
- Use short, keyword-focused queries (3-6 words). Not full sentences.
- Try synonyms, related terms, and different phrasings. Example: "draw star" vs "star shape" vs "polygon" vs "five point" vs "plot star" vs "star coordinates".
- Decompose complex questions into 2-3 sub-queries and search each separately.
- If results mention terms or concepts you had not considered, search for those too.

**When to keep searching:**
- Results are partially relevant but do not fully answer the question. Search with different terms.
- Results mention related concepts, commands, or techniques. Follow up on those.
- \`searchMeta.suggestion\` is set. Reformulate and try again.
- You found general info but not the specific detail the user needs. Narrow down.
- You only did one search. Do at least one more with different terms.

**When to stop:**
- You have found specific, directly relevant information that answers the question.
- You have done 3+ searches with varied terms and nothing relevant came back.
- Additional searches keep returning the same results.

**Rules:**
- Never mention scores, metadata field names, internal IDs, or storage keys in your answer text.`;
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

        const cleanResults = results.map((r) => ({
          content: r.content,
          dataSourceId: r.dataSourceId,
          dataSourceName: r.dataSourceName,
          sourceUrl: r.sourceUrl,
          score: r.score,
          metadata: r.metadata,
          ...(r.contextBefore ? { contextBefore: r.contextBefore } : {}),
          ...(r.contextAfter ? { contextAfter: r.contextAfter } : {}),
        }));

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
