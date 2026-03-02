import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { type DbId, dbIdSchema, extractOrgNumericId } from '@grabdy/common';
import { dataSourcesContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import type { Request, Response } from 'express';

import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { DualAuthGuard } from '../../common/guards/dual-auth.guard';
import { MAX_FILE_SIZE_BYTES } from '../../config/constants';
import { S3FileStorage } from '../storage/s3-file-storage';

import { DataSourcesService } from './data-sources.service';

function toISOString(date: Date): string {
  return date.toISOString();
}

@Controller()
export class DataSourcesController {
  constructor(
    private dataSourcesService: DataSourcesService,
    private storage: S3FileStorage
  ) {}

  @OrgAccess(dataSourcesContract.upload, { params: ['orgId'] })
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
        ? body.collectionId.replace(/^"|"$/g, '')
        : undefined;

      const dataSource = await this.dataSourcesService.upload(params.orgId, user.sub, file, {
        name: body.name ? body.name.replace(/^"|"$/g, '') : undefined,
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

  @OrgAccess(dataSourcesContract.list, { params: ['orgId'] })
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

  @OrgAccess(dataSourcesContract.delete, { params: ['orgId', 'id'] })
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

  @OrgAccess(dataSourcesContract.reprocess, { params: ['orgId', 'id'] })
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

  @OrgAccess(dataSourcesContract.rename, { params: ['orgId', 'id'] })
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

  /**
   * Short image proxy: resolves an extracted image ID to a presigned S3 URL.
   * Uses a single UUID in the URL so the LLM is less likely to corrupt the path.
   */
  @Public()
  @UseGuards(DualAuthGuard)
  @Get('orgs/:orgId/img/:imageId')
  async imageProxy(
    @Param('orgId') orgIdRaw: string,
    @Param('imageId') imageIdRaw: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const orgId = dbIdSchema('Org').parse(orgIdRaw);
    this.verifyOrgAccess(orgId, req, res);
    if (res.headersSent) return;

    const imageId = dbIdSchema('ExtractedImage').parse(imageIdRaw);

    try {
      const url = await this.dataSourcesService.getExtractedImageUrl(orgId, imageId);
      res.redirect(url);
    } catch {
      res.status(404).json({ error: 'Not found' });
    }
  }

  /**
   * Short file proxy: redirects to a fresh presigned S3 URL.
   * The AI embeds these URLs in markdown so they must not expire.
   * The file path is passed directly as URL path segments for short URLs.
   *
   * Accepts both dashboard cookie auth and SDK Bearer auth.
   */
  @Public()
  @UseGuards(DualAuthGuard)
  @Get('orgs/:orgId/f/*path')
  async fileProxy(@Param('orgId') orgIdRaw: string, @Req() req: Request, @Res() res: Response) {
    const orgId = dbIdSchema('Org').parse(orgIdRaw);
    this.verifyOrgAccess(orgId, req, res);
    if (res.headersSent) return;

    // Extract the wildcard path after /f/
    const fullPath = req.path;
    const marker = `/f/`;
    const markerIdx = fullPath.indexOf(marker);
    if (markerIdx === -1) {
      res.status(400).json({ error: 'Invalid path' });
      return;
    }
    const relativePath = decodeURIComponent(fullPath.slice(markerIdx + marker.length));
    if (relativePath.includes('..')) {
      res.status(400).json({ error: 'Invalid path' });
      return;
    }
    const key = `${orgId}/${relativePath}`;

    try {
      const url = await this.storage.getUrl(key);
      res.redirect(url);
    } catch {
      res.status(404).json({ error: 'Not found' });
    }
  }

  /**
   * Legacy storage proxy (base64url-encoded key). Kept for backward compatibility.
   */
  @Public()
  @UseGuards(DualAuthGuard)
  @Get('orgs/:orgId/storage/:encodedKey')
  async storageProxy(
    @Param('orgId') orgIdRaw: string,
    @Param('encodedKey') encodedKey: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const orgId = dbIdSchema('Org').parse(orgIdRaw);
    this.verifyOrgAccess(orgId, req, res);
    if (res.headersSent) return;

    const decoded = Buffer.from(encodedKey, 'base64url').toString('utf-8');
    const key = decoded.startsWith(`${orgId}/`) ? decoded : `${orgId}/${decoded}`;

    try {
      const url = await this.storage.getUrl(key);
      res.redirect(url);
    } catch {
      res.status(404).json({ error: 'Not found' });
    }
  }

  private verifyOrgAccess(orgId: DbId<'Org'>, req: Request, res: Response): void {
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
    }
  }
}
