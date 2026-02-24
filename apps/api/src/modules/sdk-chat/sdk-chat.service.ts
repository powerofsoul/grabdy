import { Injectable, NotFoundException } from '@nestjs/common';

import { type DbId, packId } from '@grabdy/common';
import { type SdkChatSourceConfig, sdkChatSourceConfigSchema } from '@grabdy/contracts';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

import { EncryptionService } from '../../common/encryption/encryption.service';
import { InjectEnv } from '../../config/env.config';
import { DbService } from '../../db/db.module';

@Injectable()
export class SdkChatService {
  constructor(
    private db: DbService,
    private encryptionService: EncryptionService,
    @InjectEnv('jwtSecret') private jwtSecret: string
  ) {}

  async create(
    orgId: DbId<'Org'>,
    userId: DbId<'User'>,
    data: {
      name: string;
      dataSourceConfig: SdkChatSourceConfig;
      systemPrompt?: string | null;
    }
  ) {
    const row = await this.db.kysely
      .insertInto('sdk.sdk_chats')
      .values({
        id: packId('SdkChat', orgId),
        org_id: orgId,
        name: data.name,
        data_source_config: JSON.stringify(data.dataSourceConfig),
        system_prompt: data.systemPrompt ?? null,
        created_by_id: userId,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapSdkChat(row);
  }

  async list(orgId: DbId<'Org'>) {
    const rows = await this.db.kysely
      .selectFrom('sdk.sdk_chats')
      .selectAll()
      .where('org_id', '=', orgId)
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((r) => this.mapSdkChat(r));
  }

  async get(orgId: DbId<'Org'>, sdkChatId: DbId<'SdkChat'>) {
    const row = await this.db.kysely
      .selectFrom('sdk.sdk_chats')
      .selectAll()
      .where('id', '=', sdkChatId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!row) {
      throw new NotFoundException('SDK Chat not found');
    }

    const keys = await this.listSigningKeys(orgId, sdkChatId);

    return {
      ...this.mapSdkChat(row),
      signingKeys: keys,
    };
  }

  async update(
    orgId: DbId<'Org'>,
    sdkChatId: DbId<'SdkChat'>,
    data: {
      name?: string;
      dataSourceConfig?: SdkChatSourceConfig;
      systemPrompt?: string | null;
      isActive?: boolean;
    }
  ) {
    const updates: Partial<{
      name: string;
      data_source_config: string;
      system_prompt: string | null;
      is_active: boolean;
      updated_at: Date;
    }> = { updated_at: new Date() };

    if (data.name !== undefined) updates.name = data.name;
    if (data.dataSourceConfig !== undefined)
      updates.data_source_config = JSON.stringify(data.dataSourceConfig);
    if (data.systemPrompt !== undefined) updates.system_prompt = data.systemPrompt;
    if (data.isActive !== undefined) updates.is_active = data.isActive;

    const row = await this.db.kysely
      .updateTable('sdk.sdk_chats')
      .set(updates)
      .where('id', '=', sdkChatId)
      .where('org_id', '=', orgId)
      .returningAll()
      .executeTakeFirst();

    if (!row) {
      throw new NotFoundException('SDK Chat not found');
    }

    return this.mapSdkChat(row);
  }

  async delete(orgId: DbId<'Org'>, sdkChatId: DbId<'SdkChat'>) {
    const result = await this.db.kysely
      .deleteFrom('sdk.sdk_chats')
      .where('id', '=', sdkChatId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      throw new NotFoundException('SDK Chat not found');
    }
  }

  // Key management

  async generateSigningKey(
    orgId: DbId<'Org'>,
    sdkChatId: DbId<'SdkChat'>,
    userId: DbId<'User'>,
    name: string
  ) {
    // Verify SDK Chat exists
    const chat = await this.db.kysely
      .selectFrom('sdk.sdk_chats')
      .select('id')
      .where('id', '=', sdkChatId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!chat) {
      throw new NotFoundException('SDK Chat not found');
    }

    // Generate RSA keypair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Compute SHA-256 fingerprint of the public key DER
    const publicKeyDer = crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'der' });
    const fingerprint = crypto.createHash('sha256').update(publicKeyDer).digest('hex');

    // Encrypt the public key PEM before storage
    const encryptedPublicKey = await this.encryptionService.encrypt(publicKey);

    const row = await this.db.kysely
      .insertInto('sdk.sdk_signing_keys')
      .values({
        id: packId('SdkSigningKey', orgId),
        sdk_chat_id: sdkChatId,
        org_id: orgId,
        name,
        public_key: encryptedPublicKey,
        key_fingerprint: fingerprint,
        created_by_id: userId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: row.id,
      name: row.name,
      fingerprint: row.key_fingerprint,
      privateKey, // shown once, never stored
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  async listSigningKeys(orgId: DbId<'Org'>, sdkChatId: DbId<'SdkChat'>) {
    const rows = await this.db.kysely
      .selectFrom('sdk.sdk_signing_keys')
      .select(['id', 'name', 'key_fingerprint', 'revoked_at', 'created_at'])
      .where('sdk_chat_id', '=', sdkChatId)
      .where('org_id', '=', orgId)
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      fingerprint: r.key_fingerprint,
      revokedAt: r.revoked_at ? new Date(r.revoked_at).toISOString() : null,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }

  async revokeSigningKey(
    orgId: DbId<'Org'>,
    sdkChatId: DbId<'SdkChat'>,
    keyId: DbId<'SdkSigningKey'>
  ) {
    const result = await this.db.kysely
      .updateTable('sdk.sdk_signing_keys')
      .set({ revoked_at: new Date() })
      .where('id', '=', keyId)
      .where('sdk_chat_id', '=', sdkChatId)
      .where('org_id', '=', orgId)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) {
      throw new NotFoundException('Signing key not found or already revoked');
    }
  }

  async generatePreviewJwt(
    orgId: DbId<'Org'>,
    sdkChatId: DbId<'SdkChat'>,
    userId: DbId<'User'>
  ): Promise<string> {
    // Verify chat exists
    const chat = await this.db.kysely
      .selectFrom('sdk.sdk_chats')
      .select('id')
      .where('id', '=', sdkChatId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!chat) {
      throw new NotFoundException('SDK Chat not found');
    }

    // Sign a lightweight preview token with app secret (no RSA key generation)
    return jwt.sign(
      {
        sub: `preview-${userId}`,
        chatId: sdkChatId,
        preview: true,
      },
      this.jwtSecret,
      { algorithm: 'HS256', expiresIn: '2m' }
    );
  }

  private mapSdkChat(row: {
    id: DbId<'SdkChat'>;
    name: string;
    data_source_config: unknown;
    system_prompt: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }) {
    return {
      id: row.id,
      name: row.name,
      dataSourceConfig: sdkChatSourceConfigSchema.parse(row.data_source_config),
      systemPrompt: row.system_prompt,
      isActive: row.is_active,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
