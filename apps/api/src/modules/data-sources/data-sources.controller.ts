import { Controller, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { type DbId } from '@grabdy/common';
import { dataSourcesContract } from '@grabdy/contracts';

import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';

import { DataSourcesService } from './data-sources.service';

function toISOString(date: Date): string {
  return date.toISOString();
}

@Controller()
export class DataSourcesController {
  constructor(private dataSourcesService: DataSourcesService) {}

  @OrgAccess(dataSourcesContract.upload, { params: ['orgId'] })
  @TsRestHandler(dataSourcesContract.upload)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async upload(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File
  ) {
    return tsRestHandler(dataSourcesContract.upload, async ({ params, body }) => {
      try {
        if (!file) {
          return {
            status: 400 as const,
            body: { success: false as const, error: 'No file uploaded' },
          };
        }

        const dataSource = await this.dataSourcesService.upload(
          params.orgId,
          user.sub,
          file,
          { name: body.name, collectionId: body.collectionId as DbId<'Collection'> | undefined }
        );

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
      } catch (error) {
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Upload failed',
          },
        };
      }
    });
  }

  @OrgAccess(dataSourcesContract.list, { params: ['orgId'] })
  @TsRestHandler(dataSourcesContract.list)
  async list() {
    return tsRestHandler(dataSourcesContract.list, async ({ params, query }) => {
      const dataSources = await this.dataSourcesService.list(
        params.orgId,
        query.collectionId
      );
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
      try {
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
      } catch {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Data source not found' },
        };
      }
    });
  }

  @OrgAccess(dataSourcesContract.delete, { params: ['orgId', 'id'] })
  @TsRestHandler(dataSourcesContract.delete)
  async delete() {
    return tsRestHandler(dataSourcesContract.delete, async ({ params }) => {
      try {
        await this.dataSourcesService.delete(params.orgId, params.id);
        return {
          status: 200 as const,
          body: { success: true as const },
        };
      } catch {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Data source not found' },
        };
      }
    });
  }

  @OrgAccess(dataSourcesContract.reprocess, { params: ['orgId', 'id'] })
  @TsRestHandler(dataSourcesContract.reprocess)
  async reprocess() {
    return tsRestHandler(dataSourcesContract.reprocess, async ({ params }) => {
      try {
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
      } catch {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Data source not found' },
        };
      }
    });
  }
}
