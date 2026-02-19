import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { IntegrationProvider } from '@grabdy/contracts';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
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

import type { GitHubProviderData } from './github.types';
import { webhookBasePayloadSchema } from './github.utils';
import { GitHubDiscussionWebhook } from './webhooks/discussion.webhook';
import { GitHubIssueWebhook } from './webhooks/issue.webhook';
import { GitHubPrWebhook } from './webhooks/pr.webhook';

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
    @InjectEnv('githubWebhookSecret') private readonly githubWebhookSecret: string,
    private readonly issueWebhook: GitHubIssueWebhook,
    private readonly prWebhook: GitHubPrWebhook,
    private readonly discussionWebhook: GitHubDiscussionWebhook
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
      const issueResult = await this.issueWebhook.fetchUpdatedItems(
        octokit,
        owner,
        repoName,
        repoFullName,
        since
      );
      items.push(...issueResult.items);
      if (issueResult.hasMore) hasMore = true;
      if (issueResult.maxUpdatedAt && (!maxUpdatedAt || issueResult.maxUpdatedAt > maxUpdatedAt)) {
        maxUpdatedAt = issueResult.maxUpdatedAt;
      }

      // Pull requests
      const prResult = await this.prWebhook.fetchUpdatedItems(
        octokit,
        owner,
        repoName,
        repoFullName,
        since
      );
      items.push(...prResult.items);
      if (prResult.hasMore) hasMore = true;
      if (prResult.maxUpdatedAt && (!maxUpdatedAt || prResult.maxUpdatedAt > maxUpdatedAt)) {
        maxUpdatedAt = prResult.maxUpdatedAt;
      }

      // Discussions (GraphQL)
      try {
        const discussions = await this.discussionWebhook.fetchUpdatedItems(
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
          item: await this.prWebhook.fetchItem(octokit, owner, repoName, repoFullName, pr),
          deletedExternalId: null,
        };
      }
      return {
        item: await this.issueWebhook.fetchItem(octokit, owner, repoName, repoFullName, issue),
        deletedExternalId: null,
      };
    } catch {
      // Might be a discussion — issues API returns 404 for discussions
      try {
        const item = await this.discussionWebhook.fetchItem(
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

  // ---- Private: webhook routing ---------------------------------------------

  private extractWebhookEvent(headers: Record<string, string>, body: unknown): WebhookEvent | null {
    const eventType = headers['x-github-event'];
    if (!eventType) return null;

    const base = webhookBasePayloadSchema.safeParse(body);
    if (!base.success) return null;

    const repo = base.data.repository?.full_name;
    if (!repo) return null;

    const action = base.data.action;

    if (eventType === 'issues' || eventType === 'issue_comment') {
      return this.issueWebhook.extractEvent(action, body, repo);
    }
    if (eventType === 'pull_request' || eventType === 'pull_request_review_comment') {
      return this.prWebhook.extractEvent(action, body, repo);
    }
    if (eventType === 'discussion' || eventType === 'discussion_comment') {
      return this.discussionWebhook.extractEvent(action, body, repo);
    }

    return null;
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
}
