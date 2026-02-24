import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { dbIdSchema } from '@grabdy/common';
import { sdkChatSourceConfigSchema } from '@grabdy/contracts';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { z } from 'zod';

import { InjectEnv } from '../../config/env.config';
import { DbService } from '../../db/db.module';
import { EncryptionService } from '../encryption/encryption.service';

const jwtPayloadSchema = z.object({
  sub: z.string().min(1),
  chatId: dbIdSchema('SdkChat'),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

const previewPayloadSchema = jwtPayloadSchema.extend({
  preview: z.literal(true),
});

@Injectable()
export class SdkJwtGuard implements CanActivate {
  constructor(
    private db: DbService,
    private encryptionService: EncryptionService,
    @InjectEnv('jwtSecret') private jwtSecret: string
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Extract Bearer token
    const authHeader = request.headers['authorization'];
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing SDK JWT');
    }
    const token = authHeader.slice(7);

    // Decode without verification to check if it's a preview token
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded.payload !== 'object') {
      throw new UnauthorizedException('Invalid JWT');
    }

    // Check if this is a preview token (HS256, signed with app secret)
    const previewResult = previewPayloadSchema.safeParse(decoded.payload);
    if (previewResult.success && decoded.header.alg === 'HS256') {
      return this.verifyPreviewToken(token, previewResult.data, request);
    }

    // Standard RS256 flow
    const payloadResult = jwtPayloadSchema.safeParse(decoded.payload);
    if (!payloadResult.success) {
      throw new UnauthorizedException('Invalid JWT claims');
    }
    const payload = payloadResult.data;

    return this.verifyRsaToken(token, payload, decoded, request);
  }

  private async verifyPreviewToken(
    token: string,
    payload: z.infer<typeof previewPayloadSchema>,
    request: Request
  ): Promise<boolean> {
    try {
      jwt.verify(token, this.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Invalid preview token');
    }

    const sdkChat = await this.db.kysely
      .selectFrom('sdk.sdk_chats')
      .selectAll()
      .where('id', '=', payload.chatId)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!sdkChat) {
      throw new UnauthorizedException('SDK Chat not found or inactive');
    }

    const dataSourceConfig = sdkChatSourceConfigSchema.parse(sdkChat.data_source_config);

    request.sdkAuth = {
      orgId: sdkChat.org_id,
      sdkChatId: sdkChat.id,
      externalUserId: payload.sub,
      dataSourceConfig,
      systemPrompt: sdkChat.system_prompt,
    };

    return true;
  }

  private async verifyRsaToken(
    token: string,
    payload: z.infer<typeof jwtPayloadSchema>,
    decoded: jwt.Jwt,
    request: Request
  ): Promise<boolean> {
    // Look up SDK chat
    const sdkChat = await this.db.kysely
      .selectFrom('sdk.sdk_chats')
      .selectAll()
      .where('id', '=', payload.chatId)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!sdkChat) {
      throw new UnauthorizedException('SDK Chat not found or inactive');
    }

    // Look up non-revoked signing keys
    const kid = decoded.header.kid;
    let keysQuery = this.db.kysely
      .selectFrom('sdk.sdk_signing_keys')
      .selectAll()
      .where('sdk_chat_id', '=', payload.chatId)
      .where('revoked_at', 'is', null);

    if (typeof kid === 'string') {
      keysQuery = keysQuery.where('key_fingerprint', '=', kid);
    }

    const keys = await keysQuery.execute();
    if (keys.length === 0) {
      throw new UnauthorizedException('No valid signing keys found');
    }

    // Try each key until one verifies
    let verified = false;
    for (const key of keys) {
      try {
        const publicKeyPem = await this.encryptionService.decrypt(key.public_key);
        jwt.verify(token, publicKeyPem, { algorithms: ['RS256'] });
        verified = true;
        break;
      } catch {
        // Try next key
      }
    }

    if (!verified) {
      throw new UnauthorizedException('JWT signature verification failed');
    }

    // Parse JSONB columns at trust boundary
    const dataSourceConfig = sdkChatSourceConfigSchema.parse(sdkChat.data_source_config);

    // Attach SDK auth context
    request.sdkAuth = {
      orgId: sdkChat.org_id,
      sdkChatId: sdkChat.id,
      externalUserId: payload.sub,
      dataSourceConfig,
      systemPrompt: sdkChat.system_prompt,
    };

    return true;
  }
}
