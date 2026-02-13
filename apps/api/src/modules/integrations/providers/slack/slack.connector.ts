import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

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

const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const SLACK_API_URL = 'https://slack.com/api';
const SLACK_SCOPES = 'channels:history,channels:read,users:read,team:read';

// --- Slack API response types ---

interface SlackTokenResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
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

interface SlackMessage {
  type: string;
  user?: string;
  text?: string;
  ts?: string;
}

interface SlackConversationsHistoryResponse {
  ok: boolean;
  error?: string;
  messages?: SlackMessage[];
  has_more?: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
}

interface SlackChannelCursors {
  [channelId: string]: string;
}

interface SlackSyncCursor {
  channelCursors: SlackChannelCursors;
}

function isSlackSyncCursor(value: unknown): value is SlackSyncCursor {
  if (!value || typeof value !== 'object') return false;
  if (!('channelCursors' in value)) return false;
  const candidate = value;
  if (
    !('channelCursors' in candidate) ||
    typeof candidate.channelCursors !== 'object' ||
    candidate.channelCursors === null
  ) {
    return false;
  }
  return true;
}

@Injectable()
export class SlackConnector extends IntegrationConnector {
  readonly provider = IntegrationProvider.SLACK;
  readonly rateLimits: RateLimitConfig = {
    maxRequestsPerMinute: 50,
    maxRequestsPerHour: 3000,
  };
  readonly supportsWebhooks = true;

  private readonly logger = new Logger(SlackConnector.name);

  constructor(
    @InjectEnv('slackClientId') private readonly clientId: string,
    @InjectEnv('slackClientSecret') private readonly clientSecret: string,
    @InjectEnv('slackSigningSecret') private readonly signingSecret: string,
  ) {
    super();
  }

  getAuthUrl(_orgId: string, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: SLACK_SCOPES,
      state,
    });
    return `${SLACK_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(SLACK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
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
    };
  }

  async refreshTokens(_refreshToken: string): Promise<OAuthTokens> {
    // Slack bot tokens don't expire and cannot be refreshed
    throw new Error('Slack bot tokens do not expire and cannot be refreshed');
  }

  async getAccountInfo(accessToken: string): Promise<AccountInfo> {
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
    };
  }

  async registerWebhook(
    _accessToken: string,
    _config: Record<string, unknown>,
  ): Promise<WebhookInfo | null> {
    // Slack uses Events API - webhooks are configured in the Slack app dashboard
    // The endpoint URL is set there, not via API
    return null;
  }

  async deregisterWebhook(_accessToken: string, _webhookId: string): Promise<void> {
    // No-op: Slack Events API webhooks are managed in the app dashboard
  }

  parseWebhook(
    headers: Record<string, string>,
    body: unknown,
    _secret: string | null,
  ): WebhookEvent | null {
    if (!body || typeof body !== 'object') return null;

    // Verify Slack signature
    const timestamp = headers['x-slack-request-timestamp'];
    const signature = headers['x-slack-signature'];

    if (!timestamp || !signature) return null;

    // Prevent replay attacks (5 min window)
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(now - ts) > 300) return null;

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const sigBasestring = `v0:${timestamp}:${bodyString}`;
    const expectedSignature = `v0=${createHmac('sha256', this.signingSecret).update(sigBasestring).digest('hex')}`;

    // Timing-safe comparison
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      this.logger.warn('Slack webhook signature verification failed');
      return null;
    }

    // Parse the event payload
    if (!('event' in body)) return null;
    const event = (body satisfies object) && 'event' in body ? body.event : undefined;
    if (!event || typeof event !== 'object') return null;

    const eventType = 'type' in event ? event.type : undefined;
    const channelId = 'channel' in event && typeof event.channel === 'string' ? event.channel : undefined;

    if (!channelId) return null;

    let action: WebhookEvent['action'];
    if (eventType === 'message') {
      // Check for subtypes
      const subtype = 'subtype' in event ? event.subtype : undefined;
      if (subtype === 'message_deleted') {
        action = 'deleted';
      } else if (subtype === 'message_changed') {
        action = 'updated';
      } else {
        action = 'created';
      }
    } else {
      return null;
    }

    return {
      action,
      externalId: channelId,
    };
  }

  async sync(
    accessToken: string,
    _config: Record<string, unknown>,
    cursor: SyncCursor | null,
  ): Promise<SyncResult> {
    const existingCursors: SlackChannelCursors = isSlackSyncCursor(cursor)
      ? cursor.channelCursors
      : {};

    // Fetch all non-archived channels the bot is a member of
    const channels = await this.fetchChannels(accessToken);
    const items: SyncedItem[] = [];
    const newCursors: SlackChannelCursors = {};

    for (const channel of channels) {
      const oldestTs = existingCursors[channel.id] ?? '0';
      const { messages, latestTs } = await this.fetchChannelMessages(
        accessToken,
        channel.id,
        oldestTs,
      );

      if (messages.length === 0) {
        // Preserve existing cursor even if no new messages
        if (existingCursors[channel.id]) {
          newCursors[channel.id] = existingCursors[channel.id];
        }
        continue;
      }

      const content = messages
        .map((msg) => {
          const user = msg.user ?? 'unknown';
          const text = msg.text ?? '';
          return `${user}: ${text}`;
        })
        .join('\n');

      items.push({
        externalId: channel.id,
        title: `#${channel.name}`,
        content,
        sourceUrl: null,
        metadata: {
          channelId: channel.id,
          channelName: channel.name,
          messageCount: messages.length,
        },
      });

      newCursors[channel.id] = latestTs || oldestTs;
    }

    return {
      items,
      deletedExternalIds: [],
      cursor: { channelCursors: newCursors },
      hasMore: false,
    };
  }

  private async fetchChannels(accessToken: string): Promise<SlackChannel[]> {
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
        for (const ch of data.channels) {
          if (ch.is_member) {
            channels.push(ch);
          }
        }
      }

      nextCursor = data.response_metadata?.next_cursor || undefined;
    } while (nextCursor);

    return channels;
  }

  private async fetchChannelMessages(
    accessToken: string,
    channelId: string,
    oldestTs: string,
  ): Promise<{ messages: SlackMessage[]; latestTs: string | undefined }> {
    const params = new URLSearchParams({
      channel: channelId,
      limit: '200',
    });
    if (oldestTs !== '0') {
      params.set('oldest', oldestTs);
    }

    const response = await fetch(
      `${SLACK_API_URL}/conversations.history?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const data: SlackConversationsHistoryResponse = await response.json();

    if (!data.ok) {
      this.logger.warn(`Slack conversations.history error for ${channelId}: ${data.error ?? 'Unknown'}`);
      return { messages: [], latestTs: undefined };
    }

    const messages = data.messages ?? [];

    // Find the latest timestamp among fetched messages
    let latestTs: string | undefined;
    for (const msg of messages) {
      if (msg.ts && (!latestTs || msg.ts > latestTs)) {
        latestTs = msg.ts;
      }
    }

    return { messages, latestTs };
  }
}
