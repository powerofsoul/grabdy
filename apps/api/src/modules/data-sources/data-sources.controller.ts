import {
  Controller,
  Get,
  Logger,
  Param,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { dbIdSchema, extractOrgNumericId } from '@grabdy/common';
import { dataSourcesContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import type { Request, Response } from 'express';

import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { StorageAuthGuard } from '../../common/guards/storage-auth.guard';
import { MAX_FILE_SIZE_BYTES } from '../../config/constants';
import { S3FileStorage } from '../storage/s3-file-storage';

import { DataSourcesService } from './data-sources.service';

function toISOString(date: Date): string {
  return date.toISOString();
}

@Controller()
export class DataSourcesController {
  private readonly logger = new Logger(DataSourcesController.name);

  constructor(
    private dataSourcesService: DataSourcesService,
    private storage: S3FileStorage
  ) {}

  @OrgAccess(dataSourcesContract.upload, { params: ['orgId'] })
  @TsRestHandler(dataSourcesContract.upload)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  async upload(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    return tsRestHandler(dataSourcesContract.upload, async ({ params, body }) => {
      try {
        if (!file) {
          return {
            status: 400 as const,
            body: { success: false as const, error: 'No file uploaded' },
          };
        }

        // Multipart form fields may arrive JSON-encoded (double-quoted strings).
        // Strip surrounding quotes if present.
        const rawCollectionId = body.collectionId
          ? body.collectionId.replace(/^"|"$/g, '')
          : undefined;

        const dataSource = await this.dataSourcesService.upload(params.orgId, user.sub, file, {
          name: body.name ? body.name.replace(/^"|"$/g, '') : undefined,
          collectionId: rawCollectionId
            ? dbIdSchema('Collection').parse(rawCollectionId)
            : undefined,
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
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Upload failed';
        // Improve raw Postgres enum errors
        const userMsg = msg.includes('invalid input value for enum')
          ? 'This file type is not yet supported. Please run database migrations.'
          : msg;
        this.logger.error(`Upload failed: ${msg}`);
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: userMsg,
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
        query.collectionId,
        query.type
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

  @OrgAccess(dataSourcesContract.rename, { params: ['orgId', 'id'] })
  @TsRestHandler(dataSourcesContract.rename)
  async rename() {
    return tsRestHandler(dataSourcesContract.rename, async ({ params, body }) => {
      try {
        const dataSource = await this.dataSourcesService.rename(
          params.orgId,
          params.id,
          body.title
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
      } catch {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Data source not found' },
        };
      }
    });
  }

  @OrgAccess(dataSourcesContract.previewUrl, { params: ['orgId', 'id'] })
  @TsRestHandler(dataSourcesContract.previewUrl)
  async previewUrl() {
    return tsRestHandler(dataSourcesContract.previewUrl, async ({ params }) => {
      try {
        const data = await this.dataSourcesService.getPreviewUrl(params.orgId, params.id);
        return {
          status: 200 as const,
          body: { success: true as const, data },
        };
      } catch {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Data source not found' },
        };
      }
    });
  }

  /**
   * Stable image proxy: redirects to a fresh presigned S3 URL.
   * The AI embeds these URLs in markdown so they must not expire.
   * The key is base64url-encoded to avoid path issues with slashes.
   *
   * Accepts both dashboard cookie auth and SDK Bearer auth.
   */
  @Public()
  @UseGuards(StorageAuthGuard)
  @Get('orgs/:orgId/storage/:encodedKey')
  async storageProxy(
    @Param('orgId') orgIdRaw: string,
    @Param('encodedKey') encodedKey: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const orgId = dbIdSchema('Org').parse(orgIdRaw);

    // Verify the caller has access to this org
    if (req.user) {
      const orgNum = extractOrgNumericId(orgId);
      const hasMembership = req.user.memberships.some((m) => extractOrgNumericId(m.id) === orgNum);
      if (!hasMembership) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    } else if (req.sdkAuth) {
      if (req.sdkAuth.orgId !== orgId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    } else {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const key = Buffer.from(encodedKey, 'base64url').toString('utf-8');

    // Verify the key belongs to this org (keys start with orgId/)
    if (!key.startsWith(`${orgId}/`)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    try {
      const url = await this.storage.getUrl(key);
      res.redirect(url);
    } catch {
      res.status(404).json({ error: 'Not found' });
    }
  }
}
