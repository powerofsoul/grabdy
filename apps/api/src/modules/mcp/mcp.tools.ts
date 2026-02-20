import { Injectable } from '@nestjs/common';

import { type DbId, dbIdSchema, extractOrgNumericId, idBelongsToOrg } from '@grabdy/common';
import { type MetadataFilter, metadataFilterSchema } from '@grabdy/contracts';
import { Tool } from '@rekog/mcp-nest';
import type { Request } from 'express';
import { z } from 'zod';

import { CollectionsService } from '../collections/collections.service';
import { RetrievalService } from '../public-api/retrieval.service';

// ApiKeyGuard guarantees request.apiKey is set before any tool runs.
function getApiKeyContext(request: Request) {
  const ctx = request.apiKey;
  if (!ctx) throw new Error('ApiKeyGuard did not set request.apiKey');
  return ctx;
}

@Injectable()
export class McpTools {
  constructor(
    private retrievalService: RetrievalService,
    private collectionsService: CollectionsService
  ) {}

  @Tool({
    name: 'search',
    description:
      'Search across your uploaded data for relevant content. Supports metadata filters to narrow results by source type, author, etc.',
    parameters: z.object({
      query: z.string().describe('The search query'),
      collectionIds: z
        .array(dbIdSchema('Collection'))
        .optional()
        .describe('Collection IDs to search within'),
      limit: z.number().min(1).max(50).default(10).describe('Maximum number of results'),
      filters: z
        .array(metadataFilterSchema)
        .optional()
        .describe('Metadata filters to narrow results (e.g., by type, slackAuthors)'),
      hyde: z.boolean().optional().describe('Enable HyDE for better semantic matching'),
      expandContext: z.boolean().optional().describe('Include surrounding chunk context'),
    }),
  })
  async search(
    {
      query,
      collectionIds: rawCollectionIds,
      limit,
      filters,
      hyde,
      expandContext,
    }: {
      query: string;
      collectionIds?: DbId<'Collection'>[];
      limit: number;
      filters?: MetadataFilter[];
      hyde?: boolean;
      expandContext?: boolean;
    },
    _context: unknown,
    request: Request
  ) {
    const ctx = getApiKeyContext(request);

    if (rawCollectionIds) {
      const orgNumericId = extractOrgNumericId(ctx.orgId);
      for (const id of rawCollectionIds) {
        if (!idBelongsToOrg(id, orgNumericId)) {
          throw new Error('Invalid collection ID');
        }
      }
    }

    const result = await this.retrievalService.query(ctx.orgId, query, {
      collectionIds: rawCollectionIds,
      limit,
      filters,
      hyde: hyde ?? false,
      expandContext: expandContext ?? false,
    });

    return {
      content: result.results.map((r) => ({
        type: 'text' as const,
        text: `[${r.dataSourceName}] (score: ${r.score.toFixed(3)})\n${r.content}`,
      })),
    };
  }

  @Tool({
    name: 'list_collections',
    description: 'List all available data collections',
    parameters: z.object({}),
  })
  async listCollections(_args: Record<string, never>, _context: unknown, request: Request) {
    const ctx = getApiKeyContext(request);

    const collections = await this.collectionsService.list(ctx.orgId);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            collections.map((c) => ({
              id: c.id,
              name: c.name,
              description: c.description,
              sourceCount: c.sourceCount,
              chunkCount: c.chunkCount,
            })),
            null,
            2
          ),
        },
      ],
    };
  }
}
