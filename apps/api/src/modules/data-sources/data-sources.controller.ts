import { Controller, Get, Logger, Param, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { dbIdSchema } from '@grabdy/common';
import { dataSourcesContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Response } from 'express';

import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';
import { MAX_FILE_SIZE_BYTES } from '../../config/constants';

import { DataSourcesService } from './data-sources.service';

function toISOString(date: Date): string {
  return date.toISOString();
}

@Controller()
export class DataSourcesController {
  private readonly logger = new Logger(DataSourcesController.name);

  constructor(private dataSourcesService: DataSourcesService) {}

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
      const dataSources = await this.dataSourcesService.list(params.orgId, query.collectionId);
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

  @OrgAccess(dataSourcesContract.listExtractedImages, { params: ['orgId', 'id'] })
  @TsRestHandler(dataSourcesContract.listExtractedImages)
  async listExtractedImages() {
    return tsRestHandler(dataSourcesContract.listExtractedImages, async ({ params }) => {
      try {
        const images = await this.dataSourcesService.listExtractedImages(params.orgId, params.id);
        return {
          status: 200 as const,
          body: { success: true as const, data: images },
        };
      } catch {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Data source not found' },
        };
      }
    });
  }

  @Get('/files/:orgNum/:filename')
  async serveFile(
    @Param('orgNum') orgNum: string,
    @Param('filename') filename: string,
    @Res() res: Response
  ) {
    try {
      const key = `${orgNum}/${filename}`;
      const buffer = await this.dataSourcesService.getFileBuffer(key);
      const ext = filename.split('.').pop()?.toLowerCase() ?? '';
      type ServableExt =
        | 'pdf'
        | 'csv'
        | 'txt'
        | 'json'
        | 'docx'
        | 'xlsx'
        | 'xls'
        | 'png'
        | 'jpg'
        | 'jpeg'
        | 'webp'
        | 'gif';
      const mimeMap: Record<ServableExt, string> = {
        pdf: 'application/pdf',
        csv: 'text/csv',
        txt: 'text/plain',
        json: 'application/json',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls: 'application/vnd.ms-excel',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        gif: 'image/gif',
      };
      const isServableExt = (e: string): e is ServableExt => e in mimeMap;
      res.setHeader('Content-Type', isServableExt(ext) ? mimeMap[ext] : 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      this.logger.warn(`File serve failed: ${error instanceof Error ? error.message : error}`);
      res.status(404).json({ error: 'File not found' });
    }
  }
}
