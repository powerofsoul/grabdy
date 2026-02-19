import { Injectable, Logger } from '@nestjs/common';

import type { SyncedItem, WebhookEvent } from '../../../connector.interface';
import { getInitialSyncSlackTs } from '../../../integrations.constants';

// --- Slack API response types ---

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

const SLACK_API_URL = 'https://slack.com/api';

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

@Injectable()
export class SlackChannelWebhook {
  private readonly logger = new Logger(SlackChannelWebhook.name);

  extractEvent(body: unknown): WebhookEvent | null {
    if (!body || typeof body !== 'object') return null;

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

    return { action, externalId: channelId };
  }

  async fetchUpdatedItems(
    accessToken: string,
    providerData: {
      channelTimestamps: Record<string, string>;
      teamDomain?: string;
      slackBotUserId?: string;
    }
  ): Promise<{ items: SyncedItem[]; newTimestamps: Record<string, string> }> {
    const existingTimestamps = providerData.channelTimestamps;
    const teamDomain = providerData.teamDomain;

    // Fetch all non-archived channels the bot is a member of
    const channels = await this.fetchChannels(accessToken);
    const items: SyncedItem[] = [];
    const newTimestamps: Record<string, string> = {};

    for (const channel of channels) {
      const cursorTs = existingTimestamps[channel.id] ?? getInitialSyncSlackTs();

      // Quick check: are there new messages since last sync?
      const { messages: newMessages, latestTs } = await this.fetchChannelMessages(
        accessToken,
        channel.id,
        cursorTs,
        providerData.slackBotUserId
      );

      if (newMessages.length === 0) {
        // No changes — preserve existing timestamp
        if (existingTimestamps[channel.id]) {
          newTimestamps[channel.id] = existingTimestamps[channel.id];
        }
        continue;
      }

      // On initial sync (no saved timestamp), newMessages already contains everything from lookback.
      // On subsequent syncs, re-fetch from the lookback window to rebuild the full data source.
      const isInitialSync = !existingTimestamps[channel.id];
      const { messages: allMessages } = isInitialSync
        ? { messages: newMessages }
        : await this.fetchChannelMessages(
            accessToken,
            channel.id,
            getInitialSyncSlackTs(),
            providerData.slackBotUserId
          );

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
          sourceUrl:
            teamDomain && ts
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

      newTimestamps[channel.id] = latestTs || cursorTs;
    }

    return { items, newTimestamps };
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
    oldestTs: string,
    slackBotUserId?: string
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
      // Skip bot messages (including our own replies) to avoid indexing generated content.
      // Also skip messages that @mention the bot — these are questions directed at us,
      // not organic channel knowledge. Indexing them would pollute search results.
      const botMentionPattern = slackBotUserId ? `<@${slackBotUserId}>` : null;
      allMessages.push(
        ...messages.filter(
          (m) => !m.bot_id && (!botMentionPattern || !m.text?.includes(botMentionPattern))
        )
      );

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
