import { Controller, Req, UseGuards } from '@nestjs/common';

import { dbIdSchema, idBelongsToOrg } from '@grabdy/common';
import { publicApiContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CollectionsService } from '../collections/collections.service';
import { RetrievalService } from '../retrieval/retrieval.service';

function apiError(code: string, message: string) {
  return { success: false as const, error: { code, message } };
}

function parseCollectionIds(ids: string[] | undefined, orgNumericId: Parameters<typeof idBelongsToOrg>[1]) {
  if (!ids) return undefined;
  return ids.map((id) => {
    const parsed = dbIdSchema('Collection').parse(id);
    if (!idBelongsToOrg(parsed, orgNumericId)) {
      throw new Error(`Collection ${id} does not belong to this organization`);
    }
    return parsed;
  });
}

// ApiKeyGuard guarantees request.apiKey is set before any handler runs.
// Helper to access it without redundant null checks.
function getApiKeyContext(req: Request) {
  const ctx = req.apiKey;
  if (!ctx) throw new Error('ApiKeyGuard did not set request.apiKey');
  return ctx;
}

@Controller()
@Public()
@UseGuards(ApiKeyGuard)
export class PublicApiController {
  constructor(
    private retrievalService: RetrievalService,
    private collectionsService: CollectionsService
  ) {}

  @TsRestHandler(publicApiContract.search)
  async search(@Req() req: Request) {
    return tsRestHandler(publicApiContract.search, async ({ body }) => {
      const ctx = getApiKeyContext(req);

      try {
        const collectionIds = parseCollectionIds(body.collectionIds, ctx.orgNumericId);

        const { results, queryTimeMs } = await this.retrievalService.query(ctx.orgId, body.query, {
          collectionIds,
          limit: body.topK,
        });

        return {
          status: 200 as const,
          body: {
            success: true as const,
            data: {
              results: results.map((r) => ({
                content: r.content,
                score: r.score,
                dataSource: { id: r.dataSourceId, name: r.dataSourceName },
                metadata: r.metadata,
              })),
              queryTimeMs,
            },
          },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: apiError('SEARCH_FAILED', error instanceof Error ? error.message : 'Search failed'),
        };
      }
    });
  }

  @TsRestHandler(publicApiContract.query)
  async query(@Req() req: Request) {
    return tsRestHandler(publicApiContract.query, async ({ body }) => {
      const ctx = getApiKeyContext(req);

      try {
        const collectionIds = parseCollectionIds(body.collectionIds, ctx.orgNumericId);

        const result = await this.retrievalService.publicQuery(ctx.orgId, body.query, {
          collectionIds,
          topK: body.topK,
        });

        return {
          status: 200 as const,
          body: { success: true as const, data: result },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: apiError('QUERY_FAILED', error instanceof Error ? error.message : 'Query failed'),
        };
      }
    });
  }

  @TsRestHandler(publicApiContract.listCollections)
  async listCollections(@Req() req: Request) {
    return tsRestHandler(publicApiContract.listCollections, async () => {
      const ctx = getApiKeyContext(req);

      try {
        const collections = await this.collectionsService.list(ctx.orgId);
        return {
          status: 200 as const,
          body: {
            success: true as const,
            data: collections.map((c) => ({
              id: c.id,
              name: c.name,
              description: c.description,
              sourceCount: c.sourceCount,
              chunkCount: c.chunkCount,
              createdAt: new Date(c.createdAt).toISOString(),
              updatedAt: new Date(c.updatedAt).toISOString(),
            })),
          },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: apiError(
            'LIST_FAILED',
            error instanceof Error ? error.message : 'Failed to list collections'
          ),
        };
      }
    });
  }
}
