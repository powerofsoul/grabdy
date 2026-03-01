import { Injectable, Logger } from '@nestjs/common';

import { assertIdsInOrg, type DbId } from '@grabdy/common';
import type { StreamChunk } from '@grabdy/contracts';
import {
  AiCallerType,
  CHUNK_META_DESCRIPTIONS,
  chunkMetaTypeEnum,
  type MetadataFilter,
} from '@grabdy/contracts';
import { tool } from 'ai';
import { z } from 'zod';

import { SearchService } from '../../retrieval/search.service';
import type { SearchScope } from '../agents/search-scope';
import type { Tool, ToolCallContext } from '../base-tool';

// ---------------------------------------------------------------------------
// Schemas & derived types
// ---------------------------------------------------------------------------

const ragInputSchema = z.object({
  reasoning: z
    .string()
    .describe(
      'Brief reasoning about what you are searching for and why. Shown to the user as a thinking indicator. Focus on the core question and search terms, not meta-commentary.'
    ),
  query: z.string().describe('The search query to find relevant documents'),
  topK: z.number().optional().describe('Number of results to return'),
  sourceTypes: z
    .array(chunkMetaTypeEnum)
    .optional()
    .describe('Filter by source type: PDF, DOCX, SLACK, LINEAR, GITHUB, NOTION, etc.'),
  slackAuthor: z
    .string()
    .optional()
    .describe('Filter Slack messages by author name (matches any author in the chunk)'),
});

const ragOutputSchema = z.object({
  results: z.array(
    z.object({
      content: z.string(),
      dataSourceId: z.string(),
      dataSourceName: z.string(),
      type: z.string(),
      sourceUrl: z.string().nullable(),
      imageUrl: z.string().nullable(),
      score: z.number(),
      pages: z.array(z.number()).optional(),
      sheet: z.string().optional(),
      row: z.number().optional(),
      columns: z.array(z.string()).optional(),
      contextBefore: z.string().optional(),
      contextAfter: z.string().optional(),
    })
  ),
  searchMeta: z.object({
    queryTimeMs: z.number(),
    totalResults: z.number(),
    suggestion: z.string().nullable(),
  }),
});

type RagSearchInput = z.infer<typeof ragInputSchema>;
type RagSearchOutput = z.infer<typeof ragOutputSchema>;

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

@Injectable()
export class RagSearchTool implements Tool<RagSearchInput, RagSearchOutput> {
  static readonly TOOL_NAME = 'rag-search' as const;
  readonly toolName = RagSearchTool.TOOL_NAME;

  systemPrompt = `## Search tips

- Use short keyword queries (3-6 words), not full sentences.
- If results are insufficient, try synonyms or different terms.
- For complex questions, decompose into sub-queries.
- If \`searchMeta.suggestion\` is set, reformulate and try again.
- Stop when you have a clear answer or when repeated searches return the same results.
- Never mention scores, metadata fields, or internal IDs in your answer.`;
  private readonly logger = new Logger(RagSearchTool.name);

  constructor(private searchService: SearchService) {}

  create(orgId: DbId<'Org'>, scope: SearchScope, defaultTopK = 5, userId?: DbId<'User'> | null) {
    const collectionIds = scope.type === 'scoped' ? scope.collectionIds : undefined;
    const dataSourceIds = scope.type === 'scoped' ? scope.dataSourceIds : undefined;
    const connectionIds = scope.type === 'scoped' ? scope.connectionIds : undefined;
    const connectionResources = scope.type === 'scoped' ? scope.connectionResources : undefined;
    assertIdsInOrg(
      orgId,
      ...(collectionIds ?? []),
      ...(dataSourceIds ?? []),
      ...(connectionIds ?? []),
      ...(connectionResources ?? []).map((cr) => cr.connectionId)
    );

    const searchService = this.searchService;

    const metadataDesc = Object.entries(CHUNK_META_DESCRIPTIONS)
      .map(([type, shape]) => `${type}: ${shape}`)
      .join(', ');

    return tool({
      description: `Search the knowledge base. Each result includes content, contextBefore/contextAfter, dataSourceName, type, sourceUrl, imageUrl, score, and metadata (${metadataDesc}).
NEVER write source names, file names, or URLs in your text output (except imageUrl for inline images).
Filter by source type (PDF, SLACK, LINEAR, etc.) or Slack author name.
searchMeta.suggestion tells you if results have low relevance and you should refine your query.`,
      inputSchema: ragInputSchema.extend({
        topK: ragInputSchema.shape.topK.default(defaultTopK),
      }),
      outputSchema: ragOutputSchema,
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
          connectionIds,
          connectionResources,
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
          type: r.metadata?.type ?? 'TXT',
          sourceUrl: r.sourceUrl,
          imageUrl: r.imageUrl,
          score: r.score,
          ...(r.metadata && 'pages' in r.metadata ? { pages: r.metadata.pages } : {}),
          ...(r.metadata && 'sheet' in r.metadata ? { sheet: r.metadata.sheet } : {}),
          ...(r.metadata && 'row' in r.metadata ? { row: r.metadata.row } : {}),
          ...(r.metadata && 'columns' in r.metadata ? { columns: r.metadata.columns } : {}),
          ...(r.contextBefore ? { contextBefore: r.contextBefore } : {}),
          ...(r.contextAfter ? { contextAfter: r.contextAfter } : {}),
        }));

        assertIdsInOrg(orgId, ...cleanResults.map((r) => r.dataSourceId));

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

  onToolCall(ctx: ToolCallContext<RagSearchInput>): StreamChunk | null {
    if (ctx.input.reasoning) {
      return { type: 'thinking', text: ctx.input.reasoning };
    }
    return null;
  }
}
