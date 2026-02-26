import { Injectable, Logger } from '@nestjs/common';

import { type DbId, extractOrgNumericId, idBelongsToOrg } from '@grabdy/common';
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
  reasoning: z.string().describe(
    `Before searching, explain what the user is asking, what you expect to find, and why you chose these search terms. 
      Be detailed: 3-6 sentences. Don't skip this step. 
      This is your chance to plan your search strategy and show your work. 
      The text you write here is NOT part of your final answer, 
      it is only for your own reasoning and will be visible to the user as a "thinking" message while the search is in progress.
      You should not mention things like the user will asked for X and you need to search for Y, but rather focus on the core question and what terms or concepts are most relevant to search for AND why you chose them.`
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
      sourceUrl: z.string().nullable(),
      score: z.number(),
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

  systemPrompt = `## Search strategy

You are a researcher. Search aggressively. One search is almost never enough.

**Before searching:**
- Restate what the user is asking in your own words via the \`reasoning\` field. What is the core question?
- What specific terms, concepts, or keywords should you search for?
- What alternative phrasings or synonyms might yield better results?

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

**After results come back:**
- How many results came back? Are they relevant or off-topic?
- What is still missing? What gaps remain in your understanding?
- What new terms or concepts appeared in the results that you should search for next?
- If you are not 90% sure you have the right information, keep searching.
- Only after thorough searching should you conclude and move on to formulating your final answer.

**Before your final answer:**
- Summarize all the facts you gathered across all searches.
- How do the sources agree or contradict each other?
- What is your confidence level? Is the answer well-supported or partial?

**Rules:**
- Never mention scores, metadata field names, internal IDs, or storage keys in your answer text.
- NEVER put reasoning in your text output. Text output = final answer only.`;
  private readonly logger = new Logger(RagSearchTool.name);

  constructor(private searchService: SearchService) {}

  create(orgId: DbId<'Org'>, scope: SearchScope, defaultTopK = 5, userId?: DbId<'User'> | null) {
    const collectionIds = scope.type === 'scoped' ? scope.collectionIds : undefined;
    const dataSourceIds = scope.type === 'scoped' ? scope.dataSourceIds : undefined;
    this.idsBelongToSameOrg(orgId, ...(collectionIds ?? []), ...(dataSourceIds ?? []));

    const searchService = this.searchService;

    const metadataDesc = Object.entries(CHUNK_META_DESCRIPTIONS)
      .map(([type, shape]) => `${type}: ${shape}`)
      .join(', ');

    return tool({
      description: `Search the knowledge base. Each result includes content, contextBefore/contextAfter, dataSourceName, sourceUrl, score, and metadata (${metadataDesc}).
Pass source data to cite-sources after your answer. NEVER write source names, file names, or URLs in your text output.
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
          ...(r.contextBefore ? { contextBefore: r.contextBefore } : {}),
          ...(r.contextAfter ? { contextAfter: r.contextAfter } : {}),
        }));

        this.idsBelongToSameOrg(orgId, ...cleanResults.map((r) => r.dataSourceId));

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

  private idsBelongToSameOrg(orgId: DbId<'Org'>, ...ids: string[]) {
    const orgNumericId = extractOrgNumericId(orgId);

    const allBelong = ids.every((id) => idBelongsToOrg(id, orgNumericId));
    if (!allBelong) {
      throw new Error(`One or more IDs do not belong to org ${orgId}`);
    }
  }
}
