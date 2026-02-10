import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import * as bcrypt from 'bcryptjs';
import { Request } from 'express';

import { extractOrgNumericId } from '@fastdex/common';

import { DbService } from '../../db/db.module';

/**
 * Guard that validates X-API-Key header for external API access.
 * Finds the API key by the fdx_ prefix, verifies bcrypt hash,
 * and attaches the orgId to the request.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private db: DbService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    if (!apiKey.startsWith('fdx_')) {
      throw new UnauthorizedException('Invalid API key format');
    }

    // Extract prefix (first 12 chars) for lookup
    const prefix = apiKey.slice(0, 12);

    const keyRecord = await this.db.kysely
      .selectFrom('api.api_keys')
      .select(['id', 'key_hash', 'org_id', 'revoked_at'])
      .where('key_prefix', '=', prefix)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();

    if (!keyRecord) {
      throw new UnauthorizedException('Invalid API key');
    }

    const isValid = await bcrypt.compare(apiKey, keyRecord.key_hash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Update last_used_at
    await this.db.kysely
      .updateTable('api.api_keys')
      .set({ last_used_at: new Date() })
      .where('id', '=', keyRecord.id)
      .execute();

    // Attach org info to request for downstream use
    request.apiKeyOrgId = keyRecord.org_id;
    request.apiKeyOrgNumericId = extractOrgNumericId(keyRecord.org_id);

    return true;
  }
}
