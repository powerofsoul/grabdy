import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { Client } from '@notionhq/client';
import { createHmac, timingSafeEqual } from 'crypto';

import { InjectEnv } from '../../../../config/env.config';
import type {
  AccountInfo,
  IntegrationOAuth,
  OAuthTokens,
} from '../../../integrations/connector.interface';

import { type NotionProviderData, notionTokenResponseSchema } from './types';

@Injectable()
export class NotionOAuthService implements IntegrationOAuth<'NOTION'> {
  private readonly logger = new Logger(NotionOAuthService.name);

  constructor(
    @InjectEnv('notionClientId') private readonly notionClientId: string,
    @InjectEnv('notionClientSecret') private readonly notionClientSecret: string,
    @InjectEnv('notionWebhookSecret') private readonly notionWebhookSecret: string
  ) {}

  getAuthUrl(_orgId: DbId<'Org'>, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.notionClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      owner: 'user',
      state,
    });
    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens<'NOTION'>> {
    const basicAuth = Buffer.from(`${this.notionClientId}:${this.notionClientSecret}`).toString(
      'base64'
    );

    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Notion token exchange failed: ${response.status} ${text}`);
    }

    const data = notionTokenResponseSchema.parse(await response.json());

    return {
      accessToken: data.access_token,
      refreshToken: null, // Notion tokens don't expire
      expiresAt: null,
      scopes: [],
      metadata: {
        notionWorkspaceId: data.workspace_id,
        workspaceName: data.workspace_name,
      },
    };
  }

  refreshTokens(_refreshToken: string): Promise<OAuthTokens<'NOTION'>> {
    throw new Error('Notion tokens do not expire and cannot be refreshed');
  }

  async revoke(_accessToken: string, _providerData: NotionProviderData): Promise<void> {
    // Notion has no token revocation API. Users must remove the integration from Notion settings.
  }

  async getAccountInfo(accessToken: string): Promise<AccountInfo<'NOTION'>> {
    const client = new Client({ auth: accessToken });
    const me = await client.users.me({});

    const botName = 'name' in me ? (me.name ?? 'Notion Workspace') : 'Notion Workspace';

    return {
      id: me.id,
      name: botName,
    };
  }

  buildInitialProviderData(
    tokenMetadata?: Partial<NotionProviderData>,
    accountMetadata?: Partial<NotionProviderData>
  ): NotionProviderData {
    return {
      provider: 'NOTION',
      workspaceName: tokenMetadata?.workspaceName ?? accountMetadata?.workspaceName,
      notionWorkspaceId: tokenMetadata?.notionWorkspaceId ?? accountMetadata?.notionWorkspaceId,
      lastSyncedAt: null,
    };
  }

  verifyWebhookSignature(headers: Record<string, string>, rawBody: string): boolean {
    return this.verifySignature(headers, this.notionWebhookSecret, rawBody);
  }

  verifySignatureWithSecret(
    headers: Record<string, string>,
    secret: string,
    rawBody: string
  ): boolean {
    return this.verifySignature(headers, secret, rawBody);
  }

  private verifySignature(
    headers: Record<string, string>,
    secret: string | null,
    bodyString: string
  ): boolean {
    const signature = headers['x-notion-signature'];
    if (!signature || !secret) return false;

    const expected = `sha256=${createHmac('sha256', secret).update(bodyString).digest('hex')}`;

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    return sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer);
  }
}
