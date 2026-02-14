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

interface JiraIssueFields {
  summary: string;
  description: unknown;
  updated: string;
  comment?: { comments: JiraComment[] };
  status?: { name: string };
  assignee?: { displayName: string } | null;
  issuetype?: { name: string };
}

interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: JiraIssueFields;
}

interface JiraSearchResponse {
  issues?: JiraIssue[];
  total?: number;
  maxResults?: number;
  startAt?: number;
}

interface JiraComment {
  id: string;
  body: unknown;
  author?: { displayName: string };
  created: string;
}

// --- ADF (Atlassian Document Format) helpers ---

interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
}

function isAdfNode(value: unknown): value is AdfNode {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function extractTextFromAdf(node: unknown): string {
  if (!isAdfNode(node)) return '';
  if (node.text) return node.text;
  if (node.content) return node.content.map(extractTextFromAdf).join('\n');
  return '';
}

@Injectable()
export class JiraConnector extends IntegrationConnector {
  readonly provider = IntegrationProvider.JIRA;
  readonly rateLimits: RateLimitConfig = {
    maxRequestsPerMinute: 6000,
    maxRequestsPerHour: 360000,
  };
  readonly supportsWebhooks = false;

  private readonly logger = new Logger(JiraConnector.name);

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
      scope: 'read:jira-work read:jira-user offline_access',
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
    // Webhook registration not implemented; polling is used
    return null;
  }

  async deregisterWebhook(_accessToken: string, _webhookRef: string): Promise<void> {
    // No-op: webhooks not used
  }

  parseWebhook(
    _headers: Record<string, string>,
    _body: unknown,
    _secret: string | null,
  ): WebhookEvent | null {
    // Webhooks not implemented
    return null;
  }

  async sync(
    accessToken: string,
    config: Record<string, unknown>,
    cursor: SyncCursor | null,
  ): Promise<SyncResult> {
    const cloudId = typeof config['cloudId'] === 'string' ? config['cloudId'] : null;
    if (!cloudId) {
      throw new Error('Jira sync requires cloudId in config');
    }

    const updatedAfter =
      cursor !== null && typeof cursor['updatedAfter'] === 'string'
        ? cursor['updatedAfter']
        : null;

    const jqlParts = ['ORDER BY updated ASC'];
    if (updatedAfter) {
      jqlParts.unshift(`updated >= "${updatedAfter}"`);
    }
    const jql = jqlParts.join(' ');

    const siteUrl = typeof config['siteUrl'] === 'string' ? config['siteUrl'] : null;
    const apiBase = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
    const params = new URLSearchParams({
      jql,
      maxResults: '50',
      fields: 'summary,description,comment,status,assignee,issuetype,updated',
    });

    const response = await fetch(`${apiBase}/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Jira search failed: ${response.status} ${response.statusText}`);
    }

    const data: JiraSearchResponse = await response.json();
    const issues = data.issues ?? [];

    const items: SyncedItem[] = issues.map((issue) => {
      const descriptionText = extractTextFromAdf(issue.fields.description);
      const statusName = issue.fields.status?.name ?? 'Unknown';
      const issueTypeName = issue.fields.issuetype?.name ?? 'Unknown';
      const assigneeName = issue.fields.assignee?.displayName ?? null;

      const comments = issue.fields.comment?.comments ?? [];
      const commentText = comments
        .map((c) => {
          const author = c.author?.displayName ?? 'Unknown';
          const body = extractTextFromAdf(c.body);
          return `${author}: ${body}`;
        })
        .join('\n---\n');

      const contentParts = [
        `${issue.key}: ${issue.fields.summary}`,
        '',
        `Status: ${statusName}`,
        `Type: ${issueTypeName}`,
      ];

      if (assigneeName) {
        contentParts.push(`Assignee: ${assigneeName}`);
      }

      if (descriptionText) {
        contentParts.push('', descriptionText);
      }

      if (commentText) {
        contentParts.push('', 'Comments:', commentText);
      }

      // Build browsable URL: prefer site URL, fall back to API-constructed URL
      let sourceUrl: string | null = null;
      if (siteUrl) {
        sourceUrl = `${siteUrl}/browse/${issue.key}`;
      }

      return {
        externalId: issue.id,
        title: `${issue.key}: ${issue.fields.summary}`,
        content: contentParts.join('\n'),
        sourceUrl,
        metadata: {
          key: issue.key,
          status: statusName,
          issueType: issueTypeName,
          assignee: assigneeName,
        },
      };
    });

    // Track the latest updated timestamp from the actual response
    let latestUpdated = updatedAfter ?? '';
    for (const issue of issues) {
      if (issue.fields.updated > latestUpdated) {
        latestUpdated = issue.fields.updated;
      }
    }

    const hasMore = issues.length === 50;

    return {
      items,
      deletedExternalIds: [],
      cursor: { updatedAfter: latestUpdated || null },
      hasMore,
    };
  }
}

// --- Type guards ---

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
