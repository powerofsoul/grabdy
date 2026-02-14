import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';

import { InjectEnv } from '../../../../config/env.config';
import { IntegrationProvider } from '../../../../db/enums';
import {
  type AccountInfo,
  IntegrationConnector,
  type OAuthTokens,
  type RateLimitConfig,
  type SyncCursor,
  type SyncedItem,
  type SyncResult,
  type WebhookEvent,
  type WebhookInfo,
} from '../../connector.interface';

const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';
const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// ─── Rate limit: Notion allows 3 req/s ─────────────────────────────────

const THROTTLE_DELAY_MS = 350; // ~3 req/s with safety margin

// ─── API response interfaces ───────────────────────────────────────────

interface NotionTokenResponse {
  access_token?: string;
  workspace_id?: string;
  workspace_name?: string;
  workspace_icon?: string;
  bot_id?: string;
  token_type?: string;
  error?: string;
  error_message?: string;
}

interface NotionUsersMeResponse {
  id: string;
  type: string;
  bot?: {
    owner: {
      type: string;
      workspace?: boolean;
    };
    workspace_name?: string;
  };
  name?: string;
}

interface NotionRichText {
  type: string;
  plain_text: string;
}

interface NotionPageProperty {
  type: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
}

interface NotionPage {
  id: string;
  object: string;
  url: string;
  last_edited_time: string;
  properties: Record<string, NotionPageProperty>;
}

interface NotionSearchResponse {
  object: string;
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  paragraph?: { rich_text: NotionRichText[] };
  heading_1?: { rich_text: NotionRichText[] };
  heading_2?: { rich_text: NotionRichText[] };
  heading_3?: { rich_text: NotionRichText[] };
  bulleted_list_item?: { rich_text: NotionRichText[] };
  numbered_list_item?: { rich_text: NotionRichText[] };
  to_do?: { rich_text: NotionRichText[]; checked: boolean };
  toggle?: { rich_text: NotionRichText[] };
  code?: { rich_text: NotionRichText[]; language: string };
  quote?: { rich_text: NotionRichText[] };
  callout?: { rich_text: NotionRichText[] };
  divider?: Record<string, never>;
  table_of_contents?: Record<string, never>;
  child_page?: { title: string };
  child_database?: { title: string };
}

interface NotionBlocksResponse {
  object: string;
  results: NotionBlock[];
  has_more: boolean;
  next_cursor: string | null;
}

// ─── Cursor shape ──────────────────────────────────────────────────────

interface NotionSyncCursor extends SyncCursor {
  lastEditedTime: string;
  startCursor: string | null;
}

// ─── Connector ─────────────────────────────────────────────────────────

@Injectable()
export class NotionConnector extends IntegrationConnector {
  readonly provider = IntegrationProvider.NOTION;
  readonly rateLimits: RateLimitConfig = {
    maxRequestsPerMinute: 180, // 3 req/s
    maxRequestsPerHour: 10800,
  };
  readonly supportsWebhooks = false;

  private readonly logger = new Logger(NotionConnector.name);

  constructor(
    @InjectEnv('notionClientId') private readonly oauthClient: string,
    @InjectEnv('notionClientSecret') private readonly clientSecret: string,
  ) {
    super();
  }

  // ── OAuth ──────────────────────────────────────────────────────────

  getAuthUrl(_orgId: DbId<'Org'>, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.oauthClient,
      redirect_uri: redirectUri,
      response_type: 'code',
      owner: 'user',
      state,
    });
    return `${NOTION_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const credentials = Buffer.from(`${this.oauthClient}:${this.clientSecret}`).toString('base64');

    const response = await fetch(NOTION_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data: NotionTokenResponse = await response.json();

    if (data.error || !data.access_token) {
      throw new Error(
        `Notion OAuth error: ${data.error_message ?? data.error ?? 'Unknown error'}`,
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: null, // Notion tokens don't expire and have no refresh token
      expiresAt: null,
      scopes: [], // Notion doesn't use granular scopes in the same way
    };
  }

  async refreshTokens(_refreshToken: string): Promise<OAuthTokens> {
    // Notion tokens don't expire
    throw new Error('Notion tokens do not expire and cannot be refreshed');
  }

  // ── Account info ───────────────────────────────────────────────────

  async getAccountInfo(accessToken: string): Promise<AccountInfo> {
    const response = await fetch(`${NOTION_API_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Notion-Version': NOTION_VERSION,
      },
    });

    if (!response.ok) {
      throw new Error(`Notion API error: ${response.status} ${response.statusText}`);
    }

    const data: NotionUsersMeResponse = await response.json();

    const workspaceName = data.bot?.workspace_name ?? data.name ?? 'Notion Workspace';

    return {
      id: data.id,
      name: workspaceName,
    };
  }

  // ── Webhooks (not supported) ───────────────────────────────────────

  async registerWebhook(
    _accessToken: string,
    _config: Record<string, unknown>,
  ): Promise<WebhookInfo | null> {
    return null;
  }

  async deregisterWebhook(_accessToken: string, _webhookRef: string): Promise<void> {
    // No-op: Notion doesn't support webhooks in this implementation
  }

  parseWebhook(
    _headers: Record<string, string>,
    _body: unknown,
    _secret: string | null,
  ): WebhookEvent | null {
    return null;
  }

  // ── Sync ───────────────────────────────────────────────────────────

  async sync(
    accessToken: string,
    _config: Record<string, unknown>,
    cursor: SyncCursor | null,
  ): Promise<SyncResult> {
    const syncCursor = this.parseSyncCursor(cursor);
    const items: SyncedItem[] = [];
    let latestEditedTime = syncCursor.lastEditedTime;

    // Search for all pages
    const searchBody: Record<string, unknown> = {
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time',
      },
      page_size: 100,
      filter: {
        property: 'object',
        value: 'page',
      },
    };

    if (syncCursor.startCursor) {
      searchBody['start_cursor'] = syncCursor.startCursor;
    }

    const searchResponse = await fetch(`${NOTION_API_URL}/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify(searchBody),
    });

    if (!searchResponse.ok) {
      throw new Error(`Notion search failed: ${searchResponse.status} ${searchResponse.statusText}`);
    }

    const searchData: NotionSearchResponse = await searchResponse.json();

    for (const page of searchData.results) {
      // Skip pages older than our cursor when doing incremental sync
      if (syncCursor.lastEditedTime && page.last_edited_time <= syncCursor.lastEditedTime) {
        continue;
      }

      await this.throttle();

      const title = this.extractPageTitle(page);
      const blocks = await this.fetchAllBlocks(accessToken, page.id);
      const blockText = this.extractTextFromBlocks(blocks);

      const contentParts = [title];
      if (blockText) {
        contentParts.push('', blockText);
      }

      items.push({
        externalId: page.id,
        title,
        content: contentParts.join('\n'),
        sourceUrl: page.url,
        metadata: {
          lastEditedTime: page.last_edited_time,
        },
      });

      if (page.last_edited_time > latestEditedTime) {
        latestEditedTime = page.last_edited_time;
      }
    }

    const nextCursor: NotionSyncCursor = {
      lastEditedTime: latestEditedTime || new Date().toISOString(),
      startCursor: searchData.has_more ? searchData.next_cursor : null,
    };

    return {
      items,
      deletedExternalIds: [],
      cursor: nextCursor,
      hasMore: searchData.has_more,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────

  private async fetchAllBlocks(
    accessToken: string,
    blockRef: string,
    depth = 0,
  ): Promise<NotionBlock[]> {
    if (depth > 3) return []; // Limit recursion depth

    const allBlocks: NotionBlock[] = [];
    let nextCursor: string | null = null;
    let hasMore = true;

    while (hasMore) {
      await this.throttle();

      const params = new URLSearchParams({ page_size: '100' });
      if (nextCursor) {
        params.set('start_cursor', nextCursor);
      }

      const response = await fetch(
        `${NOTION_API_URL}/blocks/${blockRef}/children?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Notion-Version': NOTION_VERSION,
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(`Failed to fetch blocks for ${blockRef}: ${response.status}`);
        break;
      }

      const data: NotionBlocksResponse = await response.json();
      allBlocks.push(...data.results);

      // Recursively fetch children
      for (const block of data.results) {
        if (block.has_children) {
          const children = await this.fetchAllBlocks(accessToken, block.id, depth + 1);
          allBlocks.push(...children);
        }
      }

      hasMore = data.has_more;
      nextCursor = data.next_cursor;
    }

    return allBlocks;
  }

  private extractPageTitle(page: NotionPage): string {
    // Look through properties for a title-type property
    for (const prop of Object.values(page.properties)) {
      if (prop.type === 'title' && prop.title) {
        return prop.title.map((t) => t.plain_text).join('');
      }
    }
    return 'Untitled';
  }

  private extractTextFromBlocks(blocks: NotionBlock[]): string {
    const lines: string[] = [];

    for (const block of blocks) {
      const text = this.extractBlockText(block);
      if (text !== null) {
        lines.push(text);
      }
    }

    return lines.join('\n');
  }

  private extractBlockText(block: NotionBlock): string | null {
    const richTextContent = this.getRichTextForBlock(block);
    if (richTextContent !== null) {
      return richTextContent;
    }

    if (block.type === 'child_page' && block.child_page) {
      return `[Page: ${block.child_page.title}]`;
    }

    if (block.type === 'child_database' && block.child_database) {
      return `[Database: ${block.child_database.title}]`;
    }

    if (block.type === 'divider') {
      return '---';
    }

    return null;
  }

  private getRichTextForBlock(block: NotionBlock): string | null {
    const richTextMap: Record<string, NotionRichText[] | undefined> = {
      paragraph: block.paragraph?.rich_text,
      heading_1: block.heading_1?.rich_text,
      heading_2: block.heading_2?.rich_text,
      heading_3: block.heading_3?.rich_text,
      bulleted_list_item: block.bulleted_list_item?.rich_text,
      numbered_list_item: block.numbered_list_item?.rich_text,
      to_do: block.to_do?.rich_text,
      toggle: block.toggle?.rich_text,
      code: block.code?.rich_text,
      quote: block.quote?.rich_text,
      callout: block.callout?.rich_text,
    };

    const richText = richTextMap[block.type];
    if (!richText) return null;

    const text = richText.map((t) => t.plain_text).join('');

    // Add prefix based on block type
    if (block.type === 'heading_1') return `# ${text}`;
    if (block.type === 'heading_2') return `## ${text}`;
    if (block.type === 'heading_3') return `### ${text}`;
    if (block.type === 'bulleted_list_item') return `- ${text}`;
    if (block.type === 'numbered_list_item') return `1. ${text}`;
    if (block.type === 'to_do') {
      const checked = block.to_do?.checked ? 'x' : ' ';
      return `[${checked}] ${text}`;
    }
    if (block.type === 'code') {
      const lang = block.code?.language ?? '';
      return `\`\`\`${lang}\n${text}\n\`\`\``;
    }
    if (block.type === 'quote') return `> ${text}`;

    return text;
  }

  private parseSyncCursor(cursor: SyncCursor | null): NotionSyncCursor {
    if (!cursor || typeof cursor !== 'object') {
      return { lastEditedTime: '', startCursor: null };
    }

    const lastEditedTime = cursor['lastEditedTime'];
    const startCursor = cursor['startCursor'];

    return {
      lastEditedTime: typeof lastEditedTime === 'string' ? lastEditedTime : '',
      startCursor: typeof startCursor === 'string' ? startCursor : null,
    };
  }

  private throttle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, THROTTLE_DELAY_MS));
  }
}
