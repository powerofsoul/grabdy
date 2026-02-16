import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { IntegrationProvider } from '@grabdy/contracts';
import { createHmac, timingSafeEqual } from 'crypto';

import { InjectEnv } from '../../../../config/env.config';
import {
  type AccountInfo,
  IntegrationConnector,
  type LinearConnectionConfig,
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
const LINEAR_API_URL = 'https://api.linear.app/graphql';
const LINEAR_SCOPES = 'read';

// --- Linear GraphQL response types ---

interface LinearOrganization {
  id: string;
  name: string;
  urlKey: string;
}

interface LinearUser {
  name: string;
}

interface LinearLabel {
  name: string;
}

interface LinearComment {
  id: string;
  body: string;
  user: LinearUser | null;
  createdAt: string;
  url: string;
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  updatedAt: string;
  priority: number;
  priorityLabel: string;
  state: { name: string } | null;
  assignee: LinearUser | null;
  team: { name: string } | null;
  labels: { nodes: LinearLabel[] };
  parent: { identifier: string; title: string } | null;
  children: { nodes: Array<{ identifier: string; title: string; state: { name: string } | null }> };
  comments: {
    nodes: LinearComment[];
  };
}

interface LinearPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface LinearIssuesResponse {
  data?: {
    issues?: {
      nodes?: LinearIssue[];
      pageInfo?: LinearPageInfo;
    };
  };
  errors?: Array<{ message: string }>;
}

interface LinearOrganizationResponse {
  data?: {
    organization?: LinearOrganization;
  };
  errors?: Array<{ message: string }>;
}

interface LinearWebhookCreateResponse {
  data?: {
    webhookCreate?: {
      success: boolean;
      webhook?: {
        id: string;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

interface LinearWebhookBody {
  action?: string;
  type?: string;
  data?: {
    id?: string;
    // eslint-disable-next-line local/enforce-dbid -- must match Linear webhook wire format
    issueId?: string;
  };
  url?: string;
}

interface LinearSyncCursor {
  /** GraphQL pagination cursor within a single sync run */
  endCursor: string | null;
  /** ISO timestamp of the most recently updated issue seen — used to filter subsequent syncs */
  lastUpdatedAt: string | null;
  [key: string]: unknown;
}

function isLinearSyncCursor(value: unknown): value is LinearSyncCursor {
  if (!value || typeof value !== 'object') return false;
  return 'endCursor' in value;
}

function formatLinearDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

function buildIssueContextHeader(issue: LinearIssue): string {
  const lines: string[] = [];

  lines.push(`Issue ${issue.identifier}: ${issue.title}`);

  const statusParts: string[] = [];
  if (issue.state) statusParts.push(`Status: ${issue.state.name}`);
  if (issue.priorityLabel) statusParts.push(`Priority: ${issue.priorityLabel}`);
  if (issue.assignee) statusParts.push(`Assignee: ${issue.assignee.name}`);
  if (issue.team) statusParts.push(`Team: ${issue.team.name}`);
  if (statusParts.length > 0) lines.push(statusParts.join(' | '));

  const labelNames = issue.labels.nodes.map((l) => l.name);
  if (labelNames.length > 0) lines.push(`Labels: ${labelNames.join(', ')}`);

  if (issue.parent) {
    lines.push(`Parent: ${issue.parent.identifier} ${issue.parent.title}`);
  }

  if (issue.children.nodes.length > 0) {
    const childParts = issue.children.nodes.map(
      (c) => `${c.identifier} ${c.title}${c.state ? ` (${c.state.name})` : ''}`
    );
    lines.push(`Sub-issues: ${childParts.join(', ')}`);
  }

  return lines.join('\n');
}

function buildCommentContextLine(issue: LinearIssue): string {
  const parts = [`Comment on ${issue.identifier} (${issue.title})`];
  if (issue.state) parts.push(issue.state.name);
  if (issue.priorityLabel) parts.push(issue.priorityLabel);
  return parts.join(' | ');
}

@Injectable()
export class LinearConnector extends IntegrationConnector<'LINEAR'> {
  readonly provider = IntegrationProvider.LINEAR;
  readonly rateLimits: RateLimitConfig = {
    maxRequestsPerMinute: 25,
    maxRequestsPerHour: 1500,
  };
  readonly supportsWebhooks = true;

  private readonly logger = new Logger(LinearConnector.name);

  constructor(
    @InjectEnv('linearClientId') private readonly linearClientId: string,
    @InjectEnv('linearClientSecret') private readonly linearClientSecret: string
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

    const data: { access_token?: string; error?: string; scope?: string } =
      await response.json();

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
    const result: LinearOrganizationResponse = await this.graphql(accessToken, `{
      organization { id name urlKey }
    }`);

    const org = result.data?.organization;
    if (!org) {
      throw new Error(
        `Linear organization query failed: ${result.errors?.map((e) => e.message).join(', ') ?? 'Unknown error'}`
      );
    }

    return {
      id: org.id,
      name: org.name,
      metadata: { workspaceSlug: org.urlKey },
    };
  }

  async registerWebhook(
    accessToken: string,
    _config: LinearConnectionConfig
  ): Promise<WebhookInfo | null> {
    const secret = this.generateWebhookSecret();

    const result: LinearWebhookCreateResponse = await this.graphql(
      accessToken,
      `mutation CreateWebhook($url: String!, $resourceTypes: [String!]!, $secret: String!) {
        webhookCreate(input: { url: $url, resourceTypes: $resourceTypes, secret: $secret }) {
          success
          webhook { id }
        }
      }`,
      {
        url: `${process.env.API_URL ?? ''}/api/webhooks/LINEAR`,
        resourceTypes: ['Issue', 'Comment'],
        secret,
      }
    );

    const webhook = result.data?.webhookCreate;
    if (!webhook?.success || !webhook.webhook) {
      this.logger.warn('Failed to create Linear webhook', result.errors);
      return null;
    }

    return {
      webhookRef: webhook.webhook.id,
      secret,
    };
  }

  async deregisterWebhook(accessToken: string, webhookRef: string): Promise<void> {
    await this.graphql(
      accessToken,
      `mutation DeleteWebhook($id: String!) {
        webhookDelete(id: $id) { success }
      }`,
      { id: webhookRef }
    );
  }

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

    const payload = body satisfies object;
    if (!('action' in payload) || !('type' in payload)) return null;

    const typedPayload = payload as unknown as LinearWebhookBody;
    const actionStr = typedPayload.action;
    const typeStr = typedPayload.type;

    let action: WebhookEvent['action'];
    if (actionStr === 'create') action = 'created';
    else if (actionStr === 'update') action = 'updated';
    else if (actionStr === 'remove') action = 'deleted';
    else return null;

    // For comments, the relevant external ID is the parent issue
    let externalId: string | undefined;
    if (typeStr === 'Comment') {
      externalId = typedPayload.data?.issueId;
    } else if (typeStr === 'Issue') {
      externalId = typedPayload.data?.id;
    }

    if (!externalId) return null;

    return { action, externalId };
  }

  async sync(
    accessToken: string,
    _config: LinearConnectionConfig,
    cursor: SyncCursor | null
  ): Promise<SyncResult> {
    const parsed = isLinearSyncCursor(cursor) ? cursor : null;
    // On first call of a sync run, endCursor is null; on continuation pages it's set
    const paginationCursor = parsed?.endCursor ?? null;
    // Filter to issues updated after the last completed sync
    const lastUpdatedAt = parsed?.lastUpdatedAt ?? null;

    const filter = lastUpdatedAt ? { updatedAt: { gt: lastUpdatedAt } } : undefined;

    const result: LinearIssuesResponse = await this.graphql(
      accessToken,
      `query Issues($first: Int!, $after: String, $filter: IssueFilter) {
        issues(first: $first, after: $after, orderBy: updatedAt, filter: $filter) {
          nodes {
            id
            identifier
            title
            description
            url
            updatedAt
            priority
            priorityLabel
            state { name }
            assignee { name }
            team { name }
            labels { nodes { name } }
            parent { identifier title }
            children { nodes { identifier title state { name } } }
            comments {
              nodes {
                id
                body
                user { name }
                createdAt
                url
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }`,
      { first: 50, after: paginationCursor, filter }
    );

    const issues = result.data?.issues?.nodes ?? [];
    const pageInfo = result.data?.issues?.pageInfo;

    if (result.errors?.length) {
      this.logger.error(`Linear GraphQL errors during sync: ${result.errors.map((e) => e.message).join(', ')}`);
    }

    const items: SyncedItem[] = issues.map((issue) => {
      const messages: SyncedItem['messages'] = [];
      const contextHeader = buildIssueContextHeader(issue);

      // Issue description (or header-only) as first message
      const descriptionContent = issue.description
        ? `${contextHeader}\n\n${issue.description}`
        : contextHeader;

      messages.push({
        content: descriptionContent,
        metadata: {
          type: 'LINEAR' as const,
          linearIssueId: issue.id,
          linearCommentId: null,
          linearTimestamp: issue.updatedAt,
        },
        sourceUrl: issue.url,
      });

      // Each comment as a separate message with context line
      const commentContext = buildCommentContextLine(issue);
      for (const comment of issue.comments.nodes) {
        const author = comment.user?.name ?? 'Unknown';
        const time = formatLinearDate(comment.createdAt);
        messages.push({
          content: `${commentContext}\n[${time}] ${author}: ${comment.body}`,
          metadata: {
            type: 'LINEAR' as const,
            linearIssueId: issue.id,
            linearCommentId: comment.id,
            linearTimestamp: comment.createdAt,
          },
          sourceUrl: comment.url,
        });
      }

      const content = messages.map((m) => m.content).join('\n\n');

      const labelNames = issue.labels.nodes.map((l) => l.name);

      return {
        externalId: issue.id,
        title: `[${issue.identifier}] ${issue.title}`,
        content,
        messages,
        sourceUrl: issue.url,
        metadata: {
          linearIssueId: issue.id,
          identifier: issue.identifier,
          commentCount: issue.comments.nodes.length,
          status: issue.state?.name ?? null,
          priority: issue.priorityLabel || null,
          assignee: issue.assignee?.name ?? null,
          team: issue.team?.name ?? null,
          labels: labelNames.length > 0 ? labelNames : null,
        },
      };
    });

    const hasMore = pageInfo?.hasNextPage ?? false;

    // Track the latest updatedAt across all issues in this batch
    let maxUpdatedAt = lastUpdatedAt;
    for (const issue of issues) {
      if (!maxUpdatedAt || issue.updatedAt > maxUpdatedAt) {
        maxUpdatedAt = issue.updatedAt;
      }
    }

    const nextCursor: LinearSyncCursor = hasMore
      ? { endCursor: pageInfo?.endCursor ?? null, lastUpdatedAt: maxUpdatedAt }
      : { endCursor: null, lastUpdatedAt: maxUpdatedAt };

    return {
      items,
      deletedExternalIds: [],
      cursor: nextCursor,
      hasMore,
    };
  }

  private async graphql<T>(accessToken: string, query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    return response.json() satisfies Promise<T>;
  }

  private generateWebhookSecret(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('hex');
  }
}
