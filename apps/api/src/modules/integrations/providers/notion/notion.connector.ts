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
import { blockToText, extractRichText } from './notion.utils';

// ---------------------------------------------------------------------------
// Webhook payload schemas (trust boundary)
// ---------------------------------------------------------------------------

const notionWebhookEntitySchema = z.object({
  id: z.string(),
  type: z.enum(['page', 'database']),
});

const notionWebhookPayloadSchema = z.object({
  type: z.string(),
  entity: notionWebhookEntitySchema.optional(),
});

// ---------------------------------------------------------------------------
// Page parsing schemas (trust boundary — Notion SDK returns loosely typed objects)
// ---------------------------------------------------------------------------

const notionTokenResponseSchema = z.object({
  access_token: z.string(),
  workspace_id: z.string(),
  workspace_name: z.string(),
});

const notionPageSchema = z.object({ object: z.string(), id: z.string() }).passthrough();

const notionDbTitleSchema = z.object({
  title: z.array(z.object({ plain_text: z.string() })),
});

const notionPropertiesSchema = z.object({ properties: z.unknown() });

const notionTitlePropertySchema = z.object({
  type: z.literal('title'),
  title: z.array(z.object({ plain_text: z.string() })),
});

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

@Injectable()
export class NotionConnector extends IntegrationConnector<'NOTION'> {
  readonly provider = IntegrationProvider.NOTION;
  readonly rateLimits: RateLimitConfig = { maxRequestsPerMinute: 180, maxRequestsPerHour: 10000 };
  readonly syncSchedule = null; // Webhook-driven

  private readonly logger = new Logger(NotionConnector.name);

  constructor(
    @InjectEnv('notionClientId') private readonly notionClientId: string,
    @InjectEnv('notionClientSecret') private readonly notionClientSecret: string,
    @InjectEnv('notionWebhookSecret') private readonly notionWebhookSecret: string
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

    const signature = headers['x-notion-signature'];
    if (!signature || !secret) return null;

    const bodyString = rawBody ?? JSON.stringify(body);
    const expected = `sha256=${createHmac('sha256', secret).update(bodyString).digest('hex')}`;

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      this.logger.warn('Notion webhook signature verification failed');
      return null;
    }

    const parsed = notionWebhookPayloadSchema.safeParse(body);
    if (!parsed.success) return null;

    const payload = parsed.data;
    const entityId = payload.entity?.id;
    if (!entityId) return null;

    // Map Notion event types to our webhook actions
    const eventType = payload.type;
    if (
      eventType === 'page.content_updated' ||
      eventType === 'page.created' ||
      eventType === 'page.properties_updated' ||
      eventType === 'page.moved' ||
      eventType === 'page.locked' ||
      eventType === 'page.unlocked' ||
      eventType === 'data_source.schema_updated' ||
      eventType === 'database.schema_updated'
    ) {
      return { action: 'updated', externalId: entityId };
    }

    if (eventType === 'page.deleted' || eventType === 'page.undeleted') {
      return { action: eventType === 'page.deleted' ? 'deleted' : 'updated', externalId: entityId };
    }

    // Comment events — trigger re-sync of the parent page
    if (eventType === 'comment.created' || eventType === 'comment.updated') {
      return { action: 'updated', externalId: entityId };
    }

    return null;
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

    const webhookEvents: WebhookEvent[] = [];
    let maxEditedTime = providerData.lastSyncedAt;
    let startCursor: string | undefined;
    let keepPaging = true;

    do {
      const searchParams: {
        sort: { timestamp: 'last_edited_time'; direction: 'descending' };
        start_cursor?: string;
        page_size: number;
      } = {
        sort: { timestamp: 'last_edited_time', direction: 'descending' },
        page_size: 100,
      };
      if (startCursor) {
        searchParams.start_cursor = startCursor;
      }

      const searchResponse = await client.search(searchParams);

      for (const result of searchResponse.results) {
        if (!('last_edited_time' in result)) continue;

        const editedTime = result.last_edited_time;

        if (editedTime <= since) {
          keepPaging = false;
          break;
        }

        if (!maxEditedTime || editedTime > maxEditedTime) {
          maxEditedTime = editedTime;
        }

        // Queue each page as an individual webhook job — content is fetched per-page
        webhookEvents.push({ action: 'updated', externalId: result.id });
      }

      if (!keepPaging) break;

      if (searchResponse.has_more && searchResponse.next_cursor) {
        startCursor = searchResponse.next_cursor;
      } else {
        keepPaging = false;
      }
    } while (keepPaging);

    this.logger.log(`Notion sync discovered ${webhookEvents.length} pages to process`);

    return {
      items: [],
      deletedExternalIds: [],
      updatedProviderData: { ...providerData, lastSyncedAt: maxEditedTime },
      hasMore: false,
      webhookEvents,
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

    try {
      const page = await client.pages.retrieve({ page_id: event.externalId });
      const item = await this.fetchPageAsSyncedItem(client, event.externalId, page);
      return { item, deletedExternalId: null };
    } catch (err) {
      this.logger.warn(`Could not fetch Notion page ${event.externalId} for webhook sync: ${err}`);
      return { item: null, deletedExternalId: null };
    }
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

  // ---- Private: page fetching ---------------------------------------------

  private async fetchPageAsSyncedItem(
    client: Client,
    notionPageId: string,
    pageObj: unknown
  ): Promise<SyncedItem | null> {
    const parsed = notionPageSchema.safeParse(pageObj);
    if (!parsed.success) return null;

    const isDataSource = parsed.data.object === 'data_source';

    // Extract title
    let title = 'Untitled';
    if (isDataSource) {
      const dbParsed = notionDbTitleSchema.safeParse(pageObj);
      if (dbParsed.success && dbParsed.data.title.length > 0) {
        title = extractRichText(dbParsed.data.title);
      }
    } else {
      const propsParsed = notionPropertiesSchema.safeParse(pageObj);
      if (propsParsed.success) {
        title = this.extractPageTitle(propsParsed.data.properties);
      }
    }

    // Build page URL
    const urlId = notionPageId.replace(/-/g, '');
    const sourceUrl = `https://www.notion.so/${urlId}`;

    // Fetch block content
    let content: string;
    try {
      content = await this.fetchBlockContent(client, notionPageId);
    } catch (err) {
      this.logger.warn(`Failed to fetch blocks for page ${notionPageId}: ${err}`);
      content = '';
    }

    const fullContent = title + '\n\n' + content;

    return {
      externalId: notionPageId,
      title,
      content: fullContent,
      messages: [
        {
          content: fullContent,
          metadata: { type: 'NOTION', notionPageId, notionBlockId: null },
          sourceUrl,
        },
      ],
      sourceUrl,
      metadata: {
        notionPageId,
        isDataSource,
      },
    };
  }

  private async fetchBlockContent(
    client: Client,
    notionBlockId: string,
    depth = 0
  ): Promise<string> {
    if (depth > 3) return '';

    const lines: string[] = [];
    let cursor: string | undefined;

    do {
      const response = await client.blocks.children.list({
        block_id: notionBlockId,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const block of response.results) {
        const text = blockToText(block);
        if (text) {
          lines.push(text);
        }

        if ('has_children' in block && block.has_children) {
          const childContent = await this.fetchBlockContent(client, block.id, depth + 1);
          if (childContent) {
            lines.push(childContent);
          }
        }
      }

      cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
    } while (cursor);

    return lines.join('\n');
  }

  private extractPageTitle(properties: unknown): string {
    if (typeof properties !== 'object' || properties === null) return 'Untitled';

    for (const value of Object.values(properties)) {
      const parsed = notionTitlePropertySchema.safeParse(value);
      if (parsed.success && parsed.data.title.length > 0) {
        return extractRichText(parsed.data.title);
      }
    }
    return 'Untitled';
  }
}
