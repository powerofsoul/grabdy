import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { type DbId, packId } from '@grabdy/common';
import { type BotSourceConfig, botSourceConfigSchema } from '@grabdy/contracts';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { extname } from 'path';

import { EncryptionService } from '../../common/encryption/encryption.service';
import { InjectEnv } from '../../config/env.config';
import { DbService } from '../../db/db.module';
import { S3FileStorage } from '../storage/s3-file-storage';

@Injectable()
export class BotService {
  constructor(
    private db: DbService,
    private encryptionService: EncryptionService,
    private storage: S3FileStorage,
    @InjectEnv('jwtSecret') private jwtSecret: string
  ) {}

  async create(
    orgId: DbId<'Org'>,
    userId: DbId<'User'>,
    data: {
      name: string;
      dataSourceConfig: BotSourceConfig;
      systemPrompt?: string | null;
      title?: string | null;
      subtitle?: string | null;
      placeholder?: string | null;
      accentColor?: string | null;
      primaryColor?: string | null;
    }
  ) {
    const row = await this.db.kysely
      .insertInto('sdk.bots')
      .values({
        id: packId('Bot', orgId),
        org_id: orgId,
        name: data.name,
        data_source_config: JSON.stringify(data.dataSourceConfig),
        system_prompt: data.systemPrompt ?? null,
        title: data.title ?? null,
        subtitle: data.subtitle ?? null,
        placeholder: data.placeholder ?? null,
        accent_color: data.accentColor ?? null,
        primary_color: data.primaryColor ?? null,
        created_by_id: userId,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapBot(row);
  }

  async list(orgId: DbId<'Org'>) {
    const rows = await this.db.kysely
      .selectFrom('sdk.bots')
      .selectAll()
      .where('org_id', '=', orgId)
      .orderBy('created_at', 'desc')
      .execute();

    // Use mapBotLight to avoid N+1 presigned URL calls
    return rows.map((r) => this.mapBotLight(r));
  }

  async get(orgId: DbId<'Org'>, botId: DbId<'Bot'>) {
    const row = await this.db.kysely
      .selectFrom('sdk.bots')
      .selectAll()
      .where('id', '=', botId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!row) {
      throw new NotFoundException('Bot not found');
    }

    const keys = await this.listSigningKeys(orgId, botId);

    const mapped = await this.mapBot(row);
    return {
      ...mapped,
      signingKeys: keys,
    };
  }

  async update(
    orgId: DbId<'Org'>,
    botId: DbId<'Bot'>,
    data: {
      name?: string;
      dataSourceConfig?: BotSourceConfig;
      systemPrompt?: string | null;
      title?: string | null;
      subtitle?: string | null;
      placeholder?: string | null;
      accentColor?: string | null;
      primaryColor?: string | null;
    }
  ) {
    const updates: Partial<{
      name: string;
      data_source_config: string;
      system_prompt: string | null;
      title: string | null;
      subtitle: string | null;
      placeholder: string | null;
      accent_color: string | null;
      primary_color: string | null;
      updated_at: Date;
    }> = { updated_at: new Date() };

    if (data.name !== undefined) updates.name = data.name;
    if (data.dataSourceConfig !== undefined)
      updates.data_source_config = JSON.stringify(data.dataSourceConfig);
    if (data.systemPrompt !== undefined) updates.system_prompt = data.systemPrompt;
    if (data.title !== undefined) updates.title = data.title;
    if (data.subtitle !== undefined) updates.subtitle = data.subtitle;
    if (data.placeholder !== undefined) updates.placeholder = data.placeholder;
    if (data.accentColor !== undefined) updates.accent_color = data.accentColor;
    if (data.primaryColor !== undefined) updates.primary_color = data.primaryColor;

    const row = await this.db.kysely
      .updateTable('sdk.bots')
      .set(updates)
      .where('id', '=', botId)
      .where('org_id', '=', orgId)
      .returningAll()
      .executeTakeFirst();

    if (!row) {
      throw new NotFoundException('Bot not found');
    }

    return this.mapBot(row);
  }

  async delete(orgId: DbId<'Org'>, botId: DbId<'Bot'>) {
    const result = await this.db.kysely
      .deleteFrom('sdk.bots')
      .where('id', '=', botId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      throw new NotFoundException('Bot not found');
    }
  }

  // Key management

  async generateSigningKey(
    orgId: DbId<'Org'>,
    botId: DbId<'Bot'>,
    userId: DbId<'User'>,
    name: string
  ) {
    const bot = await this.db.kysely
      .selectFrom('sdk.bots')
      .select('id')
      .where('id', '=', botId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const publicKeyDer = crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'der' });
    const fingerprint = crypto.createHash('sha256').update(publicKeyDer).digest('hex');

    const encryptedPublicKey = await this.encryptionService.encrypt(publicKey);

    const row = await this.db.kysely
      .insertInto('sdk.bot_signing_keys')
      .values({
        id: packId('BotSigningKey', orgId),
        bot_id: botId,
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
      privateKey,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  async listSigningKeys(orgId: DbId<'Org'>, botId: DbId<'Bot'>) {
    const rows = await this.db.kysely
      .selectFrom('sdk.bot_signing_keys')
      .select(['id', 'name', 'key_fingerprint', 'revoked_at', 'created_at'])
      .where('bot_id', '=', botId)
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

  async revokeSigningKey(orgId: DbId<'Org'>, botId: DbId<'Bot'>, keyId: DbId<'BotSigningKey'>) {
    const result = await this.db.kysely
      .updateTable('sdk.bot_signing_keys')
      .set({ revoked_at: new Date() })
      .where('id', '=', keyId)
      .where('bot_id', '=', botId)
      .where('org_id', '=', orgId)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) {
      throw new NotFoundException('Signing key not found or already revoked');
    }
  }

  async generatePreviewJwt(
    orgId: DbId<'Org'>,
    botId: DbId<'Bot'>,
    userId: DbId<'User'>
  ): Promise<string> {
    const bot = await this.db.kysely
      .selectFrom('sdk.bots')
      .select('id')
      .where('id', '=', botId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    return jwt.sign(
      {
        sub: `preview-${userId}`,
        chatId: botId,
        preview: true,
      },
      this.jwtSecret,
      { algorithm: 'HS256', expiresIn: '2m' }
    );
  }

  async uploadImage(
    orgId: DbId<'Org'>,
    botId: DbId<'Bot'>,
    file: Express.Multer.File
  ): Promise<string> {
    const bot = await this.db.kysely
      .selectFrom('sdk.bots')
      .select(['id', 'image_key'])
      .where('id', '=', botId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    const allowedMimes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!allowedMimes.has(file.mimetype)) {
      throw new BadRequestException('Unsupported image type. Allowed: PNG, JPEG, WebP');
    }

    if (bot.image_key) {
      await this.storage.delete(bot.image_key);
    }

    const ext = extname(file.originalname).toLowerCase() || '.png';
    const key = `bot-images/${orgId}/${botId}${ext}`;
    await this.storage.put(key, file.buffer, file.mimetype);

    await this.db.kysely
      .updateTable('sdk.bots')
      .set({ image_key: key, updated_at: new Date() })
      .where('id', '=', botId)
      .where('org_id', '=', orgId)
      .execute();

    return this.storage.getUrl(key);
  }

  async deleteImage(orgId: DbId<'Org'>, botId: DbId<'Bot'>): Promise<void> {
    const bot = await this.db.kysely
      .selectFrom('sdk.bots')
      .select(['id', 'image_key'])
      .where('id', '=', botId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    if (bot.image_key) {
      await this.storage.delete(bot.image_key);
    }

    await this.db.kysely
      .updateTable('sdk.bots')
      .set({ image_key: null, updated_at: new Date() })
      .where('id', '=', botId)
      .where('org_id', '=', orgId)
      .execute();
  }

  async getAppearance(botId: DbId<'Bot'>) {
    const row = await this.db.kysely
      .selectFrom('sdk.bots')
      .select(['title', 'subtitle', 'placeholder', 'image_key', 'accent_color', 'primary_color'])
      .where('id', '=', botId)
      .executeTakeFirst();

    if (!row) return null;

    const imageUrl = await this.resolveImageUrl(row.image_key);
    return {
      title: row.title,
      subtitle: row.subtitle,
      placeholder: row.placeholder,
      logoUrl: imageUrl,
      primaryColor: row.primary_color,
      accentColor: row.accent_color,
    };
  }

  async resolveImageUrl(imageKey: string | null): Promise<string | null> {
    if (!imageKey) return null;
    return this.storage.getUrl(imageKey);
  }

  private mapBotLight(row: {
    id: DbId<'Bot'>;
    name: string;
    data_source_config: unknown;
    system_prompt: string | null;
    title: string | null;
    subtitle: string | null;
    placeholder: string | null;
    image_key: string | null;
    accent_color: string | null;
    primary_color: string | null;
    created_at: Date;
    updated_at: Date;
  }) {
    return {
      id: row.id,
      name: row.name,
      dataSourceConfig: botSourceConfigSchema.parse(row.data_source_config),
      systemPrompt: row.system_prompt,
      title: row.title,
      subtitle: row.subtitle,
      placeholder: row.placeholder,
      imageUrl: null,
      accentColor: row.accent_color,
      primaryColor: row.primary_color,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  private async mapBot(row: {
    id: DbId<'Bot'>;
    name: string;
    data_source_config: unknown;
    system_prompt: string | null;
    title: string | null;
    subtitle: string | null;
    placeholder: string | null;
    image_key: string | null;
    accent_color: string | null;
    primary_color: string | null;
    created_at: Date;
    updated_at: Date;
  }) {
    const imageUrl = await this.resolveImageUrl(row.image_key);
    return {
      id: row.id,
      name: row.name,
      dataSourceConfig: botSourceConfigSchema.parse(row.data_source_config),
      systemPrompt: row.system_prompt,
      title: row.title,
      subtitle: row.subtitle,
      placeholder: row.placeholder,
      imageUrl,
      accentColor: row.accent_color,
      primaryColor: row.primary_color,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
