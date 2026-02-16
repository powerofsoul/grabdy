import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { IntegrationProvider } from '@grabdy/contracts';
import { createHmac, timingSafeEqual } from 'crypto';

import { InjectEnv } from '../../../../config/env.config';
import {
  type AccountInfo,
  IntegrationConnector,
  type OAuthTokens,
  type RateLimitConfig,
  type SlackConnectionConfig,
  type SyncCursor,
  type SyncedItem,
  type SyncResult,
  type WebhookEvent,
  type WebhookInfo,
} from '../../connector.interface';

const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const SLACK_API_URL = 'https://slack.com/api';
const SLACK_SCOPES =
  'channels:history,channels:read,users:read,team:read,app_mentions:read,chat:write,im:history,im:read';

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

interface SlackMessage {
  type: string;
  user?: string;
  text?: string;
  ts?: string;
  bot_id?: string;
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
  [channel: string]: string;
}

interface SlackSyncCursor {
  channelCursors: SlackChannelCursors;
}

function formatSlackTs(ts: string | undefined): string {
  if (!ts) return '';
  const date = new Date(parseFloat(ts) * 1000);
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

function formatSlackMessage(msg: SlackMessage): string {
  const time = formatSlackTs(msg.ts);
  const user = msg.user ?? 'unknown';
  const text = msg.text ?? '';
  return `[${time}] ${user}: ${text}`;
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
export class SlackConnector extends IntegrationConnector<'SLACK'> {
  readonly provider = IntegrationProvider.SLACK;
  readonly rateLimits: RateLimitConfig = {
    maxRequestsPerMinute: 50,
    maxRequestsPerHour: 3000,
  };
  readonly supportsWebhooks = true;
  readonly botInstructions = `You are a Slack bot. Answer concisely. Do a single search and stop.

Use Slack mrkdwn only: *bold*, _italic_, \`code\`, > quotes. Do NOT use markdown **bold**, # headings, or [links](url).

MANDATORY source citation rules:
- For Slack sources: quote the relevant text with > and link to the original message using <sourceUrl|text>. Attribute the author using <@slackAuthor> (the user ID from chunk metadata).
  Example: > <https://team.slack.com/archives/C123/p456|we shipped v2 on Monday> — <@U0ABC123>
- For file sources: include a clickable link using <sourceUrl|dataSourceName> plus metadata details (page number, sheet name, row, etc).
  Example: — <https://app.grabdy.com/preview/abc|Report.pdf> p.3`;

  private readonly logger = new Logger(SlackConnector.name);

  constructor(
    @InjectEnv('slackClientId') private readonly oauthClient: string,
    @InjectEnv('slackClientSecret') private readonly clientSecret: string,
    @InjectEnv('slackSigningSecret') private readonly signingSecret: string
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

  async registerWebhook(
    _accessToken: string,
    _config: SlackConnectionConfig
  ): Promise<WebhookInfo | null> {
    // Slack uses Events API - webhooks are configured in the Slack app dashboard
    // The endpoint URL is set there, not via API
    return null;
  }

  async deregisterWebhook(_accessToken: string, _webhookRef: string): Promise<void> {
    // No-op: Slack Events API webhooks are managed in the app dashboard
  }

  parseWebhook(
    headers: Record<string, string>,
    body: unknown,
    _secret: string | null,
    rawBody?: string
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

    const bodyString = rawBody ?? (typeof body === 'string' ? body : JSON.stringify(body));
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
    const channelId =
      'channel' in event && typeof event.channel === 'string' ? event.channel : undefined;

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
    config: SlackConnectionConfig,
    cursor: SyncCursor | null
  ): Promise<SyncResult> {
    const existingCursors: SlackChannelCursors = isSlackSyncCursor(cursor)
      ? cursor.channelCursors
      : {};

    const teamDomain = config.teamDomain;

    // Fetch all non-archived channels the bot is a member of
    const channels = await this.fetchChannels(accessToken);
    const items: SyncedItem[] = [];
    const newCursors: SlackChannelCursors = {};

    for (const channel of channels) {
      const cursorTs = existingCursors[channel.id] ?? '0';

      // Quick check: are there new messages since last sync?
      const { messages: newMessages, latestTs } = await this.fetchChannelMessages(
        accessToken,
        channel.id,
        cursorTs
      );

      if (newMessages.length === 0) {
        // No changes — preserve existing cursor
        if (existingCursors[channel.id]) {
          newCursors[channel.id] = existingCursors[channel.id];
        }
        continue;
      }

      // Fetch full history so the data source contains all messages
      const { messages: allMessages } =
        cursorTs === '0'
          ? { messages: newMessages }
          : await this.fetchChannelMessages(accessToken, channel.id, '0');

      const messages = allMessages.map((msg) => {
        const ts = msg.ts ?? '';
        return {
          content: formatSlackMessage(msg),
          metadata: {
            type: 'SLACK' as const,
            slackChannelId: channel.id,
            slackMessageTs: ts,
            slackAuthor: msg.user ?? 'unknown',
          },
          sourceUrl: teamDomain && ts
              ? `https://${teamDomain}.slack.com/archives/${channel.id}/p${ts.replace('.', '')}`
              : `https://slack.com/app_redirect?channel=${channel.id}`,
        };
      });
      const content = messages.map((m) => m.content).join('\n');

      items.push({
        externalId: channel.id,
        title: `#${channel.name}`,
        content,
        messages,
        sourceUrl: teamDomain
          ? `https://${teamDomain}.slack.com/archives/${channel.id}`
          : `https://slack.com/app_redirect?channel=${channel.id}`,
        metadata: {
          channelId: channel.id,
          channelName: channel.name,
          messageCount: allMessages.length,
        },
      });

      newCursors[channel.id] = latestTs || cursorTs;
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

  async fetchChannelMessages(
    accessToken: string,
    channel: string,
    oldestTs: string
  ): Promise<{ messages: SlackMessage[]; latestTs: string | undefined }> {
    const allMessages: SlackMessage[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({
        channel,
        limit: '200',
      });
      if (oldestTs !== '0') {
        params.set('oldest', oldestTs);
      }
      if (cursor) {
        params.set('cursor', cursor);
      }

      const response = await fetch(`${SLACK_API_URL}/conversations.history?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data: SlackConversationsHistoryResponse = await response.json();

      if (!data.ok) {
        this.logger.warn(
          `Slack conversations.history error for ${channel}: ${data.error ?? 'Unknown'}`
        );
        break;
      }

      const messages = data.messages ?? [];
      // Skip bot messages (including our own replies) to avoid indexing generated content
      allMessages.push(...messages.filter((m) => !m.bot_id));

      cursor = data.has_more ? data.response_metadata?.next_cursor || undefined : undefined;
    } while (cursor);

    // Find the latest timestamp among fetched messages
    let latestTs: string | undefined;
    for (const msg of allMessages) {
      if (msg.ts && (!latestTs || msg.ts > latestTs)) {
        latestTs = msg.ts;
      }
    }

    return { messages: allMessages, latestTs };
  }
}
