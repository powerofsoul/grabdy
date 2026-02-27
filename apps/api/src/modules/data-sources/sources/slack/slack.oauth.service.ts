import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { createHmac, timingSafeEqual } from 'crypto';

import { InjectEnv } from '../../../../config/env.config';
import type {
  AccountInfo,
  IntegrationOAuth,
  OAuthTokens,
} from '../../../integrations/connector.interface';

import {
  slackApiResponseSchema,
  type SlackChannel,
  type SlackConversationsListResponse,
  type SlackProviderData,
  type SlackTeamInfoResponse,
  type SlackTokenResponse,
} from './types';
import { SLACK_API_URL } from './utils';

const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const SLACK_SCOPES =
  'channels:history,channels:read,channels:join,users:read,team:read,app_mentions:read,chat:write,im:history,im:read';

@Injectable()
export class SlackOAuthService implements IntegrationOAuth<'SLACK'> {
  private readonly logger = new Logger(SlackOAuthService.name);

  constructor(
    @InjectEnv('slackClientId') private readonly oauthClient: string,
    @InjectEnv('slackClientSecret') private readonly clientSecret: string,
    @InjectEnv('slackSigningSecret') private readonly signingSecret: string
  ) {}

  getAuthUrl(_orgId: DbId<'Org'>, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.oauthClient,
      redirect_uri: redirectUri,
      scope: SLACK_SCOPES,
      state,
    });
    return `${SLACK_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens<'SLACK'>> {
    const response = await fetch(SLACK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.oauthClient,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    const data: SlackTokenResponse = await response.json();

    if (!data.ok || !data.access_token) {
      throw new Error(`Slack OAuth error: ${data.error ?? 'Unknown error'}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: null, // Slack bot tokens don't expire
      expiresAt: null,
      scopes: data.scope ? data.scope.split(',') : SLACK_SCOPES.split(','),
      metadata: data.bot_user_id ? { slackBotUserId: data.bot_user_id } : undefined,
    };
  }

  refreshTokens(_refreshToken: string): Promise<OAuthTokens<'SLACK'>> {
    throw new Error('Slack bot tokens do not expire and cannot be refreshed');
  }

  async revoke(accessToken: string, _providerData: SlackProviderData): Promise<void> {
    const response = await fetch(`${SLACK_API_URL}/apps.uninstall`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.oauthClient,
        client_secret: this.clientSecret,
      }),
    });

    const parsed = slackApiResponseSchema.safeParse(await response.json());
    if (!parsed.success || !parsed.data.ok) {
      this.logger.warn(
        `Slack apps.uninstall failed: ${parsed.success ? (parsed.data.error ?? 'unknown') : 'invalid response'}`
      );
    }
  }

  async getAccountInfo(accessToken: string): Promise<AccountInfo<'SLACK'>> {
    const response = await fetch(`${SLACK_API_URL}/team.info`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data: SlackTeamInfoResponse = await response.json();

    if (!data.ok || !data.team) {
      throw new Error(`Slack team.info error: ${data.error ?? 'Unknown error'}`);
    }

    const teamId = data.team.id;
    const teamName = data.team.name;

    if (!teamId || !teamName) {
      throw new Error('Slack team.info returned incomplete team data');
    }

    return {
      id: teamId,
      name: teamName,
      metadata: data.team.domain ? { teamDomain: data.team.domain } : undefined,
    };
  }

  buildInitialProviderData(
    tokenMetadata?: Partial<SlackProviderData>,
    accountMetadata?: Partial<SlackProviderData>
  ): SlackProviderData {
    return {
      provider: 'SLACK',
      slackBotUserId: tokenMetadata?.slackBotUserId ?? accountMetadata?.slackBotUserId,
      teamDomain: tokenMetadata?.teamDomain ?? accountMetadata?.teamDomain,
      channelTimestamps: {},
    };
  }

  verifyWebhookSignature(headers: Record<string, string>, rawBody: string): boolean {
    const timestamp = headers['x-slack-request-timestamp'];
    const signature = headers['x-slack-signature'];

    if (!timestamp || !signature) return false;

    // Prevent replay attacks (5 min window)
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(now - ts) > 300) return false;

    const sigBasestring = `v0:${timestamp}:${rawBody}`;
    const expectedSignature = `v0=${createHmac('sha256', this.signingSecret).update(sigBasestring).digest('hex')}`;

    // Timing-safe comparison
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    return sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer);
  }

  /** Fetch ALL non-archived public channels (regardless of membership). */
  async fetchAllPublicChannels(accessToken: string): Promise<SlackChannel[]> {
    const channels: SlackChannel[] = [];
    let nextCursor: string | undefined;

    do {
      const params = new URLSearchParams({
        types: 'public_channel',
        exclude_archived: 'true',
        limit: '200',
      });
      if (nextCursor) {
        params.set('cursor', nextCursor);
      }

      const response = await fetch(`${SLACK_API_URL}/conversations.list?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data: SlackConversationsListResponse = await response.json();

      if (!data.ok) {
        throw new Error(`Slack conversations.list error: ${data.error ?? 'Unknown error'}`);
      }

      if (data.channels) {
        channels.push(...data.channels);
      }

      nextCursor = data.response_metadata?.next_cursor || undefined;
    } while (nextCursor);

    return channels;
  }

  async listResources(
    accessToken: string,
    providerData: SlackProviderData
  ): Promise<Array<{ id: string; name: string; selected: boolean }>> {
    const selectedIds = new Set(providerData.selectedChannels ?? []);
    const channels = await this.fetchAllPublicChannels(accessToken);
    return channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      selected: selectedIds.has(ch.id),
    }));
  }
}
