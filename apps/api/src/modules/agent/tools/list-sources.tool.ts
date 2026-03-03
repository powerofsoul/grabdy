import { Injectable } from '@nestjs/common';

import { type DbId, dbIdSchema } from '@grabdy/common';
import { type ChatSource, chatSourceSchema, type StreamChunk } from '@grabdy/contracts';
import { tool } from 'ai';
import { z } from 'zod';

import { DbService } from '../../../db/db.module';
import type { SearchScope } from '../agents/search-scope';
import type { Tool, ToolCallContext, ToolResultContext } from '../base-tool';

const inputSchema = z.object({
  reasoning: z.string().describe('Brief reasoning about why you need to list available sources.'),
  search: z
    .string()
    .optional()
    .describe(
      'Search term to filter sources by name. Case-insensitive partial match. ' +
        'Use this to find specific files or documents instead of listing everything.'
    ),
  page: z
    .number()
    .optional()
    .describe('Page number (1-based). Each page returns up to 100 results. Defaults to 1.'),
});

const outputSchema = z.object({
  sources: z.array(
    z.object({
      dataSourceId: dbIdSchema('DataSource'),
      dataSourceName: z.string(),
      type: z.string(),
      sourceUrl: z.string().nullable(),
    })
  ),
  page: z.number(),
  pageSize: z.number(),
  totalCount: z.number(),
  totalPages: z.number(),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

const PAGE_SIZE = 100;

@Injectable()
export class ListSourcesTool implements Tool<Input, Output> {
  static readonly TOOL_NAME = 'list-sources' as const;
  readonly toolName = ListSourcesTool.TOOL_NAME;

  constructor(private db: DbService) {}

  create(orgId: DbId<'Org'>, scope: SearchScope) {
    const db = this.db;

    return tool({
      description:
        'List data sources available in the current search scope. ' +
        'Returns dataSourceId, dataSourceName, type, and sourceUrl for each source (same fields as rag-search). ' +
        'Use `search` to filter by name (case-insensitive partial match). ' +
        'Paginated: 100 results per page. Use `page` to navigate. ' +
        'Use when the user asks what data is available, references a specific file, or you need source details for citations. ' +
        'Sources are automatically registered for citation. Use {{1}} for the first result, {{2}} for the second, etc.',
      inputSchema,
      outputSchema,
      execute: async (input) => {
        const page = Math.max(1, input.page ?? 1);
        const offset = (page - 1) * PAGE_SIZE;

        let baseQuery = db.kysely
          .selectFrom('data.data_sources')
          .where('org_id', '=', orgId)
          .where('status', '=', 'READY');

        if (scope.type === 'scoped') {
          baseQuery = baseQuery.where((eb) => {
            const parts = [];

            if (scope.collectionIds.length > 0) {
              parts.push(eb('collection_id', 'in', scope.collectionIds));
            }
            if (scope.dataSourceIds.length > 0) {
              parts.push(eb('id', 'in', scope.dataSourceIds));
            }
            if (scope.connectionIds.length > 0) {
              parts.push(eb('connection_id', 'in', scope.connectionIds));
            }
            for (const cr of scope.connectionResources) {
              const escaped = cr.githubRepo.replace(/[%_\\]/g, '\\$&');
              parts.push(
                eb.and([
                  eb('connection_id', '=', cr.connectionId),
                  eb('external_id', 'like', `${escaped}#%`),
                ])
              );
            }

            if (parts.length === 0) {
              return eb('id', 'is', null);
            }
            return parts.length === 1 ? parts[0] : eb.or(parts);
          });
        }

        if (input.search) {
          const escaped = input.search.replace(/[%_\\]/g, '\\$&');
          baseQuery = baseQuery.where('title', 'ilike', `%${escaped}%`);
        }

        const countResult = await baseQuery
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .executeTakeFirstOrThrow();

        const totalCount = parseInt(countResult.count, 10);
        const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

        const rows = await baseQuery
          .select(['id', 'title', 'type', 'source_url'])
          .orderBy('title', 'asc')
          .offset(offset)
          .limit(PAGE_SIZE)
          .execute();

        return {
          sources: rows.map((r) => ({
            dataSourceId: r.id,
            dataSourceName: r.title,
            type: r.type,
            sourceUrl: r.source_url || null,
          })),
          page,
          pageSize: PAGE_SIZE,
          totalCount,
          totalPages,
        };
      },
    });
  }

  onToolCall(ctx: ToolCallContext<Input>): StreamChunk | null {
    if (ctx.input.reasoning) {
      return { type: 'thinking', text: ctx.input.reasoning };
    }
    return null;
  }

  onToolResult(ctx: ToolResultContext<Input, Output>): StreamChunk | null {
    const sources: ChatSource[] = [];

    for (let i = 0; i < ctx.output.sources.length; i++) {
      const s = ctx.output.sources[i];

      const parsed = chatSourceSchema.safeParse({
        ref: i + 1,
        dataSourceId: s.dataSourceId,
        dataSourceName: s.dataSourceName,
        type: s.type,
        sourceUrl: s.sourceUrl,
        imageUrl: null,
        score: 1,
        // Provide defaults for type-specific required fields
        pages: [],
        sheet: '',
        rows: [],
        columns: [],
      });

      if (parsed.success) {
        sources.push(parsed.data);
      }
    }

    if (sources.length === 0) return null;
    return { type: 'sources', sources };
  }
}
