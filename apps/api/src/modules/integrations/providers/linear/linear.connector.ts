import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { IntegrationProvider } from '@grabdy/contracts';
import { LinearClient } from '@linear/sdk';
import { createHmac, timingSafeEqual } from 'crypto';

import { InjectEnv } from '../../../../config/env.config';
import {
  type AccountInfo,
  IntegrationConnector,
  type OAuthTokens,
  type RateLimitConfig,
  type SyncedItem,
  type SyncResult,
  type WebhookEvent,
  type WebhookHandlerResult,
} from '../../connector.interface';
import { getInitialSyncSince } from '../../integrations.constants';

import type { LinearProviderData } from './linear.types';
import { LinearIssueWebhook } from './webhooks/issue.webhook';

const LINEAR_AUTH_URL = 'https://linear.app/oauth/authorize';
const LINEAR_TOKEN_URL = 'https://api.linear.app/oauth/token';
const LINEAR_SCOPES = 'read';

@Injectable()
export class LinearConnector extends IntegrationConnector<'LINEAR'> {
  readonly provider = IntegrationProvider.LINEAR;
  readonly rateLimits: RateLimitConfig = {
    maxRequestsPerMinute: 25,
    maxRequestsPerHour: 1500,
  };
  readonly syncSchedule = null; // Webhook-driven only

  private readonly logger = new Logger(LinearConnector.name);

  constructor(
    @InjectEnv('linearClientId') private readonly linearClientId: string,
    @InjectEnv('linearClientSecret') private readonly linearClientSecret: string,
    @InjectEnv('linearWebhookSecret') private readonly linearWebhookSecret: string,
    private readonly issueWebhook: LinearIssueWebhook
  ) {
    super();
  }

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

  async refreshTokens(_refreshToken: string): Promise<OAuthTokens<'LINEAR'>> {
    throw new Error('Linear tokens do not expire and cannot be refreshed');
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

  // ---- Webhooks ------------------------------------------------------------

  parseWebhook(
    headers: Record<string, string>,
    body: unknown,
    secret: string | null,
    rawBody?: string
  ): WebhookEvent | null {
    if (!body || typeof body !== 'object') return null;

    // Verify Linear webhook signature
    const signature = headers['linear-signature'];
    if (!signature || !secret) return null;

    const bodyString = rawBody ?? JSON.stringify(body);
    const expected = createHmac('sha256', secret).update(bodyString).digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      this.logger.warn('Linear webhook signature verification failed');
      return null;
    }

    return this.issueWebhook.extractEvent(body);
  }

  handleWebhookRequest(
    headers: Record<string, string>,
    body: unknown,
    connections: ReadonlyArray<{
      id: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      providerData: LinearProviderData;
    }>,
    rawBody?: string
  ): WebhookHandlerResult {
    // App-level webhook — verify once with the shared secret, then dispatch to all connections
    const event = this.parseWebhook(headers, body, this.linearWebhookSecret, rawBody);
    if (!event) {
      return { response: { ok: true } };
    }

    const syncConnections = connections.map((conn) => ({
      id: conn.id,
      orgId: conn.orgId,
      event,
    }));

    return { response: { ok: true }, syncConnections };
  }

  // ---- Sync ----------------------------------------------------------------

  async sync(accessToken: string, providerData: LinearProviderData): Promise<SyncResult> {
    const client = new LinearClient({ accessToken });
    const sinceCursor = providerData.lastIssueSyncedAt ?? getInitialSyncSince();

    const result = await this.issueWebhook.fetchUpdatedItems(client, sinceCursor);

    return {
      items: result.items,
      deletedExternalIds: [],
      updatedProviderData: {
        ...providerData,
        lastIssueSyncedAt: result.maxUpdatedAt ?? providerData.lastIssueSyncedAt,
      },
      hasMore: result.hasMore,
    };
  }

  async processWebhookItem(
    accessToken: string,
    _providerData: LinearProviderData,
    event: WebhookEvent
  ): Promise<{ item: SyncedItem | null; deletedExternalId: string | null }> {
    if (event.action === 'deleted') {
      return { item: null, deletedExternalId: event.externalId };
    }

    const client = new LinearClient({ accessToken });
    const item = await this.issueWebhook.fetchItem(client, event.externalId);
    if (!item) {
      this.logger.warn(`Could not fetch Linear issue ${event.externalId} for webhook sync`);
      return { item: null, deletedExternalId: null };
    }

    return { item, deletedExternalId: null };
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
}
