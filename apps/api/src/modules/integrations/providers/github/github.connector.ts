import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { IntegrationProvider } from '@grabdy/contracts';
import { createAppAuth } from '@octokit/auth-app';
import { graphql } from '@octokit/graphql';
import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';
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

import type { GitHubProviderData } from './github.types';

// ---------------------------------------------------------------------------
// Octokit response types (avoids inline type literals)
// ---------------------------------------------------------------------------

type GitHubIssue =
  | RestEndpointMethodTypes['issues']['listForRepo']['response']['data'][number]
  | RestEndpointMethodTypes['issues']['get']['response']['data'];
type GitHubPR =
  | RestEndpointMethodTypes['pulls']['list']['response']['data'][number]
  | RestEndpointMethodTypes['pulls']['get']['response']['data'];

// ---------------------------------------------------------------------------
// Zod schemas for GitHub webhook payloads (trust boundary)
// ---------------------------------------------------------------------------

const webhookNumberedItemSchema = z.object({ number: z.number() });
const webhookRepoSchema = z.object({ full_name: z.string() });
const webhookInstallationSchema = z.object({ id: z.number() });

const webhookBasePayloadSchema = z.object({
  action: z.string().optional(),
  repository: webhookRepoSchema.optional(),
  installation: webhookInstallationSchema.optional(),
});

const issueWebhookSchema = webhookBasePayloadSchema.extend({ issue: webhookNumberedItemSchema });
const prWebhookSchema = webhookBasePayloadSchema.extend({
  pull_request: webhookNumberedItemSchema,
});
const discussionWebhookSchema = webhookBasePayloadSchema.extend({
  discussion: webhookNumberedItemSchema,
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type GitHubItemType = 'issue' | 'pull_request' | 'discussion';
type MessageList = NonNullable<SyncedItem['messages']>;

function formatGitHubDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

function buildContextHeader(opts: {
  repo: string;
  number: number;
  title: string;
  kind?: string;
  state?: string;
  author: string;
  labels: string[];
  assignees?: string[];
  branches?: { head: string; base: string };
}): string {
  const prefix = opts.kind ? ` (${opts.kind})` : '';
  const lines: string[] = [`${opts.repo}#${opts.number}${prefix}: ${opts.title}`];

  const parts: string[] = [];
  if (opts.state) parts.push(`State: ${opts.state}`);
  if (opts.author) parts.push(`Author: ${opts.author}`);
  if (opts.assignees && opts.assignees.length > 0)
    parts.push(`Assignees: ${opts.assignees.join(', ')}`);
  if (parts.length > 0) lines.push(parts.join(' | '));

  if (opts.branches) lines.push(`Branches: ${opts.branches.head} -> ${opts.branches.base}`);
  if (opts.labels.length > 0) lines.push(`Labels: ${opts.labels.join(', ')}`);

  return lines.join('\n');
}

function buildSyncedItem(
  itemType: GitHubItemType,
  repo: string,
  number: number,
  title: string,
  sourceUrl: string,
  contextHeader: string,
  body: string | null | undefined,
  comments: MessageList,
  metadata: Record<string, unknown>
): SyncedItem {
  const descContent = body ? `${contextHeader}\n\n${body}` : contextHeader;
  const messages: MessageList = [
    {
      content: descContent,
      metadata: { type: 'GITHUB' as const, githubItemType: itemType, githubCommentId: null },
      sourceUrl,
    },
    ...comments,
  ];

  return {
    externalId: `${repo}#${number}`,
    title: `[${repo}#${number}] ${title}`,
    content: messages.map((m) => m.content).join('\n\n'),
    messages,
    sourceUrl,
    metadata: { githubItemType: itemType, repo, number, ...metadata },
  };
}

function extractLabels(labels: Array<{ name?: string } | string>): string[] {
  return labels
    .map((l) => (typeof l === 'string' ? l : l.name))
    .filter((n): n is string => n !== undefined);
}

// ---------------------------------------------------------------------------
// Discussion GraphQL types
// ---------------------------------------------------------------------------

interface DiscussionNode {
  number: number;
  title: string;
  body: string;
  url: string;
  updatedAt: string;
  author: { login: string } | null;
  category: { name: string } | null;
  labels: { nodes: Array<{ name: string }> } | null;
  comments: {
    nodes: Array<{
      id: string;
      body: string;
      url: string;
      createdAt: string;
      author: { login: string } | null;
    }>;
  };
}

const DISCUSSION_FIELDS = `
  number title body url updatedAt
  author { login }
  category { name }
  labels(first: 10) { nodes { name } }
  comments(first: 50) {
    nodes { id body url createdAt author { login } }
  }
`;

function buildDiscussionItem(discussion: DiscussionNode, repoFullName: string): SyncedItem {
  const author = discussion.author?.login ?? 'unknown';
  const labels = (discussion.labels?.nodes ?? []).map((l) => l.name);
  const category = discussion.category?.name ?? '';

  const header = buildContextHeader({
    repo: repoFullName,
    number: discussion.number,
    title: discussion.title,
    kind: 'Discussion',
    author,
    labels,
  });
  // Insert category into the metadata line if present
  const contextHeader = category ? header.replace('\n', `\nCategory: ${category} | `) : header;

  const comments: MessageList = discussion.comments.nodes.map((c) => ({
    content: `Comment on ${repoFullName}#${discussion.number} Discussion (${discussion.title})\n[${formatGitHubDate(c.createdAt)}] ${c.author?.login ?? 'unknown'}: ${c.body}`,
    metadata: {
      type: 'GITHUB' as const,
      githubItemType: 'discussion' as const,
      githubCommentId: c.id,
    },
    sourceUrl: c.url,
  }));

  return buildSyncedItem(
    'discussion',
    repoFullName,
    discussion.number,
    discussion.title,
    discussion.url,
    contextHeader,
    discussion.body,
    comments,
    { category: category || null, labels: labels.length > 0 ? labels : null }
  );
}

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

@Injectable()
export class GitHubConnector extends IntegrationConnector<'GITHUB'> {
  readonly provider = IntegrationProvider.GITHUB;
  readonly rateLimits: RateLimitConfig = { maxRequestsPerMinute: 30, maxRequestsPerHour: 5000 };
  readonly syncSchedule = null; // Webhook-driven

  private readonly logger = new Logger(GitHubConnector.name);

  constructor(
    @InjectEnv('githubAppId') private readonly githubAppId: string,
    @InjectEnv('githubAppSlug') private readonly githubAppSlug: string,
    @InjectEnv('githubPrivateKey') private readonly githubPrivateKey: string,
    @InjectEnv('githubWebhookSecret') private readonly githubWebhookSecret: string
  ) {
    super();
  }

  // ---- Auth ----------------------------------------------------------------

  getAuthUrl(_orgId: DbId<'Org'>, state: string, _redirectUri: string): string {
    return `https://github.com/apps/${this.githubAppSlug}/installations/new?state=${encodeURIComponent(state)}`;
  }

  async exchangeCode(
    installationIdStr: string,
    _redirectUri: string
  ): Promise<OAuthTokens<'GITHUB'>> {
    const installationId = parseInt(installationIdStr, 10);
    if (isNaN(installationId))
      throw new Error(`Invalid GitHub installation ID: ${installationIdStr}`);

    const { token, expiresAt } = await this.createInstallationToken(installationId);
    return {
      accessToken: token,
      refreshToken: String(installationId),
      expiresAt,
      scopes: ['repo', 'read:org'],
      metadata: { githubInstallationId: installationId },
    };
  }

  async refreshTokens(installationIdStr: string): Promise<OAuthTokens<'GITHUB'>> {
    const installationId = parseInt(installationIdStr, 10);
    if (isNaN(installationId))
      throw new Error(`Invalid GitHub installation ID for refresh: ${installationIdStr}`);

    const { token, expiresAt } = await this.createInstallationToken(installationId);
    return {
      accessToken: token,
      refreshToken: String(installationId),
      expiresAt,
      scopes: ['repo', 'read:org'],
    };
  }

  async getAccountInfo(accessToken: string): Promise<AccountInfo<'GITHUB'>> {
    const octokit = new Octokit({ auth: accessToken });
    const { data } = await octokit.apps.listReposAccessibleToInstallation({ per_page: 1 });
    const login = data.repositories[0]?.owner.login ?? 'unknown';
    return { id: login, name: login, metadata: { installationOwner: login } };
  }

  // ---- Webhooks ------------------------------------------------------------

  parseWebhook(
    headers: Record<string, string>,
    body: unknown,
    secret: string | null,
    rawBody?: string
  ): WebhookEvent | null {
    if (!secret || !this.verifySignature(headers, body, rawBody)) return null;
    return this.extractWebhookEvent(headers, body);
  }

  handleWebhookRequest(
    headers: Record<string, string>,
    body: unknown,
    connections: ReadonlyArray<{
      id: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      providerData: GitHubProviderData;
    }>,
    rawBody?: string
  ): WebhookHandlerResult {
    if (!this.verifySignature(headers, body, rawBody)) return { response: { ok: true } };

    const eventType = headers['x-github-event'];
    const basePayload = webhookBasePayloadSchema.safeParse(body);
    const payloadInstallationId = basePayload.success
      ? basePayload.data.installation?.id
      : undefined;

    // App lifecycle events (uninstall / suspend)
    if (eventType === 'installation') {
      const action = basePayload.success ? basePayload.data.action : undefined;
      if (action === 'deleted' || action === 'suspend') {
        const matched = payloadInstallationId
          ? connections.filter((c) => c.providerData.githubInstallationId === payloadInstallationId)
          : [];
        this.logger.log(
          `GitHub App ${action} for installation ${payloadInstallationId}, disconnecting ${matched.length} connection(s)`
        );
        return {
          response: { ok: true },
          disconnectConnections: matched.map((c) => ({ id: c.id, orgId: c.orgId })),
        };
      }
      return { response: { ok: true } };
    }

    // Data events
    const event = this.extractWebhookEvent(headers, body);
    if (!event) return { response: { ok: true } };

    const matched = payloadInstallationId
      ? connections.filter((c) => c.providerData.githubInstallationId === payloadInstallationId)
      : connections;

    return {
      response: { ok: true },
      syncConnections: matched.map((c) => ({ id: c.id, orgId: c.orgId, event })),
    };
  }

  // ---- Sync ----------------------------------------------------------------

  async sync(accessToken: string, providerData: GitHubProviderData): Promise<SyncResult> {
    const octokit = new Octokit({ auth: accessToken });
    const since = providerData.lastSyncedAt ?? getInitialSyncSince();

    const items: SyncedItem[] = [];
    let maxUpdatedAt = providerData.lastSyncedAt;
    let hasMore = false;

    const { data: reposResponse } = await octokit.apps.listReposAccessibleToInstallation({
      per_page: 100,
    });

    for (const repo of reposResponse.repositories) {
      const owner = repo.owner.login;
      const repoName = repo.name;
      const repoFullName = repo.full_name;

      // Issues
      try {
        const { data: issues } = await octokit.issues.listForRepo({
          owner,
          repo: repoName,
          state: 'all',
          sort: 'updated',
          direction: 'desc',
          since,
          per_page: 50,
        });
        for (const issue of issues) {
          if (issue.pull_request) continue;
          items.push(await this.buildIssueItem(octokit, owner, repoName, repoFullName, issue));
          if (!maxUpdatedAt || issue.updated_at > maxUpdatedAt) maxUpdatedAt = issue.updated_at;
        }
        if (issues.length >= 50) hasMore = true;
      } catch (err) {
        this.logger.warn(`Failed to fetch issues for ${repoFullName}: ${err}`);
      }

      // Pull requests
      try {
        const { data: prs } = await octokit.pulls.list({
          owner,
          repo: repoName,
          state: 'all',
          sort: 'updated',
          direction: 'desc',
          per_page: 50,
        });
        const filtered = since ? prs.filter((pr) => pr.updated_at > since) : prs;
        for (const pr of filtered) {
          items.push(await this.buildPRItem(octokit, owner, repoName, repoFullName, pr));
          if (!maxUpdatedAt || pr.updated_at > maxUpdatedAt) maxUpdatedAt = pr.updated_at;
        }
        if (filtered.length >= 50) hasMore = true;
      } catch (err) {
        this.logger.warn(`Failed to fetch PRs for ${repoFullName}: ${err}`);
      }

      // Discussions (GraphQL)
      try {
        const discussions = await this.fetchDiscussions(
          accessToken,
          owner,
          repoName,
          repoFullName,
          since
        );
        for (const d of discussions) {
          items.push(d.item);
          if (!maxUpdatedAt || d.updatedAt > maxUpdatedAt) maxUpdatedAt = d.updatedAt;
        }
      } catch (err) {
        this.logger.debug(`No discussions for ${repoFullName}: ${err}`);
      }
    }

    return {
      items,
      deletedExternalIds: [],
      updatedProviderData: { ...providerData, lastSyncedAt: maxUpdatedAt },
      hasMore,
    };
  }

  async processWebhookItem(
    accessToken: string,
    _providerData: GitHubProviderData,
    event: WebhookEvent
  ): Promise<{ item: SyncedItem | null; deletedExternalId: string | null }> {
    if (event.action === 'deleted') return { item: null, deletedExternalId: event.externalId };

    const match = /^(.+?)\/(.+?)#(\d+)$/.exec(event.externalId);
    if (!match) {
      this.logger.warn(`Invalid GitHub external ID format: ${event.externalId}`);
      return { item: null, deletedExternalId: null };
    }

    const [, owner, repoName, numStr] = match;
    const number = parseInt(numStr, 10);
    const repoFullName = `${owner}/${repoName}`;
    const octokit = new Octokit({ auth: accessToken });

    try {
      const { data: issue } = await octokit.issues.get({
        owner,
        repo: repoName,
        issue_number: number,
      });
      if (issue.pull_request) {
        const { data: pr } = await octokit.pulls.get({
          owner,
          repo: repoName,
          pull_number: number,
        });
        return {
          item: await this.buildPRItem(octokit, owner, repoName, repoFullName, pr),
          deletedExternalId: null,
        };
      }
      return {
        item: await this.buildIssueItem(octokit, owner, repoName, repoFullName, issue),
        deletedExternalId: null,
      };
    } catch {
      // Might be a discussion — issues API returns 404 for discussions
      try {
        const item = await this.fetchDiscussionByNumber(
          accessToken,
          owner,
          repoName,
          repoFullName,
          number
        );
        if (item) return { item, deletedExternalId: null };
      } catch {
        /* ignore */
      }

      this.logger.warn(`Could not fetch GitHub item ${event.externalId} for webhook sync`);
      return { item: null, deletedExternalId: null };
    }
  }

  buildInitialProviderData(
    tokenMetadata?: Partial<GitHubProviderData>,
    accountMetadata?: Partial<GitHubProviderData>
  ): GitHubProviderData {
    const githubInstallationId =
      tokenMetadata?.githubInstallationId ?? accountMetadata?.githubInstallationId;
    if (githubInstallationId === undefined)
      throw new Error('GitHub App installation ID is required');
    return {
      provider: 'GITHUB',
      githubInstallationId,
      installationOwner: tokenMetadata?.installationOwner ?? accountMetadata?.installationOwner,
      lastSyncedAt: null,
    };
  }

  // ---- Private: webhook parsing --------------------------------------------

  private extractWebhookEvent(headers: Record<string, string>, body: unknown): WebhookEvent | null {
    const eventType = headers['x-github-event'];
    if (!eventType) return null;

    const base = webhookBasePayloadSchema.safeParse(body);
    if (!base.success) return null;

    const repo = base.data.repository?.full_name;
    if (!repo) return null;

    const action = base.data.action;
    let webhookAction: WebhookEvent['action'];
    if (action === 'opened' || action === 'created') webhookAction = 'created';
    else if (
      action === 'edited' ||
      action === 'closed' ||
      action === 'reopened' ||
      action === 'synchronize'
    )
      webhookAction = 'updated';
    else if (action === 'deleted') webhookAction = 'deleted';
    else webhookAction = 'updated';

    let number: number | undefined;
    if (eventType === 'issues' || eventType === 'issue_comment') {
      const parsed = issueWebhookSchema.safeParse(body);
      if (parsed.success) number = parsed.data.issue.number;
    } else if (eventType === 'pull_request' || eventType === 'pull_request_review_comment') {
      const parsed = prWebhookSchema.safeParse(body);
      if (parsed.success) number = parsed.data.pull_request.number;
    } else if (eventType === 'discussion' || eventType === 'discussion_comment') {
      const parsed = discussionWebhookSchema.safeParse(body);
      if (parsed.success) number = parsed.data.discussion.number;
    }

    if (number === undefined) return null;
    return { action: webhookAction, externalId: `${repo}#${number}` };
  }

  private verifySignature(
    headers: Record<string, string>,
    body: unknown,
    rawBody?: string
  ): boolean {
    const signature = headers['x-hub-signature-256'];
    if (!signature || !this.githubWebhookSecret) return false;

    const bodyString = rawBody ?? JSON.stringify(body);
    const expected = `sha256=${createHmac('sha256', this.githubWebhookSecret).update(bodyString).digest('hex')}`;

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    return sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer);
  }

  // ---- Private: GitHub App auth --------------------------------------------

  private decodePrivateKey(): string {
    const raw = this.githubPrivateKey;
    if (raw.startsWith('-----BEGIN')) return raw.replace(/\\n/g, '\n');
    return Buffer.from(raw, 'base64').toString('utf8');
  }

  private async createInstallationToken(
    installationId: number
  ): Promise<{ token: string; expiresAt: Date }> {
    const auth = createAppAuth({ appId: this.githubAppId, privateKey: this.decodePrivateKey() });
    const result = await auth({ type: 'installation', installationId });
    return {
      token: result.token,
      expiresAt: result.expiresAt ? new Date(result.expiresAt) : new Date(Date.now() + 3_600_000),
    };
  }

  // ---- Private: item builders ----------------------------------------------

  private async buildIssueItem(
    octokit: Octokit,
    owner: string,
    repoName: string,
    repoFullName: string,
    issue: GitHubIssue
  ): Promise<SyncedItem> {
    const labels = extractLabels(issue.labels);
    const assignees = (issue.assignees ?? []).map((a) => a.login);
    const author = issue.user?.login ?? 'unknown';

    const header = buildContextHeader({
      repo: repoFullName,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      author,
      labels,
      assignees,
    });

    const comments = await this.fetchIssueComments(
      octokit,
      owner,
      repoName,
      repoFullName,
      issue.number,
      issue.title,
      'issue'
    );

    return buildSyncedItem(
      'issue',
      repoFullName,
      issue.number,
      issue.title,
      issue.html_url,
      header,
      issue.body,
      comments,
      {
        state: issue.state,
        labels: labels.length > 0 ? labels : null,
        assignees: assignees.length > 0 ? assignees : null,
      }
    );
  }

  private async buildPRItem(
    octokit: Octokit,
    owner: string,
    repoName: string,
    repoFullName: string,
    pr: GitHubPR
  ): Promise<SyncedItem> {
    const labels = extractLabels(pr.labels);
    const assignees = (pr.assignees ?? []).map((a) => a.login);
    const author = pr.user?.login ?? 'unknown';
    const merged = pr.merged_at !== null && pr.merged_at !== undefined;
    const state = merged ? 'merged' : pr.state;

    const header = buildContextHeader({
      repo: repoFullName,
      number: pr.number,
      title: pr.title,
      kind: 'PR',
      state,
      author,
      labels,
      assignees,
      branches: { head: pr.head.ref, base: pr.base.ref },
    });

    const comments = await this.fetchIssueComments(
      octokit,
      owner,
      repoName,
      repoFullName,
      pr.number,
      pr.title,
      'pull_request'
    );
    const reviewComments = await this.fetchReviewComments(
      octokit,
      owner,
      repoName,
      repoFullName,
      pr.number,
      pr.title
    );

    return buildSyncedItem(
      'pull_request',
      repoFullName,
      pr.number,
      pr.title,
      pr.html_url,
      header,
      pr.body,
      [...comments, ...reviewComments],
      {
        state,
        labels: labels.length > 0 ? labels : null,
        assignees: assignees.length > 0 ? assignees : null,
      }
    );
  }

  // ---- Private: comment fetching -------------------------------------------

  private async fetchIssueComments(
    octokit: Octokit,
    owner: string,
    repoName: string,
    repoFullName: string,
    number: number,
    title: string,
    itemType: GitHubItemType
  ): Promise<MessageList> {
    try {
      const { data: comments } = await octokit.issues.listComments({
        owner,
        repo: repoName,
        issue_number: number,
        per_page: 100,
      });
      const kind = itemType === 'pull_request' ? ' PR' : '';
      return comments.map((c) => ({
        content: `Comment on ${repoFullName}#${number}${kind} (${title})\n[${formatGitHubDate(c.created_at)}] ${c.user?.login ?? 'unknown'}: ${c.body ?? ''}`,
        metadata: {
          type: 'GITHUB' as const,
          githubItemType: itemType,
          githubCommentId: String(c.id),
        },
        sourceUrl: c.html_url,
      }));
    } catch (err) {
      this.logger.warn(`Failed to fetch comments for ${repoFullName}#${number}: ${err}`);
      return [];
    }
  }

  private async fetchReviewComments(
    octokit: Octokit,
    owner: string,
    repoName: string,
    repoFullName: string,
    number: number,
    title: string
  ): Promise<MessageList> {
    try {
      const { data: comments } = await octokit.pulls.listReviewComments({
        owner,
        repo: repoName,
        pull_number: number,
        per_page: 100,
      });
      return comments.map((c) => ({
        content: `Review comment on ${repoFullName}#${number} PR (${title}) at ${c.path}\n[${formatGitHubDate(c.created_at)}] ${c.user?.login ?? 'unknown'}: ${c.body}`,
        metadata: {
          type: 'GITHUB' as const,
          githubItemType: 'pull_request' as const,
          githubCommentId: String(c.id),
        },
        sourceUrl: c.html_url,
      }));
    } catch (err) {
      this.logger.warn(`Failed to fetch review comments for ${repoFullName}#${number}: ${err}`);
      return [];
    }
  }

  // ---- Private: discussions (GraphQL) --------------------------------------

  private async fetchDiscussions(
    accessToken: string,
    owner: string,
    repoName: string,
    repoFullName: string,
    since: string | undefined
  ): Promise<Array<{ item: SyncedItem; updatedAt: string }>> {
    const gql = graphql.defaults({ headers: { authorization: `token ${accessToken}` } });

    const result = await gql<{ repository: { discussions: { nodes: DiscussionNode[] } } }>(
      `query ($owner: String!, $repo: String!, $first: Int!) {
        repository(owner: $owner, name: $repo) {
          discussions(first: $first, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes { ${DISCUSSION_FIELDS} }
          }
        }
      }`,
      { owner, repo: repoName, first: 50 }
    );

    return result.repository.discussions.nodes
      .filter((d) => !since || d.updatedAt > since)
      .map((d) => ({ item: buildDiscussionItem(d, repoFullName), updatedAt: d.updatedAt }));
  }

  private async fetchDiscussionByNumber(
    accessToken: string,
    owner: string,
    repoName: string,
    repoFullName: string,
    number: number
  ): Promise<SyncedItem | null> {
    const gql = graphql.defaults({ headers: { authorization: `token ${accessToken}` } });

    const result = await gql<{ repository: { discussion: DiscussionNode | null } }>(
      `query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          discussion(number: $number) { ${DISCUSSION_FIELDS} }
        }
      }`,
      { owner, repo: repoName, number }
    );

    const discussion = result.repository.discussion;
    return discussion ? buildDiscussionItem(discussion, repoFullName) : null;
  }
}
