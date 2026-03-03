import { Controller, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { dbIdSchema } from '@grabdy/common';
import { dataSourcesContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';
import { MAX_FILE_SIZE_BYTES } from '../../config/constants';

import { DataSourcesService } from './data-sources.service';

function toISOString(date: Date): string {
  return date.toISOString();
}

function stripMultipartQuotes(v: string): string {
  return v.replace(/^"|"$/g, '');
}

@Controller()
export class DataSourcesController {
  constructor(private dataSourcesService: DataSourcesService) {}

  @OrgAccess(dataSourcesContract.upload, {
    roles: ['OWNER', 'ADMIN'],
    params: ['orgId'],
    body: (b) => [
      typeof b.collectionId === 'string' ? stripMultipartQuotes(b.collectionId) : b.collectionId,
    ],
  })
  @TsRestHandler(dataSourcesContract.upload)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  async upload(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    return tsRestHandler(dataSourcesContract.upload, async ({ params, body }) => {
      if (!file) {
        return {
          status: 400 as const,
          body: { success: false as const, error: 'No file uploaded' },
        };
      }

      // Multipart form fields may arrive JSON-encoded (double-quoted strings).
      // Strip surrounding quotes if present.
      const rawCollectionId = body.collectionId
        ? stripMultipartQuotes(body.collectionId)
        : undefined;

      const dataSource = await this.dataSourcesService.upload(params.orgId, user.sub, file, {
        name: body.name ? stripMultipartQuotes(body.name) : undefined,
        collectionId: rawCollectionId ? dbIdSchema('Collection').parse(rawCollectionId) : undefined,
      });

      return {
        status: 200 as const,
        body: {
          success: true as const,
          data: {
            ...dataSource,
            createdAt: toISOString(dataSource.createdAt),
            updatedAt: toISOString(dataSource.updatedAt),
          },
        },
      };
    });
  }

  @OrgAccess(dataSourcesContract.list, { params: ['orgId'], query: ['collectionId'] })
  @TsRestHandler(dataSourcesContract.list)
  async list() {
    return tsRestHandler(dataSourcesContract.list, async ({ params, query }) => {
      const dataSources = await this.dataSourcesService.list(params.orgId, {
        collectionId: query.collectionId,
        type: query.type,
        hasCollection: query.hasCollection,
      });
      return {
        status: 200 as const,
        body: {
          success: true as const,
          data: dataSources.map((ds) => ({
            ...ds,
            createdAt: toISOString(ds.createdAt),
            updatedAt: toISOString(ds.updatedAt),
          })),
        },
      };
    });
  }

  @OrgAccess(dataSourcesContract.get, { params: ['orgId', 'id'] })
  @TsRestHandler(dataSourcesContract.get)
  async get() {
    return tsRestHandler(dataSourcesContract.get, async ({ params }) => {
      const dataSource = await this.dataSourcesService.findById(params.orgId, params.id);
      return {
        status: 200 as const,
        body: {
          success: true as const,
          data: {
            ...dataSource,
            createdAt: toISOString(dataSource.createdAt),
            updatedAt: toISOString(dataSource.updatedAt),
          },
        },
      };
    });
  }

  @OrgAccess(dataSourcesContract.delete, { roles: ['OWNER', 'ADMIN'], params: ['orgId', 'id'] })
  @TsRestHandler(dataSourcesContract.delete)
  async delete() {
    return tsRestHandler(dataSourcesContract.delete, async ({ params }) => {
      await this.dataSourcesService.delete(params.orgId, params.id);
      return {
        status: 200 as const,
        body: { success: true as const },
      };
    });
  }

  @OrgAccess(dataSourcesContract.reprocess, { roles: ['OWNER', 'ADMIN'], params: ['orgId', 'id'] })
  @TsRestHandler(dataSourcesContract.reprocess)
  async reprocess() {
    return tsRestHandler(dataSourcesContract.reprocess, async ({ params }) => {
      const dataSource = await this.dataSourcesService.reprocess(params.orgId, params.id);
      return {
        status: 200 as const,
        body: {
          success: true as const,
          data: {
            ...dataSource,
            createdAt: toISOString(dataSource.createdAt),
            updatedAt: toISOString(dataSource.updatedAt),
          },
        },
      };
    });
  }

  @OrgAccess(dataSourcesContract.rename, { roles: ['OWNER', 'ADMIN'], params: ['orgId', 'id'] })
  @TsRestHandler(dataSourcesContract.rename)
  async rename() {
    return tsRestHandler(dataSourcesContract.rename, async ({ params, body }) => {
      const dataSource = await this.dataSourcesService.rename(params.orgId, params.id, body.title);
      return {
        status: 200 as const,
        body: {
          success: true as const,
          data: {
            ...dataSource,
            createdAt: toISOString(dataSource.createdAt),
            updatedAt: toISOString(dataSource.updatedAt),
          },
        },
      };
    });
  }

  @OrgAccess(dataSourcesContract.move, {
    roles: ['OWNER', 'ADMIN'],
    params: ['orgId', 'id'],
    body: (b) => (b.collectionId ? [b.collectionId] : []),
  })
  @TsRestHandler(dataSourcesContract.move)
  async move() {
    return tsRestHandler(dataSourcesContract.move, async ({ params, body }) => {
      await this.dataSourcesService.move(params.orgId, params.id, body.collectionId);
      return {
        status: 200 as const,
        body: { success: true as const },
      };
    });
  }

  @OrgAccess(dataSourcesContract.previewUrl, { params: ['orgId', 'id'] })
  @TsRestHandler(dataSourcesContract.previewUrl)
  async previewUrl() {
    return tsRestHandler(dataSourcesContract.previewUrl, async ({ params }) => {
      const data = await this.dataSourcesService.getPreviewUrl(params.orgId, params.id);
      return {
        status: 200 as const,
        body: { success: true as const, data },
      };
    });
  }
}
