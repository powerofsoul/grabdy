import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

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

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_URL = 'https://api.github.com';

const GITHUB_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

// ─── API response interfaces ───────────────────────────────────────────

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  login: string;
  id: number;
  name: string | null;
}

interface GitHubRepo {
  full_name: string;
  owner: { login: string };
  name: string;
  html_url: string;
  updated_at: string;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  updated_at: string;
  user: { login: string } | null;
  labels: Array<{ name: string }>;
  pull_request?: { url: string };
}

interface GitHubComment {
  id: number;
  body: string;
  user: { login: string } | null;
  created_at: string;
}

interface GitHubWebhookCreateResponse {
  id: number;
  active: boolean;
  config: { url: string; content_type: string };
}

interface GitHubWebhookPayload {
  action?: string;
  issue?: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    state: string;
    updated_at: string;
    user: { login: string } | null;
    labels: Array<{ name: string }>;
  };
  repository?: {
    full_name: string;
    owner: { login: string };
    name: string;
  };
}

// ─── Type guard ────────────────────────────────────────────────────────

function isGitHubWebhookPayload(value: unknown): value is GitHubWebhookPayload {
  if (!value || typeof value !== 'object') return false;
  // We only need action and issue to exist; shape validated by caller
  return 'action' in value;
}

// ─── Cursor shape ──────────────────────────────────────────────────────

interface GitHubSyncCursor extends SyncCursor {
  since: string;
}

// ─── Connector ─────────────────────────────────────────────────────────

@Injectable()
export class GitHubConnector extends IntegrationConnector {
  readonly provider = IntegrationProvider.GITHUB;
  readonly rateLimits: RateLimitConfig = {
    maxRequestsPerMinute: 83, // ~5000/hr spread evenly
    maxRequestsPerHour: 5000,
  };
  readonly supportsWebhooks = true;

  private readonly logger = new Logger(GitHubConnector.name);

  constructor(
    @InjectEnv('githubClientId') private readonly oauthClient: string,
    @InjectEnv('githubClientSecret') private readonly clientSecret: string,
    @InjectEnv('githubWebhookSecret') private readonly webhookSecret: string,
  ) {
    super();
  }

  // ── OAuth ──────────────────────────────────────────────────────────

  getAuthUrl(_orgId: DbId<'Org'>, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.oauthClient,
      redirect_uri: redirectUri,
      scope: 'repo,read:org',
      state,
    });
    return `${GITHUB_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.oauthClient,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data: GitHubTokenResponse = await response.json();

    if (data.error || !data.access_token) {
      throw new Error(
        `GitHub OAuth error: ${data.error_description ?? data.error ?? 'Unknown error'}`,
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: null, // GitHub OAuth Apps don't issue refresh tokens
      expiresAt: null, // Tokens don't expire
      scopes: data.scope ? data.scope.split(',') : ['repo', 'read:org'],
    };
  }

  async refreshTokens(_refreshToken: string): Promise<OAuthTokens> {
    // GitHub OAuth App tokens don't expire and can't be refreshed
    throw new Error('GitHub OAuth App tokens do not support refresh');
  }

  // ── Account info ───────────────────────────────────────────────────

  async getAccountInfo(accessToken: string): Promise<AccountInfo> {
    const response = await fetch(`${GITHUB_API_URL}/user`, {
      headers: {
        ...GITHUB_HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const user: GitHubUser = await response.json();
    return {
      id: user.login,
      name: user.login,
    };
  }

  // ── Webhooks ───────────────────────────────────────────────────────

  async registerWebhook(
    accessToken: string,
    config: Record<string, unknown>,
  ): Promise<WebhookInfo | null> {
    const owner = config['owner'];
    const repo = config['repo'];
    const callbackUrl = config['callbackUrl'];

    if (typeof owner !== 'string' || typeof repo !== 'string' || typeof callbackUrl !== 'string') {
      this.logger.warn('Missing owner, repo, or callbackUrl in webhook config');
      return null;
    }

    const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      headers: {
        ...GITHUB_HEADERS,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['issues', 'issue_comment'],
        config: {
          url: callbackUrl,
          content_type: 'json',
          secret: this.webhookSecret,
          insecure_ssl: '0',
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub webhook registration failed: ${response.status} ${text}`);
    }

    const hook: GitHubWebhookCreateResponse = await response.json();
    return {
      webhookRef: String(hook.id),
      secret: this.webhookSecret,
    };
  }

  async deregisterWebhook(accessToken: string, webhookRef: string): Promise<void> {
    // webhookRef format: owner/repo/hookId
    const parts = webhookRef.split('/');
    if (parts.length < 3) {
      this.logger.warn(`Invalid webhook ref format: ${webhookRef}`);
      return;
    }
    const owner = parts[0];
    const repo = parts[1];
    const hookId = parts[2];

    const response = await fetch(
      `${GITHUB_API_URL}/repos/${owner}/${repo}/hooks/${hookId}`,
      {
        method: 'DELETE',
        headers: {
          ...GITHUB_HEADERS,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`GitHub webhook deletion failed: ${response.status}`);
    }
  }

  parseWebhook(
    headers: Record<string, string>,
    body: unknown,
    secret: string | null,
  ): WebhookEvent | null {
    // Verify HMAC signature
    const signature = headers['x-hub-signature-256'];
    if (!signature || !secret) {
      this.logger.warn('Missing webhook signature or secret');
      return null;
    }

    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedSig = 'sha256=' + createHmac('sha256', secret).update(bodyStr).digest('hex');

    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      this.logger.warn('Webhook signature verification failed');
      return null;
    }

    if (!isGitHubWebhookPayload(body)) return null;

    const { action, issue } = body;
    if (!action || !issue) return null;

    let eventAction: WebhookEvent['action'];
    if (action === 'opened') eventAction = 'created';
    else if (
      action === 'edited' ||
      action === 'closed' ||
      action === 'reopened' ||
      action === 'labeled' ||
      action === 'unlabeled'
    ) eventAction = 'updated';
    else if (action === 'deleted') eventAction = 'deleted';
    else return null;

    return {
      action: eventAction,
      externalId: String(issue.id),
    };
  }

  // ── Sync ───────────────────────────────────────────────────────────

  async sync(
    accessToken: string,
    _config: Record<string, unknown>,
    cursor: SyncCursor | null,
  ): Promise<SyncResult> {
    const since = this.extractCursorSince(cursor);
    const repos = await this.fetchRepos(accessToken);
    const items: SyncedItem[] = [];
    let latestUpdated = since;

    for (const repo of repos) {
      const issues = await this.fetchIssues(accessToken, repo.owner.login, repo.name, since);

      for (const issue of issues) {
        // Skip pull requests (GitHub API returns PRs as issues)
        if (issue.pull_request) continue;

        const comments = await this.fetchComments(
          accessToken,
          repo.owner.login,
          repo.name,
          issue.number,
        );

        const commentText = comments
          .map((c) => `${c.user?.login ?? 'Unknown'} (${c.created_at}): ${c.body}`)
          .join('\n---\n');

        const contentParts = [
          `${repo.full_name}#${issue.number}: ${issue.title}`,
        ];

        if (issue.body) {
          contentParts.push('', issue.body);
        }

        if (commentText) {
          contentParts.push('', 'Comments:', commentText);
        }

        items.push({
          externalId: String(issue.id),
          title: `${repo.full_name}#${issue.number}: ${issue.title}`,
          content: contentParts.join('\n'),
          sourceUrl: issue.html_url,
          metadata: {
            repo: repo.full_name,
            number: issue.number,
            state: issue.state,
            labels: issue.labels.map((l) => l.name),
          },
        });

        if (issue.updated_at > latestUpdated) {
          latestUpdated = issue.updated_at;
        }
      }
    }

    const nextCursor: GitHubSyncCursor = {
      since: latestUpdated || new Date().toISOString(),
    };

    return {
      items,
      deletedExternalIds: [],
      cursor: nextCursor,
      hasMore: false, // We fetch everything in one pass
    };
  }

  // ── Private helpers ────────────────────────────────────────────────

  private async fetchRepos(accessToken: string): Promise<GitHubRepo[]> {
    const response = await fetch(
      `${GITHUB_API_URL}/user/repos?sort=updated&per_page=100`,
      {
        headers: {
          ...GITHUB_HEADERS,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub repos fetch failed: ${response.status}`);
    }

    const repos: GitHubRepo[] = await response.json();
    return repos;
  }

  private async fetchIssues(
    accessToken: string,
    owner: string,
    repo: string,
    since: string,
  ): Promise<GitHubIssue[]> {
    const params = new URLSearchParams({
      state: 'all',
      sort: 'updated',
      per_page: '100',
    });

    if (since) {
      params.set('since', since);
    }

    const response = await fetch(
      `${GITHUB_API_URL}/repos/${owner}/${repo}/issues?${params.toString()}`,
      {
        headers: {
          ...GITHUB_HEADERS,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      this.logger.warn(`Failed to fetch issues for ${owner}/${repo}: ${response.status}`);
      return [];
    }

    const issues: GitHubIssue[] = await response.json();
    return issues;
  }

  private async fetchComments(
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<GitHubComment[]> {
    const response = await fetch(
      `${GITHUB_API_URL}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      {
        headers: {
          ...GITHUB_HEADERS,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      this.logger.warn(
        `Failed to fetch comments for ${owner}/${repo}#${issueNumber}: ${response.status}`,
      );
      return [];
    }

    const comments: GitHubComment[] = await response.json();
    return comments;
  }

  private extractCursorSince(cursor: SyncCursor | null): string {
    if (!cursor || typeof cursor !== 'object') return '';
    const since = cursor['since'];
    return typeof since === 'string' ? since : '';
  }
}
