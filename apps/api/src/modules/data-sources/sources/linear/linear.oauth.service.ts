import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { LinearClient } from '@linear/sdk';
import { createHmac, timingSafeEqual } from 'crypto';

import { InjectEnv } from '../../../../config/env.config';
import type {
  AccountInfo,
  IntegrationOAuth,
  OAuthTokens,
} from '../../../integrations/connector.interface';

import type { LinearProviderData } from './types';

const LINEAR_AUTH_URL = 'https://linear.app/oauth/authorize';
const LINEAR_TOKEN_URL = 'https://api.linear.app/oauth/token';
const LINEAR_SCOPES = 'read';

@Injectable()
export class LinearOAuthService implements IntegrationOAuth<'LINEAR'> {
  private readonly logger = new Logger(LinearOAuthService.name);

  constructor(
    @InjectEnv('linearClientId') private readonly linearClientId: string,
    @InjectEnv('linearClientSecret') private readonly linearClientSecret: string,
    @InjectEnv('linearWebhookSecret') private readonly linearWebhookSecret: string
  ) {}

  getAuthUrl(_orgId: DbId<'Org'>, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.linearClientId,
      redirect_uri: redirectUri,
      scope: LINEAR_SCOPES,
      state,
      response_type: 'code',
      prompt: 'consent',
    });
    return `${LINEAR_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens<'LINEAR'>> {
    const response = await fetch(LINEAR_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.linearClientId,
        client_secret: this.linearClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const data: { access_token?: string; error?: string; scope?: string } = await response.json();

    if (!data.access_token) {
      throw new Error(`Linear OAuth error: ${data.error ?? 'Unknown error'}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: null, // Linear tokens don't expire
      expiresAt: null,
      scopes: data.scope ? data.scope.split(',') : [LINEAR_SCOPES],
    };
  }

  refreshTokens(_refreshToken: string): Promise<OAuthTokens<'LINEAR'>> {
    throw new Error('Linear tokens do not expire and cannot be refreshed');
  }

  async revoke(accessToken: string, _providerData: LinearProviderData): Promise<void> {
    try {
      const response = await fetch('https://api.linear.app/oauth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ access_token: accessToken }),
      });
      if (!response.ok) {
        this.logger.warn(`Linear token revocation returned ${response.status}`);
      }
    } catch (err) {
      this.logger.warn(`Linear token revocation failed: ${err}`);
    }
  }

  async getAccountInfo(accessToken: string): Promise<AccountInfo<'LINEAR'>> {
    const client = new LinearClient({ accessToken });
    const org = await client.organization;

    return {
      id: org.id,
      name: org.name,
      metadata: { workspaceSlug: org.urlKey },
    };
  }

  buildInitialProviderData(
    tokenMetadata?: Partial<LinearProviderData>,
    accountMetadata?: Partial<LinearProviderData>
  ): LinearProviderData {
    return {
      provider: 'LINEAR',
      workspaceSlug: tokenMetadata?.workspaceSlug ?? accountMetadata?.workspaceSlug,
      lastIssueSyncedAt: null,
    };
  }

  verifyWebhookSignature(headers: Record<string, string>, rawBody: string): boolean {
    const signature = headers['linear-signature'];
    if (!signature || !this.linearWebhookSecret) return false;

    const expected = createHmac('sha256', this.linearWebhookSecret).update(rawBody).digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    return sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer);
  }

  verifySignatureWithSecret(
    headers: Record<string, string>,
    secret: string,
    rawBody: string
  ): boolean {
    const signature = headers['linear-signature'];
    if (!signature || !secret) return false;

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    return sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer);
  }
}
