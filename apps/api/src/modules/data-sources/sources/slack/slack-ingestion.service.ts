import { Injectable, Logger } from '@nestjs/common';

import { dbIdSchema } from '@grabdy/common';

import { SlackAgent } from '../../../agent/agents/slack-agent';
import type { SyncedItem } from '../../../integrations/connector.interface';

import { SlackChannelFetcher } from './fetcher/channel.fetcher';
import type { SlackChannelTimestamps } from './types';
import { SLACK_API_URL } from './utils';

@Injectable()
export class SlackIngestionService {
  private readonly logger = new Logger(SlackIngestionService.name);

  constructor(
    private channelFetcher: SlackChannelFetcher,
    private slackAgent: SlackAgent
  ) {}

  async joinSlackChannels(params: { accessToken: string; channels: string[] }): Promise<void> {
    for (const channel of params.channels) {
      const response = await fetch(`${SLACK_API_URL}/conversations.join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel }),
      });
      const data: { ok: boolean; error?: string } = await response.json();
      if (!data.ok && data.error !== 'already_in_channel') {
        this.logger.warn(`Failed to join channel ${channel}: ${data.error ?? 'Unknown'}`);
      }
    }
  }

  async fetchSlackMemberChannels(params: {
    accessToken: string;
  }): Promise<Array<{ id: string; name: string }>> {
    const channels = await this.channelFetcher.fetchChannels(params.accessToken);
    return channels.map((ch) => ({ id: ch.id, name: ch.name }));
  }

  async fetchSlackChannelMessages(params: {
    accessToken: string;
    channel: { id: string; name: string };
    providerData: {
      channelTimestamps: SlackChannelTimestamps;
      teamDomain?: string;
      slackBotUserId?: string;
    };
  }): Promise<{ item: SyncedItem | null; newTimestamp: string | null }> {
    return this.channelFetcher.fetchSingleChannel(
      params.accessToken,
      params.channel,
      params.providerData
    );
  }

  async runSlackAgent(params: {
    org: string;
    accessToken: string;
    channel: string;
    threadTs: string;
    text: string;
    slackBotUserId?: string;
  }): Promise<string> {
    const orgId = dbIdSchema('Org').parse(params.org);
    return this.slackAgent.run({
      orgId,
      accessToken: params.accessToken,
      channel: params.channel,
      threadTs: params.threadTs,
      text: params.text,
      slackBotUserId: params.slackBotUserId,
    });
  }

  async postSlackErrorReply(params: {
    accessToken: string;
    channel: string;
    threadTs: string;
  }): Promise<void> {
    await fetch(`${SLACK_API_URL}/chat.postMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: params.channel,
        text: 'Sorry, I encountered an error while looking up your question. Please try again.',
        thread_ts: params.threadTs,
      }),
    });
  }
}
