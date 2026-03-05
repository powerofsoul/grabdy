import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';

import { type DbId, dbIdSchema, extractOrgNumericId } from '@grabdy/common';
import type { Request, Response } from 'express';
import { sql } from 'kysely';

import { Public } from '../../common/decorators/public.decorator';
import { DualAuthGuard, OptionalDualAuthGuard } from '../../common/guards/dual-auth.guard';
import { DbService } from '../../db/db.module';
import { DataSourcesService } from '../data-sources/data-sources.service';
import { S3FileStorage } from '../storage/s3-file-storage';

@Controller()
export class ProxyController {
  constructor(
    private dataSourcesService: DataSourcesService,
    private storage: S3FileStorage,
    private db: DbService
  ) {}

  /**
   * Short image proxy: resolves an extracted image ID to a presigned S3 URL.
   * Uses a single UUID in the URL so the LLM is less likely to corrupt the path.
   */
  @Public()
  @UseGuards(OptionalDualAuthGuard)
  @Get('orgs/:orgId/img/:imageId')
  async imageProxy(
    @Param('orgId') orgIdRaw: string,
    @Param('imageId') imageIdRaw: string,
    @Query('share_token') shareToken: string | undefined,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const orgId = dbIdSchema('Org').parse(orgIdRaw);
    const imageId = dbIdSchema('ExtractedImage').parse(imageIdRaw);

    // Allow access via valid public share token (scoped to images in that share)
    if (shareToken) {
      const row = await this.db.kysely
        .selectFrom('data.shared_chats')
        .select('id')
        .where('share_token', '=', shareToken)
        .where('org_id', '=', orgId)
        .where('revoked', '=', false)
        .where('is_public', '=', true)
        .where(sql<boolean>`${sql.val(imageId)}::uuid = ANY(image_ids)`)
        .executeTakeFirst();

      if (row) {
        try {
          const url = await this.dataSourcesService.getExtractedImageUrl(orgId, imageId);
          res.redirect(url);
          return;
        } catch {
          res.status(404).json({ error: 'Not found' });
          return;
        }
      }

      // Invalid share token, don't fall through to auth
      res.status(404).json({ error: 'Not found' });
      return;
    }

    // Fall through to standard auth
    this.verifyOrgAccess(orgId, req, res);
    if (res.headersSent) return;

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
   * Accepts dashboard cookie auth.
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

    // Upload paths are stored as `uploads/<orgId>/...` (no orgId prefix),
    // while other paths (extracted-images, collections) use `<orgId>/...`.
    // Reconstruct the correct S3 key based on the path shape.
    let key: string;
    if (relativePath.startsWith(`uploads/${orgId}/`)) {
      key = relativePath;
    } else if (relativePath.startsWith('uploads/')) {
      // Upload path for a different org
      res.status(403).json({ error: 'Forbidden' });
      return;
    } else {
      key = `${orgId}/${relativePath}`;
    }

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
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  }
}
