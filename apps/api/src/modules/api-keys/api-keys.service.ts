import { Injectable, NotFoundException } from '@nestjs/common';

import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { type DbId, packId } from '@grabdy/common';

import { API_KEY_PREFIX_LENGTH, API_KEY_RANDOM_BYTES, BCRYPT_SALT_ROUNDS } from '../../config/constants';
import { DbService } from '../../db/db.module';

@Injectable()
export class ApiKeysService {
  constructor(private db: DbService) {}

  async create(orgId: DbId<'Org'>, userId: DbId<'User'>, name: string) {
    // Generate API key with gbd_ prefix
    const rawKey = `gbd_${crypto.randomBytes(API_KEY_RANDOM_BYTES).toString('hex')}`;
    const keyPrefix = rawKey.slice(0, API_KEY_PREFIX_LENGTH);
    const keyHash = await bcrypt.hash(rawKey, BCRYPT_SALT_ROUNDS);

    const apiKey = await this.db.kysely
      .insertInto('api.api_keys')
      .values({
        id: packId('ApiKey', orgId),
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        org_id: orgId,
        created_by_id: userId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.key_prefix,
      key: rawKey,
      lastUsedAt: apiKey.last_used_at,
      revokedAt: apiKey.revoked_at,
      createdAt: apiKey.created_at,
    };
  }

  async list(orgId: DbId<'Org'>, includeRevoked: boolean) {
    let query = this.db.kysely
      .selectFrom('api.api_keys')
      .select(['id', 'name', 'key_prefix', 'last_used_at', 'revoked_at', 'created_at'])
      .where('org_id', '=', orgId);

    if (!includeRevoked) {
      query = query.where('revoked_at', 'is', null);
    }

    const keys = await query.orderBy('created_at', 'desc').execute();

    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.key_prefix,
      lastUsedAt: k.last_used_at,
      revokedAt: k.revoked_at,
      createdAt: k.created_at,
    }));
  }

  async revoke(orgId: DbId<'Org'>, keyId: DbId<'ApiKey'>) {
    const result = await this.db.kysely
      .updateTable('api.api_keys')
      .set({ revoked_at: new Date() })
      .where('id', '=', keyId)
      .where('org_id', '=', orgId)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) {
      throw new NotFoundException('API key not found or already revoked');
    }
  }
}
