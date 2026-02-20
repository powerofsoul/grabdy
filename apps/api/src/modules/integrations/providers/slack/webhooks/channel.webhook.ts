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
  thread_ts?: string;
  reply_count?: number;
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

interface SlackConversationsRepliesResponse {
  ok: boolean;
  error?: string;
  messages?: SlackMessage[];
  has_more?: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
}

/** Max threads to expand per channel sync to stay within Slack rate limits (Tier 3: ~50 req/min). */
const MAX_THREAD_FETCHES_PER_CHANNEL = 30;

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

      const isInitialSync = !existingTimestamps[channel.id];

      // Expand threads: replace thread parents with full thread (parent + replies)
      const expandedMessages = await this.expandThreads(
        accessToken,
        channel.id,
        newMessages,
        providerData.slackBotUserId
      );

      const messages = expandedMessages.map((msg) => {
        const ts = msg.ts ?? '';
        return {
          content: formatSlackMessage(msg),
          metadata: {
            type: 'SLACK' as const,
            slackChannelId: channel.id,
            slackMessageTs: ts,
            slackAuthors: [msg.user ?? 'unknown'],
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
          messageCount: newMessages.length,
        },
        // On subsequent syncs, append new chunks without deleting old ones
        appendOnly: !isInitialSync,
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

  /**
   * Expand thread parents into full threads (parent + replies).
   * Non-threaded messages pass through unchanged. Thread replies are inserted
   * in chronological order right after their parent, replacing the standalone parent.
   */
  async expandThreads(
    accessToken: string,
    channelId: string,
    messages: SlackMessage[],
    slackBotUserId?: string
  ): Promise<SlackMessage[]> {
    // Identify thread parents (messages with replies) — sorted by most replies first
    const threadParents = messages
      .filter((m) => m.reply_count && m.reply_count > 0 && m.ts)
      .sort((a, b) => (b.reply_count ?? 0) - (a.reply_count ?? 0))
      .slice(0, MAX_THREAD_FETCHES_PER_CHANNEL);

    if (threadParents.length === 0) return messages;

    // Fetch replies sequentially with a minimum gap between requests to stay
    // within Slack Tier 3 rate limits (~50 req/min). Network latency provides
    // some natural spacing, but we add 200ms minimum to handle fast responses.
    const threadRepliesMap = new Map<string, SlackMessage[]>();
    const MIN_REQUEST_GAP_MS = 200;

    for (const parent of threadParents) {
      const requestStart = Date.now();
      const replies = await this.fetchThreadReplies(
        accessToken,
        channelId,
        parent.ts ?? '',
        slackBotUserId
      );

      // Filter replies by thread_ts (more resilient than position-based slicing)
      const threadTs = parent.ts ?? '';
      const actualReplies = replies.filter((r) => r.ts !== threadTs);
      if (actualReplies.length > 0) {
        threadRepliesMap.set(threadTs, actualReplies);
      }

      // Ensure minimum gap between requests
      const elapsed = Date.now() - requestStart;
      if (elapsed < MIN_REQUEST_GAP_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_GAP_MS - elapsed));
      }
    }

    // Rebuild message list: for each thread parent, insert replies after it
    // Thread parents from the bot are already filtered out by fetchChannelMessages,
    // but guard here too in case messages come from a different source (e.g., channel_joined)
    const expanded: SlackMessage[] = [];
    for (const msg of messages) {
      if (msg.bot_id) continue;
      expanded.push(msg);
      const replies = threadRepliesMap.get(msg.ts ?? '');
      if (replies) {
        expanded.push(...replies);
      }
    }

    return expanded;
  }

  private async fetchThreadReplies(
    accessToken: string,
    channel: string,
    threadTs: string,
    slackBotUserId?: string
  ): Promise<SlackMessage[]> {
    const allReplies: SlackMessage[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({
        channel,
        ts: threadTs,
        limit: '200',
      });
      if (cursor) {
        params.set('cursor', cursor);
      }

      const response = await fetch(
        `${SLACK_API_URL}/conversations.replies?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const data: SlackConversationsRepliesResponse = await response.json();

      if (!data.ok) {
        this.logger.warn(
          `Slack conversations.replies error for thread ${threadTs}: ${data.error ?? 'Unknown'}`
        );
        break;
      }

      const msgs = data.messages ?? [];
      const botMentionPattern = slackBotUserId ? `<@${slackBotUserId}>` : null;
      allReplies.push(
        ...msgs.filter(
          (m) => !m.bot_id && (!botMentionPattern || !m.text?.includes(botMentionPattern))
        )
      );

      cursor = data.has_more ? data.response_metadata?.next_cursor || undefined : undefined;
    } while (cursor);

    return allReplies;
  }
}
