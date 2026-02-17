import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { IntegrationProvider } from '@grabdy/contracts';
import { LinearClient, PaginationOrderBy } from '@linear/sdk';
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

import type { LinearProviderData } from './linear.types';

const LINEAR_AUTH_URL = 'https://linear.app/oauth/authorize';
const LINEAR_TOKEN_URL = 'https://api.linear.app/oauth/token';
const LINEAR_SCOPES = 'read';

const linearWebhookBodySchema = z.object({
  action: z.string().optional(),
  type: z.string().optional(),
  data: z
    .object({
      id: z.string().optional(),
      issueId: z.string().optional(),
    })
    .optional(),
  url: z.string().optional(),
});

function formatLinearDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

interface IssueFields {
  id: string;
  identifier: string;
  title: string;
  description: string | undefined;
  url: string;
  updatedAt: Date;
  priority: number;
  priorityLabel: string;
  state: { name: string } | undefined;
  assignee: { name: string } | undefined;
  team: { name: string } | undefined;
  labels: { nodes: Array<{ name: string }> };
  parent: { identifier: string; title: string } | undefined;
  children: {
    nodes: Array<{ identifier: string; title: string; state: { name: string } | undefined }>;
  };
  comments: {
    nodes: Array<{
      id: string;
      body: string;
      user: { name: string } | undefined;
      createdAt: Date;
      url: string;
    }>;
  };
}

function buildIssueContextHeader(issue: IssueFields): string {
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

function buildCommentContextLine(issue: IssueFields): string {
  const parts = [`Comment on ${issue.identifier} (${issue.title})`];
  if (issue.state) parts.push(issue.state.name);
  if (issue.priorityLabel) parts.push(issue.priorityLabel);
  return parts.join(' | ');
}

function buildSyncedItemFromIssue(issue: IssueFields): SyncedItem {
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
    },
    sourceUrl: issue.url,
  });

  // Each comment as a separate message with context line
  const commentContext = buildCommentContextLine(issue);
  for (const comment of issue.comments.nodes) {
    const author = comment.user?.name ?? 'Unknown';
    const time = formatLinearDate(comment.createdAt.toISOString());
    messages.push({
      content: `${commentContext}\n[${time}] ${author}: ${comment.body}`,
      metadata: {
        type: 'LINEAR' as const,
        linearIssueId: issue.id,
        linearCommentId: comment.id,
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
}

async function fetchIssueWithRelations(
  client: LinearClient,
  linearIssueId: string
): Promise<IssueFields | null> {
  const issue = await client.issue(linearIssueId);
  if (!issue) return null;

  const [
    stateResult,
    assigneeResult,
    teamResult,
    labelsResult,
    parentResult,
    childrenResult,
    commentsResult,
  ] = await Promise.all([
    issue.state,
    issue.assignee,
    issue.team,
    issue.labels(),
    issue.parent,
    issue.children(),
    issue.comments(),
  ]);

  const commentNodes = await Promise.all(
    commentsResult.nodes.map(async (c) => {
      const user = await c.user;
      return {
        id: c.id,
        body: c.body,
        user: user ? { name: user.name } : undefined,
        createdAt: c.createdAt,
        url: c.url,
      };
    })
  );

  const childNodes = await Promise.all(
    childrenResult.nodes.map(async (child) => {
      const childState = await child.state;
      return {
        identifier: child.identifier,
        title: child.title,
        state: childState ? { name: childState.name } : undefined,
      };
    })
  );

  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description ?? undefined,
    url: issue.url,
    updatedAt: issue.updatedAt,
    priority: issue.priority,
    priorityLabel: issue.priorityLabel,
    state: stateResult ? { name: stateResult.name } : undefined,
    assignee: assigneeResult ? { name: assigneeResult.name } : undefined,
    team: teamResult ? { name: teamResult.name } : undefined,
    labels: { nodes: labelsResult.nodes.map((l) => ({ name: l.name })) },
    parent: parentResult
      ? { identifier: parentResult.identifier, title: parentResult.title }
      : undefined,
    children: { nodes: childNodes },
    comments: { nodes: commentNodes },
  };
}

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
    @InjectEnv('linearWebhookSecret') private readonly linearWebhookSecret: string
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

    const parsed = linearWebhookBodySchema.safeParse(body);
    if (!parsed.success) return null;

    const typedPayload = parsed.data;
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

  async sync(accessToken: string, providerData: LinearProviderData): Promise<SyncResult> {
    const client = new LinearClient({ accessToken });
    const lastIssueSyncedAt = providerData.lastIssueSyncedAt;

    const filter = lastIssueSyncedAt
      ? { updatedAt: { gt: new Date(lastIssueSyncedAt) } }
      : undefined;

    const issuesConnection = await client.issues({
      first: 50,
      orderBy: PaginationOrderBy.UpdatedAt,
      filter,
    });

    const items: SyncedItem[] = [];
    let maxUpdatedAt = lastIssueSyncedAt;

    for (const issue of issuesConnection.nodes) {
      const fields = await fetchIssueWithRelations(client, issue.id);
      if (!fields) continue;

      items.push(buildSyncedItemFromIssue(fields));

      const updatedAtStr = fields.updatedAt.toISOString();
      if (!maxUpdatedAt || updatedAtStr > maxUpdatedAt) {
        maxUpdatedAt = updatedAtStr;
      }
    }

    const hasMore = issuesConnection.pageInfo.hasNextPage;

    return {
      items,
      deletedExternalIds: [],
      updatedProviderData: {
        ...providerData,
        lastIssueSyncedAt: maxUpdatedAt,
      },
      hasMore,
    };
  }

  async processWebhookItem(
    accessToken: string,
    providerData: LinearProviderData,
    event: WebhookEvent
  ): Promise<{ item: SyncedItem | null; deletedExternalId: string | null }> {
    if (event.action === 'deleted') {
      return { item: null, deletedExternalId: event.externalId };
    }

    const client = new LinearClient({ accessToken });
    const fields = await fetchIssueWithRelations(client, event.externalId);
    if (!fields) {
      this.logger.warn(`Could not fetch Linear issue ${event.externalId} for webhook sync`);
      return { item: null, deletedExternalId: null };
    }

    return { item: buildSyncedItemFromIssue(fields), deletedExternalId: null };
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
