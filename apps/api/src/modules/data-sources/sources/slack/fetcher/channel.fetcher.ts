import { Injectable, Logger } from '@nestjs/common';

import type { ChunkMeta } from '@grabdy/contracts';

import type { SyncedItem } from '../../../../integrations/connector.interface';
import type {
  SlackChannel,
  SlackChannelTimestamps,
  SlackConversationsHistoryResponse,
  SlackConversationsListResponse,
  SlackConversationsRepliesResponse,
  SlackMessage,
} from '../types';
import { formatSlackMessage, SLACK_API_URL, throttledSlackFetch } from '../utils';

import { SlackUserResolver } from './user-resolver';

@Injectable()
export class SlackChannelFetcher {
  private readonly logger = new Logger(SlackChannelFetcher.name);

  constructor(private readonly userResolver: SlackUserResolver) {}

  /**
   * Fetch and sync a single channel. Returns the synced item (if messages found)
   * and the new timestamp cursor for this channel.
   */
  async fetchSingleChannel(
    accessToken: string,
    channel: { id: string; name: string },
    providerData: {
      channelTimestamps: SlackChannelTimestamps;
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
    const userNames = await this.userResolver.resolveUserNames(accessToken, expandedMessages);

    const messages = expandedMessages.map((msg) => {
      const ts = msg.ts ?? '';
      const userId = msg.user ?? 'unknown';
      return {
        content: formatSlackMessage(msg, userNames),
        metadata: {
          type: 'SLACK',
          slackChannelId: channel.id,
          slackMessageTs: ts,
          slackAuthors: [userNames.get(userId) ?? userId],
        } satisfies ChunkMeta,
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
   * Non-threaded messages pass through unchanged.
   */
  async expandThreads(
    accessToken: string,
    channel: string,
    messages: SlackMessage[],
    slackBotUserId?: string
  ): Promise<SlackMessage[]> {
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

      const threadTs = parent.ts ?? '';
      const actualReplies = replies.filter((r) => r.ts !== threadTs);
      if (actualReplies.length > 0) {
        threadRepliesMap.set(threadTs, actualReplies);
      }
    }

    // Rebuild message list: for each thread parent, insert replies after it
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

  /**
   * Fetch the last 2000 messages from a channel (initial sync).
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
