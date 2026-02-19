import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { IntegrationProvider } from '@grabdy/contracts';
import { Client } from '@notionhq/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';

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

import type { NotionProviderData } from './notion.types';
import { NotionPageWebhook } from './webhooks/page.webhook';

// ---------------------------------------------------------------------------
// OAuth token response schema (trust boundary)
// ---------------------------------------------------------------------------

const notionTokenResponseSchema = z.object({
  access_token: z.string(),
  workspace_id: z.string(),
  workspace_name: z.string(),
});

@Injectable()
export class NotionConnector extends IntegrationConnector<'NOTION'> {
  readonly provider = IntegrationProvider.NOTION;
  readonly rateLimits: RateLimitConfig = { maxRequestsPerMinute: 180, maxRequestsPerHour: 10000 };
  readonly syncSchedule = null; // Webhook-driven

  private readonly logger = new Logger(NotionConnector.name);

  constructor(
    @InjectEnv('notionClientId') private readonly notionClientId: string,
    @InjectEnv('notionClientSecret') private readonly notionClientSecret: string,
    @InjectEnv('notionWebhookSecret') private readonly notionWebhookSecret: string,
    private readonly pageWebhook: NotionPageWebhook
  ) {
    super();
  }

  // ---- Auth ----------------------------------------------------------------

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

  async getAccountInfo(accessToken: string): Promise<AccountInfo<'NOTION'>> {
    const client = new Client({ auth: accessToken });
    const me = await client.users.me({});

    const botName = 'name' in me ? (me.name ?? 'Notion Workspace') : 'Notion Workspace';

    return {
      id: me.id,
      name: botName,
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

    if (!this.verifySignature(headers, secret, rawBody ?? JSON.stringify(body))) return null;

    return this.pageWebhook.extractEvent(body);
  }

  handleWebhookRequest(
    headers: Record<string, string>,
    body: unknown,
    connections: ReadonlyArray<{
      id: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      providerData: NotionProviderData;
    }>,
    rawBody?: string
  ): WebhookHandlerResult {
    // Verification token is handled in the controller (before connections check)
    const event = this.parseWebhook(headers, body, this.notionWebhookSecret, rawBody);
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

  async sync(accessToken: string, providerData: NotionProviderData): Promise<SyncResult> {
    const client = new Client({ auth: accessToken });
    const since = providerData.lastSyncedAt ?? getInitialSyncSince();

    const result = await this.pageWebhook.fetchUpdatedItems(client, since);
    const maxEditedTime = result.maxEditedTime ?? providerData.lastSyncedAt;

    this.logger.log(`Notion sync discovered ${result.webhookEvents.length} pages to process`);

    return {
      items: [],
      deletedExternalIds: [],
      updatedProviderData: { ...providerData, lastSyncedAt: maxEditedTime },
      hasMore: false,
      webhookEvents: result.webhookEvents,
    };
  }

  async processWebhookItem(
    accessToken: string,
    _providerData: NotionProviderData,
    event: WebhookEvent
  ): Promise<{ item: SyncedItem | null; deletedExternalId: string | null }> {
    if (event.action === 'deleted') {
      return { item: null, deletedExternalId: event.externalId };
    }

    const client = new Client({ auth: accessToken });
    const item = await this.pageWebhook.fetchItem(client, event.externalId);
    if (!item) {
      this.logger.warn(`Could not fetch Notion page ${event.externalId} for webhook sync`);
    }
    return { item: item ?? null, deletedExternalId: null };
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

  // ---- Private: signature verification ------------------------------------

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
