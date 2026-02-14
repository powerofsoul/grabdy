import { Controller } from '@nestjs/common';

import { collectionsContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { OrgAccess } from '../../common/decorators/org-roles.decorator';

import { CollectionsService } from './collections.service';

function toISOString(date: Date): string {
  return date.toISOString();
}

@Controller()
export class CollectionsController {
  constructor(private collectionsService: CollectionsService) {}

  @OrgAccess(collectionsContract.create, { params: ['orgId'] })
  @TsRestHandler(collectionsContract.create)
  async create() {
    return tsRestHandler(collectionsContract.create, async ({ params, body }) => {
      try {
        const collection = await this.collectionsService.create(params.orgId, body);
        return {
          status: 200 as const,
          body: {
            success: true as const,
            data: {
              ...collection,
              createdAt: toISOString(collection.createdAt),
              updatedAt: toISOString(collection.updatedAt),
            },
          },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Failed to create collection',
          },
        };
      }
    });
  }

  @OrgAccess(collectionsContract.list, { params: ['orgId'] })
  @TsRestHandler(collectionsContract.list)
  async list() {
    return tsRestHandler(collectionsContract.list, async ({ params }) => {
      const collections = await this.collectionsService.list(params.orgId);
      return {
        status: 200 as const,
        body: {
          success: true as const,
          data: collections.map((c) => ({
            ...c,
            createdAt: toISOString(c.createdAt),
            updatedAt: toISOString(c.updatedAt),
          })),
        },
      };
    });
  }

  @OrgAccess(collectionsContract.get, { params: ['orgId', 'collectionId'] })
  @TsRestHandler(collectionsContract.get)
  async get() {
    return tsRestHandler(collectionsContract.get, async ({ params }) => {
      try {
        const collection = await this.collectionsService.findById(params.orgId, params.collectionId);
        return {
          status: 200 as const,
          body: {
            success: true as const,
            data: {
              ...collection,
              createdAt: toISOString(collection.createdAt),
              updatedAt: toISOString(collection.updatedAt),
            },
          },
        };
      } catch {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Collection not found' },
        };
      }
    });
  }

  @OrgAccess(collectionsContract.update, { params: ['orgId', 'collectionId'] })
  @TsRestHandler(collectionsContract.update)
  async update() {
    return tsRestHandler(collectionsContract.update, async ({ params, body }) => {
      try {
        const collection = await this.collectionsService.update(
          params.orgId,
          params.collectionId,
          body
        );
        return {
          status: 200 as const,
          body: {
            success: true as const,
            data: {
              ...collection,
              createdAt: toISOString(collection.createdAt),
              updatedAt: toISOString(collection.updatedAt),
            },
          },
        };
      } catch {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Collection not found' },
        };
      }
    });
  }

  @OrgAccess(collectionsContract.delete, { params: ['orgId', 'collectionId'] })
  @TsRestHandler(collectionsContract.delete)
  async delete() {
    return tsRestHandler(collectionsContract.delete, async ({ params }) => {
      try {
        await this.collectionsService.delete(params.orgId, params.collectionId);
        return {
          status: 200 as const,
          body: { success: true as const },
        };
      } catch {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Collection not found' },
        };
      }
    });
  }
}
