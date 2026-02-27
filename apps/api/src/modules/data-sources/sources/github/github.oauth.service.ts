import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { createHmac, timingSafeEqual } from 'crypto';

import { InjectEnv } from '../../../../config/env.config';
import type {
  AccountInfo,
  IntegrationOAuth,
  OAuthTokens,
} from '../../../integrations/connector.interface';

import type { GitHubProviderData } from './types';

@Injectable()
export class GitHubOAuthService implements IntegrationOAuth<'GITHUB'> {
  private readonly logger = new Logger(GitHubOAuthService.name);

  constructor(
    @InjectEnv('githubAppId') private readonly githubAppId: string,
    @InjectEnv('githubAppSlug') private readonly githubAppSlug: string,
    @InjectEnv('githubPrivateKey') private readonly githubPrivateKey: string,
    @InjectEnv('githubWebhookSecret') private readonly githubWebhookSecret: string
  ) {}

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

  async revoke(_accessToken: string, _providerData: GitHubProviderData): Promise<void> {
    // No-op: GitHub App installations are managed by the user in GitHub settings.
  }

  async getAccountInfo(accessToken: string): Promise<AccountInfo<'GITHUB'>> {
    const octokit = new Octokit({ auth: accessToken });
    const { data } = await octokit.apps.listReposAccessibleToInstallation({ per_page: 1 });
    const login = data.repositories[0]?.owner.login ?? 'unknown';
    return { id: login, name: login, metadata: { installationOwner: login } };
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

  verifyWebhookSignature(
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
