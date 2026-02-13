import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { extractOrgNumericId } from '@grabdy/common';
import * as bcrypt from 'bcryptjs';
import { Request } from 'express';

import { DbService } from '../../db/db.module';

/**
 * Guard that validates Authorization: Bearer header for external API access.
 * Finds the API key by the gbd_ prefix, verifies bcrypt hash,
 * and attaches the orgId to the request.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private db: DbService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const authHeader = request.headers['authorization'];
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing API key. Use the Authorization: Bearer header.');
    }

    const rawKey = authHeader.slice(7);
    if (!rawKey.startsWith('gbd_')) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const prefix = rawKey.slice(0, 12);

    const keyRecord = await this.db.kysely
      .selectFrom('api.api_keys')
      .select(['id', 'key_hash', 'org_id', 'revoked_at'])
      .where('key_prefix', '=', prefix)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();

    if (!keyRecord) {
      throw new UnauthorizedException('Invalid API key');
    }

    const isValid = await bcrypt.compare(rawKey, keyRecord.key_hash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    await this.db.kysely
      .updateTable('api.api_keys')
      .set({ last_used_at: new Date() })
      .where('id', '=', keyRecord.id)
      .execute();

    request.apiKey = {
      orgId: keyRecord.org_id,
      orgNumericId: extractOrgNumericId(keyRecord.org_id),
    };

    return true;
  }
}
