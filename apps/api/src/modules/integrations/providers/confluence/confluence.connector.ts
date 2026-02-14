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

const ATLASSIAN_AUTH_URL = 'https://auth.atlassian.com/authorize';
const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const ATLASSIAN_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';

function confluenceApiBase(cloud: string): string {
  return `https://api.atlassian.com/ex/confluence/${cloud}/wiki/api/v2`;
}

// --- Atlassian API response interfaces ---

interface AtlassianTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface AtlassianResource {
  id: string;
  url: string;
  name: string;
  scopes: string[];
}

interface ConfluencePage {
  id: string;
  title: string;
  status: string;
  spaceKey: string;
  body?: {
    storage?: { value: string };
  };
  _links?: {
    webui?: string;
  };
}

interface ConfluencePagesResponse {
  results?: ConfluencePage[];
  _links?: {
    next?: string;
  };
}

interface ConfluenceSpaceResponse {
  id: string;
  key: string;
  name: string;
}

// --- Helpers ---

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

function isAtlassianResource(value: unknown): value is AtlassianResource {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value satisfies Record<string, unknown>)['id'] === 'string' &&
    'name' in value &&
    typeof (value satisfies Record<string, unknown>)['name'] === 'string' &&
    'url' in value &&
    typeof (value satisfies Record<string, unknown>)['url'] === 'string'
  );
}

@Injectable()
export class ConfluenceConnector extends IntegrationConnector {
  readonly provider = IntegrationProvider.CONFLUENCE;
  readonly rateLimits: RateLimitConfig = {
    maxRequestsPerMinute: 6000,
    maxRequestsPerHour: 360000,
  };
  readonly supportsWebhooks = false;

  private readonly logger = new Logger(ConfluenceConnector.name);

  constructor(
    @InjectEnv('atlassianClientId') private readonly oauthClient: string,
    @InjectEnv('atlassianClientSecret') private readonly clientSecret: string,
  ) {
    super();
  }

  getAuthUrl(_orgId: DbId<'Org'>, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.oauthClient,
      scope: 'read:confluence-content.all read:confluence-space.summary offline_access',
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
    });
    return `${ATLASSIAN_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(ATLASSIAN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.oauthClient,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data: AtlassianTokenResponse = await response.json();

    if (data.error || !data.access_token) {
      throw new Error(
        `Atlassian OAuth error: ${data.error_description ?? data.error ?? 'Unknown error'}`,
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: data.scope ? data.scope.split(' ') : [],
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(ATLASSIAN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: this.oauthClient,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    const data: AtlassianTokenResponse = await response.json();

    if (data.error || !data.access_token) {
      throw new Error(
        `Atlassian token refresh error: ${data.error_description ?? data.error ?? 'Unknown error'}`,
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: data.scope ? data.scope.split(' ') : [],
    };
  }

  async getAccountInfo(accessToken: string): Promise<AccountInfo> {
    const response = await fetch(ATLASSIAN_RESOURCES_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });

    const resources: unknown = await response.json();

    if (!Array.isArray(resources) || resources.length === 0) {
      throw new Error('No accessible Atlassian resources found');
    }

    const first: unknown = resources[0];
    if (!isAtlassianResource(first)) {
      throw new Error('Invalid Atlassian resource format');
    }

    return { id: first.id, name: first.name };
  }

  async registerWebhook(
    _accessToken: string,
    _config: Record<string, unknown>,
  ): Promise<WebhookInfo | null> {
    return null;
  }

  async deregisterWebhook(_accessToken: string, _webhookRef: string): Promise<void> {
    // No-op
  }

  parseWebhook(
    _headers: Record<string, string>,
    _body: unknown,
    _secret: string | null,
  ): WebhookEvent | null {
    return null;
  }

  async sync(
    accessToken: string,
    config: Record<string, unknown>,
    cursor: SyncCursor | null,
  ): Promise<SyncResult> {
    const cloud = typeof config['cloudId'] === 'string' ? config['cloudId'] : null;
    const siteUrl = typeof config['siteUrl'] === 'string' ? config['siteUrl'] : null;

    if (!cloud) {
      throw new Error('Confluence sync requires cloudId in config');
    }

    const paginationCursor =
      cursor !== null && typeof cursor['cursor'] === 'string' ? cursor['cursor'] : null;

    const apiBase = confluenceApiBase(cloud);

    // Build the request URL
    let url: string;
    if (paginationCursor) {
      url = `${apiBase}/pages?cursor=${encodeURIComponent(paginationCursor)}&limit=50&body-format=storage&sort=modified-date`;
    } else {
      url = `${apiBase}/pages?limit=50&body-format=storage&sort=modified-date`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Confluence pages fetch failed: ${response.status} ${response.statusText}`);
    }

    const data: ConfluencePagesResponse = await response.json();
    const pages = data.results ?? [];

    // Build a space cache to resolve space keys for URLs
    const spaceRefs = [...new Set(pages.map((p) => p.spaceKey))];
    const spaceKeyMap = new Map<string, string>();

    for (const spaceRef of spaceRefs) {
      const spaceKey = await this.fetchSpaceKey(accessToken, cloud, spaceRef);
      if (spaceKey) {
        spaceKeyMap.set(spaceRef, spaceKey);
      }
    }

    const items: SyncedItem[] = pages.map((page) => {
      const bodyHtml = page.body?.storage?.value ?? '';
      const bodyText = stripHtmlTags(bodyHtml);
      const spaceKey = spaceKeyMap.get(page.spaceKey) ?? '';

      let sourceUrl: string | null = null;
      if (siteUrl && spaceKey) {
        sourceUrl = `${siteUrl}/wiki/spaces/${spaceKey}/pages/${page.id}`;
      } else if (page._links?.webui) {
        sourceUrl = page._links.webui;
      }

      const contentParts = [page.title];
      if (bodyText) {
        contentParts.push('', bodyText);
      }

      return {
        externalId: page.id,
        title: page.title,
        content: contentParts.join('\n'),
        sourceUrl,
        metadata: {
          spaceRef: page.spaceKey,
          spaceKey,
          status: page.status,
        },
      };
    });

    // Extract next cursor from _links.next if present
    let nextCursor: string | null = null;
    if (data._links?.next) {
      const nextUrl = new URL(data._links.next, confluenceApiBase(cloud));
      nextCursor = nextUrl.searchParams.get('cursor');
    }

    const hasMore = nextCursor !== null;

    return {
      items,
      deletedExternalIds: [],
      cursor: { cursor: nextCursor },
      hasMore,
    };
  }

  private async fetchSpaceKey(accessToken: string, cloud: string, spaceRef: string): Promise<string | null> {
    try {
      const response = await fetch(`${confluenceApiBase(cloud)}/spaces/${spaceRef}`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      });

      if (!response.ok) return null;

      const data: ConfluenceSpaceResponse = await response.json();
      return data.key ?? null;
    } catch {
      return null;
    }
  }
}
