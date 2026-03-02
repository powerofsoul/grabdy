import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';

import { env } from '../../config/env.config';

@Injectable()
export class ProxyService {
  extractedImageUrl(orgId: DbId<'Org'>, imageId: DbId<'ExtractedImage'>): string {
    return `${env.apiUrl}/orgs/${orgId}/img/${imageId}`;
  }

  storageProxyUrl(orgId: DbId<'Org'>, storagePath: string): string {
    // Use the storage path directly as URL path segments (strip orgId/ prefix since it's in the URL)
    const prefix = `${orgId}/`;
    const relativePath = storagePath.startsWith(prefix)
      ? storagePath.slice(prefix.length)
      : storagePath;
    return `${env.apiUrl}/orgs/${orgId}/f/${relativePath}`;
  }
}
