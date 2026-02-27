import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../../../../../redis/redis.module';
import type { SyncedItem, WebhookEvent } from '../../../connector.interface';

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

const slackLogger = new Logger('SlackThrottle');

const SLACK_API_URL = 'https://slack.com/api';

/** Max retries when Slack returns rate_limited. */
const MAX_RATE_LIMIT_RETRIES = 25;

/** Minimum gap between consecutive Slack API calls. Tier 3 allows ~50 req/min (1200ms). */
const MIN_REQUEST_GAP_MS = 1300;

/** Tracks when the last Slack API call was made per access token (per workspace). */
const lastRequestTimeByToken = new Map<string, number>();

async function throttledSlackFetch(url: string, accessToken: string): Promise<Response> {
  // Enforce minimum gap between requests for this specific workspace token
  const now = Date.now();
  const lastTime = lastRequestTimeByToken.get(accessToken) ?? 0;
  const timeSinceLast = now - lastTime;
  if (timeSinceLast < MIN_REQUEST_GAP_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_GAP_MS - timeSinceLast));
  }

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    lastRequestTimeByToken.set(accessToken, Date.now());
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '5', 10);
      const method = new URL(url).pathname.split('/').pop() ?? url;
      slackLogger.warn(
        `Rate limited on ${method}, retry after ${retryAfter}s (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`
      );
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      continue;
    }

    return response;
  }

  throw new Error('Exceeded max rate limit retries for Slack API');
}

function formatSlackTs(ts: string | undefined): string {
  if (!ts) return '';
  const date = new Date(parseFloat(ts) * 1000);
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

function formatSlackMessage(msg: SlackMessage, userNames: Map<string, string>): string {
  const time = formatSlackTs(msg.ts);
  const userId = msg.user ?? 'unknown';
  const user = userNames.get(userId) ?? userId;
  const text = msg.text ?? '';
  return `[${time}] ${user}: ${text}`;
}

interface SlackUserInfoResponse {
  ok: boolean;
  error?: string;
  user?: {
    real_name?: string;
    profile?: { display_name?: string; real_name?: string };
  };
}

const SLACK_USER_CACHE_TTL = 10 * 60 * 60; // 10 hours in seconds

@Injectable()
export class SlackChannelWebhook {
  private readonly logger = new Logger(SlackChannelWebhook.name);

  constructor(private readonly redis: RedisService) {}

  extractEvent(body: unknown): WebhookEvent | null {
    if (!body || typeof body !== 'object') return null;

    // Parse the event payload
    if (!('event' in body)) return null;
    const event = (body satisfies object) && 'event' in body ? body.event : undefined;
    if (!event || typeof event !== 'object') return null;

    const eventType = 'type' in event ? event.type : undefined;
    const slackChannel =
      'channel' in event && typeof event.channel === 'string' ? event.channel : undefined;

    if (!slackChannel) return null;

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

    return { action, externalId: slackChannel };
  }

  /**
   * Fetch and sync a single channel. Returns the synced item (if messages found)
   * and the new timestamp cursor for this channel.
   */
  async fetchSingleChannel(
    accessToken: string,
    channel: { id: string; name: string },
    providerData: {
      channelTimestamps: Record<string, string>;
      teamDomain?: string;
      slackBotUserId?: string;
    }
  ): Promise<{ item: SyncedItem | null; newTimestamp: string | null }> {
    const existingTimestamps = providerData.channelTimestamps;
    const teamDomain = providerData.teamDomain;
    const isInitialSync = !existingTimestamps[channel.id];

    const { messages: newMessages, latestTs } = isInitialSync
      ? await this.fetchRecentMessages(accessToken, channel.id, providerData.slackBotUserId)
      : await this.fetchChannelMessages(
          accessToken,
          channel.id,
          existingTimestamps[channel.id],
          providerData.slackBotUserId
        );

    if (newMessages.length === 0) {
      // No new messages, preserve existing timestamp
      return {
        item: null,
        newTimestamp: existingTimestamps[channel.id] ?? null,
      };
    }

    // Expand threads: replace thread parents with full thread (parent + replies)
    const expandedMessages = await this.expandThreads(
      accessToken,
      channel.id,
      newMessages,
      providerData.slackBotUserId
    );

    // Resolve user IDs to display names (cached in Redis)
    const userNames = await this.resolveUserNames(accessToken, expandedMessages);

    const messages = expandedMessages.map((msg) => {
      const ts = msg.ts ?? '';
      const userId = msg.user ?? 'unknown';
      return {
        content: formatSlackMessage(msg, userNames),
        metadata: {
          type: 'SLACK' as const,
          slackChannelId: channel.id,
          slackMessageTs: ts,
          slackAuthors: [userNames.get(userId) ?? userId],
        },
        sourceUrl:
          teamDomain && ts
            ? `https://${teamDomain}.slack.com/archives/${channel.id}/p${ts.replace('.', '')}`
            : `https://slack.com/app_redirect?channel=${channel.id}`,
      };
    });
    const content = messages.map((m) => m.content).join('\n');

    const item: SyncedItem = {
      externalId: channel.id,
      title: `#${channel.name}`,
      content,
      messages,
      sourceUrl: teamDomain
        ? `https://${teamDomain}.slack.com/archives/${channel.id}`
        : `https://slack.com/app_redirect?channel=${channel.id}`,
      metadata: {
        slackChannel: channel.id,
        channelName: channel.name,
        messageCount: newMessages.length,
      },
      // On subsequent syncs, append new chunks without deleting old ones
      appendOnly: !isInitialSync,
    };

    return { item, newTimestamp: latestTs || existingTimestamps[channel.id] || null };
  }

  /**
   * Resolve Slack user IDs to display names. Uses Redis cache with 10h TTL.
   */
  async resolveUserNames(
    accessToken: string,
    messages: SlackMessage[]
  ): Promise<Map<string, string>> {
    const userIds = new Set<string>();
    for (const msg of messages) {
      if (msg.user) userIds.add(msg.user);
    }

    const result = new Map<string, string>();
    const uncached: string[] = [];

    // Check Redis cache first
    for (const userId of userIds) {
      const cached = await this.redis.get(`slack:user:${userId}`);
      if (cached) {
        result.set(userId, cached);
      } else {
        uncached.push(userId);
      }
    }

    // Fetch uncached users from Slack API
    for (const userId of uncached) {
      try {
        const params = new URLSearchParams({ user: userId });
        const response = await throttledSlackFetch(
          `${SLACK_API_URL}/users.info?${params.toString()}`,
          accessToken
        );
        const data: SlackUserInfoResponse = await response.json();

        if (data.ok && data.user) {
          const displayName =
            data.user.profile?.display_name ||
            data.user.profile?.real_name ||
            data.user.real_name ||
            userId;
          result.set(userId, displayName);
          await this.redis.set(`slack:user:${userId}`, displayName, 'EX', SLACK_USER_CACHE_TTL);
        } else {
          result.set(userId, userId);
        }
      } catch {
        result.set(userId, userId);
      }
    }

    return result;
  }

  async fetchChannels(accessToken: string): Promise<SlackChannel[]> {
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

      const response = await throttledSlackFetch(
        `${SLACK_API_URL}/conversations.list?${params.toString()}`,
        accessToken
      );

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

  /**
   * Fetch the last 2000 messages from a channel (initial sync).
   * No `oldest` param, just paginate newest-first up to the limit.
   */
  private async fetchRecentMessages(
    accessToken: string,
    channel: string,
    slackBotUserId?: string
  ): Promise<{ messages: SlackMessage[]; latestTs: string | undefined }> {
    const allMessages: SlackMessage[] = [];
    let cursor: string | undefined;
    const maxMessages = 2000;

    do {
      const params = new URLSearchParams({
        channel,
        limit: '200',
      });
      if (cursor) {
        params.set('cursor', cursor);
      }

      const response = await throttledSlackFetch(
        `${SLACK_API_URL}/conversations.history?${params.toString()}`,
        accessToken
      );

      const data: SlackConversationsHistoryResponse = await response.json();

      if (!data.ok) {
        this.logger.error(
          `Slack conversations.history failed for ${channel}: ${data.error ?? 'Unknown'}`
        );
        throw new Error(
          `Slack conversations.history error for ${channel}: ${data.error ?? 'Unknown'}`
        );
      }

      const messages = data.messages ?? [];
      const botMentionPattern = slackBotUserId ? `<@${slackBotUserId}>` : null;
      allMessages.push(
        ...messages.filter(
          (m) => !m.bot_id && (!botMentionPattern || !m.text?.includes(botMentionPattern))
        )
      );

      if (allMessages.length >= maxMessages) {
        break;
      }

      cursor = data.has_more ? data.response_metadata?.next_cursor || undefined : undefined;
    } while (cursor);

    // Trim to max
    if (allMessages.length > maxMessages) {
      allMessages.length = maxMessages;
    }

    let latestTs: string | undefined;
    for (const msg of allMessages) {
      if (msg.ts && (!latestTs || msg.ts > latestTs)) {
        latestTs = msg.ts;
      }
    }

    this.logger.log(`Initial sync: fetched ${allMessages.length} messages from channel ${channel}`);

    return { messages: allMessages, latestTs };
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
        inclusive: 'false',
      });
      if (oldestTs !== '0') {
        params.set('oldest', oldestTs);
      }
      if (cursor) {
        params.set('cursor', cursor);
      }

      const response = await throttledSlackFetch(
        `${SLACK_API_URL}/conversations.history?${params.toString()}`,
        accessToken
      );

      const data: SlackConversationsHistoryResponse = await response.json();

      if (!data.ok) {
        this.logger.error(
          `Slack conversations.history failed for ${channel}: ${data.error ?? 'Unknown'}`
        );
        throw new Error(
          `Slack conversations.history error for ${channel}: ${data.error ?? 'Unknown'}`
        );
      }

      const messages = data.messages ?? [];
      // Skip bot messages (including our own replies) to avoid indexing generated content.
      // Also skip messages that @mention the bot, these are questions directed at us,
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

    this.logger.log(`Fetched ${allMessages.length} messages from channel ${channel}`);

    return { messages: allMessages, latestTs };
  }

  /**
   * Expand thread parents into full threads (parent + replies).
   * Non-threaded messages pass through unchanged. Thread replies are inserted
   * in chronological order right after their parent, replacing the standalone parent.
   */
  async expandThreads(
    accessToken: string,
    channel: string,
    messages: SlackMessage[],
    slackBotUserId?: string
  ): Promise<SlackMessage[]> {
    // Identify thread parents (messages with replies)
    const threadParents = messages.filter((m) => m.reply_count && m.reply_count > 0 && m.ts);

    if (threadParents.length === 0) return messages;

    const threadRepliesMap = new Map<string, SlackMessage[]>();

    for (const parent of threadParents) {
      const replies = await this.fetchThreadReplies(
        accessToken,
        channel,
        parent.ts ?? '',
        slackBotUserId
      );

      // Filter replies by thread_ts (more resilient than position-based slicing)
      const threadTs = parent.ts ?? '';
      const actualReplies = replies.filter((r) => r.ts !== threadTs);
      if (actualReplies.length > 0) {
        threadRepliesMap.set(threadTs, actualReplies);
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

      const response = await throttledSlackFetch(
        `${SLACK_API_URL}/conversations.replies?${params.toString()}`,
        accessToken
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
