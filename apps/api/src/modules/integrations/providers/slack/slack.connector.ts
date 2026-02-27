import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { IntegrationProvider } from '@grabdy/contracts';
import type { Queue } from 'bullmq';
import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';

import { InjectEnv } from '../../../../config/env.config';
import { InjectTypedQueue } from '../../../../queue/queue.decorators';
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

import { SlackChannelWebhook } from './webhooks/channel.webhook';
import type { SlackProviderData } from './slack.types';
import { SlackBotService } from './slack-bot.service';
import type { SlackProcessChannelJobData } from './slack-process-channel.processor';

const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const SLACK_API_URL = 'https://slack.com/api';
const SLACK_SCOPES =
  'channels:history,channels:read,channels:join,users:read,team:read,app_mentions:read,chat:write,im:history,im:read';

const slackApiResponseSchema = z.object({ ok: z.boolean(), error: z.string().optional() });

// --- Slack API response types ---

interface SlackTokenResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  bot_user_id?: string;
  team?: {
    id?: string;
    name?: string;
  };
  scope?: string;
}

interface SlackTeamInfoResponse {
  ok: boolean;
  error?: string;
  team?: {
    id?: string;
    name?: string;
    domain?: string;
  };
}

interface SlackChannel {
  id: string;
  name: string;
  is_member: boolean;
  is_archived: boolean;
}

interface SlackConversationsListResponse {
  ok: boolean;
  error?: string;
  channels?: SlackChannel[];
  response_metadata?: {
    next_cursor?: string;
  };
}

@Injectable()
export class SlackConnector extends IntegrationConnector<'SLACK'> {
  readonly provider = IntegrationProvider.SLACK;
  readonly rateLimits: RateLimitConfig = {
    maxRequestsPerMinute: 50,
    maxRequestsPerHour: 3000,
  };
  readonly syncSchedule = { every: 3_600_000 }; // 1 hour

  private readonly logger = new Logger(SlackConnector.name);

  constructor(
    @InjectEnv('slackClientId') private readonly oauthClient: string,
    @InjectEnv('slackClientSecret') private readonly clientSecret: string,
    @InjectEnv('slackSigningSecret') private readonly signingSecret: string,
    private readonly slackBotService: SlackBotService,
    private readonly channelWebhook: SlackChannelWebhook,
    @InjectTypedQueue('slack-process-channel') private readonly processChannelQueue: Queue
  ) {
    super();
  }

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

  async refreshTokens(_refreshToken: string): Promise<OAuthTokens<'SLACK'>> {
    // Slack bot tokens don't expire and cannot be refreshed
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

  // ---- Webhooks ------------------------------------------------------------

  verifyWebhook(headers: Record<string, string>, _body: unknown, rawBody?: string): boolean {
    // url_verification is handled by the controller before verifyWebhook is called
    return this.verifySignature(headers, rawBody ?? '');
  }

  handleWebhookRequest(
    headers: Record<string, string>,
    body: unknown,
    connections: ReadonlyArray<{
      id: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      providerData: SlackProviderData;
    }>,
    _rawBody?: string
  ): WebhookHandlerResult {
    // Delegate bot events (app_mention, member_joined, DM) to SlackBotService
    const botResult = this.slackBotService.handleWebhook(body, connections);
    if (botResult.handled) {
      return { response: { ok: true } };
    }

    // Non-bot events are acknowledged but no incremental sync is performed
    return { response: { ok: true } };
  }

  parseWebhook(
    headers: Record<string, string>,
    body: unknown,
    _secret: string | null,
    rawBody?: string
  ): WebhookEvent | null {
    if (!body || typeof body !== 'object') return null;

    if (!this.verifySignature(headers, rawBody ?? JSON.stringify(body))) return null;

    return this.channelWebhook.extractEvent(body);
  }

  // ---- Sync ----------------------------------------------------------------

  async sync(
    accessToken: string,
    providerData: SlackProviderData,
    context: { connectionId: DbId<'Connection'>; orgId: DbId<'Org'> }
  ): Promise<SyncResult> {
    // Join selected channels so they appear in the member list
    const selectedIds = providerData.selectedChannels ?? [];
    for (const channelId of selectedIds) {
      await this.joinChannel(accessToken, channelId);
    }

    // Discover all channels the bot is a member of
    const allChannels = await this.channelWebhook.fetchChannels(accessToken);

    if (allChannels.length > 0) {
      // Fan out one job per channel to the slack-process-channel queue
      await this.processChannelQueue.addBulk(
        allChannels.map((ch) => {
          const jobData: SlackProcessChannelJobData = {
            connectionId: context.connectionId,
            orgId: context.orgId,
            slackChannel: ch.id,
            channelName: ch.name,
            teamDomain: providerData.teamDomain,
          };
          return {
            name: 'process',
            data: jobData,
            opts: { jobId: `channel-${context.connectionId}-${ch.id}` },
          };
        })
      );
      this.logger.log(
        `Queued ${allChannels.length} channels for processing [${providerData.teamDomain ?? 'unknown workspace'}]`
      );
    }

    // Discover doesn't process items inline for Slack; the channel queue handles it
    return {
      items: [],
      deletedExternalIds: [],
      updatedProviderData: providerData,
      hasMore: false,
    };
  }

  async processWebhookItem(
    _accessToken: string,
    _providerData: SlackProviderData,
    _event: WebhookEvent
  ): Promise<{ item: SyncedItem | null; deletedExternalId: string | null }> {
    // Slack doesn't do incremental webhook sync — it uses hourly full sync
    return { item: null, deletedExternalId: null };
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

  // ---- Private: channel management ----------------------------------------

  private async joinChannel(accessToken: string, slackChannelId: string): Promise<void> {
    const response = await fetch(`${SLACK_API_URL}/conversations.join`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: slackChannelId }),
    });
    const data: { ok: boolean; error?: string } = await response.json();
    if (!data.ok && data.error !== 'already_in_channel') {
      this.logger.warn(`Failed to join channel ${slackChannelId}: ${data.error ?? 'Unknown'}`);
    }
  }

  /** Fetch ALL non-archived public channels (regardless of membership). */
  private async fetchAllPublicChannels(accessToken: string): Promise<SlackChannel[]> {
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

  // ---- Private: signature verification ------------------------------------

  private verifySignature(headers: Record<string, string>, bodyString: string): boolean {
    const timestamp = headers['x-slack-request-timestamp'];
    const signature = headers['x-slack-signature'];

    if (!timestamp || !signature) return false;

    // Prevent replay attacks (5 min window)
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(now - ts) > 300) return false;

    const sigBasestring = `v0:${timestamp}:${bodyString}`;
    const expectedSignature = `v0=${createHmac('sha256', this.signingSecret).update(sigBasestring).digest('hex')}`;

    // Timing-safe comparison
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    return sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer);
  }
}
