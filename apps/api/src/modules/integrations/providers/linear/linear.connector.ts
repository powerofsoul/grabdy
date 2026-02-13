import { Injectable, Logger } from '@nestjs/common';

import { InjectEnv } from '../../../../config/env.config';
import { IntegrationProvider } from '../../../../db/enums';
import {
  IntegrationConnector,
  type AccountInfo,
  type OAuthTokens,
  type RateLimitConfig,
  type SyncCursor,
  type SyncedItem,
  type SyncResult,
  type WebhookEvent,
  type WebhookInfo,
} from '../../connector.interface';

const LINEAR_AUTH_URL = 'https://linear.app/oauth/authorize';
const LINEAR_TOKEN_URL = 'https://api.linear.app/oauth/token';
const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';

interface LinearIssueNode {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  updatedAt: string;
  state: { name: string };
  priority: number;
  assignee: { name: string } | null;
  comments: {
    nodes: Array<{ body: string; user: { name: string } | null; createdAt: string }>;
  };
}

interface LinearIssuesResponse {
  data?: {
    issues: {
      nodes: LinearIssueNode[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

interface LinearTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface LinearViewerResponse {
  data?: {
    viewer: {
      organization: {
        id: string;
        name: string;
      };
    };
  };
}

@Injectable()
export class LinearConnector extends IntegrationConnector {
  readonly provider = IntegrationProvider.LINEAR;
  readonly rateLimits: RateLimitConfig = {
    maxRequestsPerMinute: 500,
    maxRequestsPerHour: 500,
  };
  readonly supportsWebhooks = true;

  private readonly logger = new Logger(LinearConnector.name);

  constructor(
    @InjectEnv('linearClientId') private readonly clientId: string,
    @InjectEnv('linearClientSecret') private readonly clientSecret: string,
  ) {
    super();
  }

  getAuthUrl(_orgId: string, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read',
      state,
      prompt: 'consent',
    });
    return `${LINEAR_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(LINEAR_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    const data: LinearTokenResponse = await response.json();

    if (data.error || !data.access_token) {
      throw new Error(`Linear OAuth error: ${data.error_description ?? data.error ?? 'Unknown error'}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: data.scope ? data.scope.split(',') : ['read'],
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(LINEAR_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    const data: LinearTokenResponse = await response.json();

    if (data.error || !data.access_token) {
      throw new Error(`Linear token refresh error: ${data.error_description ?? data.error ?? 'Unknown error'}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: data.scope ? data.scope.split(',') : ['read'],
    };
  }

  async getAccountInfo(accessToken: string): Promise<AccountInfo> {
    const response = await fetch(LINEAR_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: accessToken,
      },
      body: JSON.stringify({
        query: `query { viewer { organization { id name } } }`,
      }),
    });

    const result: LinearViewerResponse = await response.json();
    if (!result.data) {
      throw new Error('Failed to fetch Linear organization info');
    }

    return {
      id: result.data.viewer.organization.id,
      name: result.data.viewer.organization.name,
    };
  }

  async registerWebhook(
    _accessToken: string,
    _config: Record<string, unknown>,
  ): Promise<WebhookInfo | null> {
    // Linear auto-creates webhooks for OAuth apps
    return null;
  }

  async deregisterWebhook(_accessToken: string, _webhookId: string): Promise<void> {
    // No-op: Linear manages webhooks for OAuth apps
  }

  parseWebhook(
    _headers: Record<string, string>,
    body: unknown,
    _secret: string | null,
  ): WebhookEvent | null {
    if (!body || typeof body !== 'object') return null;

    const payload = body satisfies object;
    const action = 'action' in payload ? payload.action : undefined;
    const type = 'type' in payload ? payload.type : undefined;

    if (type !== 'Issue') return null;

    const dataObj = 'data' in payload && typeof payload.data === 'object' && payload.data !== null
      ? payload.data
      : undefined;

    if (!dataObj || !('id' in dataObj) || typeof dataObj.id !== 'string') return null;

    let eventAction: WebhookEvent['action'];
    if (action === 'create') eventAction = 'created';
    else if (action === 'update') eventAction = 'updated';
    else if (action === 'remove') eventAction = 'deleted';
    else return null;

    return {
      action: eventAction,
      externalId: dataObj.id,
    };
  }

  async sync(
    accessToken: string,
    _config: Record<string, unknown>,
    cursor: SyncCursor | null,
  ): Promise<SyncResult> {
    const updatedAfter = typeof cursor?.updatedAfter === 'string' ? cursor.updatedAfter : null;
    const afterCursor = typeof cursor?.afterCursor === 'string' ? cursor.afterCursor : null;

    const query = `
      query SyncIssues($first: Int!, $after: String, $updatedAfter: DateTime) {
        issues(
          first: $first
          after: $after
          filter: { updatedAt: { gt: $updatedAfter } }
          orderBy: updatedAt
        ) {
          nodes {
            id
            identifier
            title
            description
            url
            updatedAt
            state { name }
            priority
            assignee { name }
            comments {
              nodes {
                body
                user { name }
                createdAt
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const variables: Record<string, unknown> = { first: 50 };
    if (afterCursor) variables.after = afterCursor;
    if (updatedAfter) variables.updatedAfter = updatedAfter;

    const response = await fetch(LINEAR_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    const result: LinearIssuesResponse = await response.json();

    if (result.errors) {
      const errorMsg = result.errors.map((e) => e.message).join(', ');
      throw new Error(`Linear GraphQL error: ${errorMsg}`);
    }

    if (!result.data) {
      throw new Error('Linear GraphQL: no data in response');
    }

    const { nodes, pageInfo } = result.data.issues;

    const items: SyncedItem[] = nodes.map((issue) => {
      const commentText = issue.comments.nodes
        .map((c) => {
          const author = c.user?.name ?? 'Unknown';
          return `${author}: ${c.body}`;
        })
        .join('\n---\n');

      const contentParts = [
        `${issue.identifier}: ${issue.title}`,
        '',
        `Status: ${issue.state.name}`,
        `Priority: ${issue.priority}`,
      ];

      if (issue.assignee) {
        contentParts.push(`Assignee: ${issue.assignee.name}`);
      }

      if (issue.description) {
        contentParts.push('', issue.description);
      }

      if (commentText) {
        contentParts.push('', 'Comments:', commentText);
      }

      return {
        externalId: issue.id,
        title: `${issue.identifier}: ${issue.title}`,
        content: contentParts.join('\n'),
        sourceUrl: issue.url,
        metadata: {
          identifier: issue.identifier,
          state: issue.state.name,
          priority: issue.priority,
          assignee: issue.assignee?.name ?? null,
        },
      };
    });

    // Track the latest updatedAt for the next sync cursor
    let latestUpdatedAt = typeof updatedAfter === 'string' ? updatedAfter : '';
    for (const issue of nodes) {
      if (issue.updatedAt > latestUpdatedAt) {
        latestUpdatedAt = issue.updatedAt;
      }
    }

    return {
      items,
      deletedExternalIds: [],
      cursor: {
        updatedAfter: latestUpdatedAt || null,
        afterCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
      },
      hasMore: pageInfo.hasNextPage,
    };
  }
}
