import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { extractOrgNumericId, packId } from '@grabdy/common';
import { Job, Queue } from 'bullmq';

import { DbService } from '../../../../db/db.module';
import { SlackAgent } from '../../../agent/agents/slack-agent';
import type { DataSourceJobData } from '../../../data-sources/data-source.types';
import { DATA_SOURCE_QUEUE, SLACK_BOT_QUEUE } from '../../../queue/queue.constants';
import { parseProviderData } from '../../connector.interface';
import { IntegrationsService } from '../../integrations.service';

import { SlackChannelWebhook } from './webhooks/channel.webhook';
import { SlackConnector } from './slack.connector';
import type { SlackBotJobData } from './slack-bot.service';

const SLACK_API_URL = 'https://slack.com/api';

interface SlackApiResponse {
  ok: boolean;
  error?: string;
}

interface SlackChannelInfoResponse extends SlackApiResponse {
  channel?: {
    id: string;
    name: string;
  };
}

@Processor(SLACK_BOT_QUEUE)
export class SlackBotProcessor extends WorkerHost {
  private readonly logger = new Logger(SlackBotProcessor.name);

  constructor(
    private readonly slackAgent: SlackAgent,
    private readonly integrationsService: IntegrationsService,
    private readonly slackConnector: SlackConnector,
    private readonly channelWebhook: SlackChannelWebhook,
    private readonly db: DbService,
    @InjectQueue(DATA_SOURCE_QUEUE) private readonly dataSourceQueue: Queue
  ) {
    super();
  }

  async process(job: Job<SlackBotJobData>): Promise<void> {
    const { type } = job.data;
    this.logger.log(`Processing slack-bot job: ${type} (job ${job.id})`);

    if (type === 'app_mention' || type === 'dm') {
      await this.processAppMention(job.data);
    } else if (type === 'channel_joined') {
      await this.processChannelJoined(job.data);
    }
  }

  private async processAppMention(data: SlackBotJobData): Promise<void> {
    const { connectionId, orgId, slackChannelId, threadTs, text } = data;

    if (!text || !threadTs) return;

    this.logger.log(`Processing ${data.type} for org ${orgId} in channel ${slackChannelId}`);

    // Load connection to get access token
    const connection = await this.integrationsService.getConnectionById(connectionId);
    if (!connection) {
      this.logger.warn(`Connection ${connectionId} not found`);
      return;
    }

    const providerData = parseProviderData(connection.provider_data);
    if (providerData.provider !== 'SLACK') {
      this.logger.warn(`Connection ${connectionId} is not a Slack connection`);
      return;
    }
    const slackBotUserId = providerData.slackBotUserId;

    try {
      await this.slackAgent.run({
        orgId,
        accessToken: connection.access_token,
        channel: slackChannelId,
        threadTs,
        text,
        slackBotUserId,
      });

      this.logger.log(`Posted bot reply in channel ${slackChannelId} thread ${threadTs}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process ${data.type}: ${msg}`);

      // Post error message to Slack so the user knows something went wrong
      try {
        await this.postSlackMessage(
          connection.access_token,
          slackChannelId,
          'Sorry, I encountered an error while looking up your question. Please try again.',
          threadTs
        );
      } catch {
        // Best-effort error reply
      }
    }
  }

  private async processChannelJoined(data: SlackBotJobData): Promise<void> {
    const { connectionId, orgId, slackChannelId } = data;

    this.logger.log(`Processing channel_joined for org ${orgId} in channel ${slackChannelId}`);

    const connection = await this.integrationsService.getConnectionById(connectionId);
    if (!connection) {
      this.logger.warn(`Connection ${connectionId} not found`);
      return;
    }

    try {
      const joinedProviderData = parseProviderData(connection.provider_data);
      const botUserId =
        joinedProviderData.provider === 'SLACK' ? joinedProviderData.slackBotUserId : undefined;
      const teamDomain =
        joinedProviderData.provider === 'SLACK' ? joinedProviderData.teamDomain : undefined;

      // Fetch channel info for the name
      const channelName = await this.fetchChannelName(connection.access_token, slackChannelId);

      // Fetch full channel history
      const { messages } = await this.channelWebhook.fetchChannelMessages(
        connection.access_token,
        slackChannelId,
        '0', // From the beginning
        botUserId
      );

      if (messages.length === 0) {
        this.logger.log(`No messages in channel ${slackChannelId}, skipping ingestion`);
        return;
      }

      // Expand threads to include replies
      const expandedMessages = await this.channelWebhook.expandThreads(
        connection.access_token,
        slackChannelId,
        messages,
        botUserId
      );

      const syncedMessages = expandedMessages.map((msg) => {
        const time = msg.ts
          ? new Date(parseFloat(msg.ts) * 1000)
              .toISOString()
              .replace('T', ' ')
              .replace(/\.\d+Z$/, ' UTC')
          : '';
        const user = msg.user ?? 'unknown';
        const text = msg.text ?? '';
        const ts = msg.ts ?? '';
        return {
          content: `[${time}] ${user}: ${text}`,
          metadata: {
            type: 'SLACK' as const,
            slackChannelId: slackChannelId,
            slackMessageTs: ts,
            slackAuthors: [user],
          },
          sourceUrl:
            teamDomain && ts
              ? `https://${teamDomain}.slack.com/archives/${slackChannelId}/p${ts.replace('.', '')}`
              : `https://slack.com/app_redirect?channel=${slackChannelId}`,
        };
      });
      const content = syncedMessages.map((m) => m.content).join('\n');

      const title = `#${channelName}`;
      const externalId = slackChannelId;

      // Check if a data source already exists for this channel
      const existing = await this.db.kysely
        .selectFrom('data.data_sources')
        .select(['id'])
        .where('connection_id', '=', connectionId)
        .where('external_id', '=', externalId)
        .where('org_id', '=', orgId)
        .executeTakeFirst();

      const sourceUrl = teamDomain
        ? `https://${teamDomain}.slack.com/archives/${slackChannelId}`
        : `https://slack.com/app_redirect?channel=${slackChannelId}`;

      if (existing) {
        // Update existing and re-process
        await this.db.kysely
          .updateTable('data.data_sources')
          .set({
            title,
            source_url: sourceUrl,
            status: 'UPLOADED',
            updated_at: new Date(),
          })
          .where('id', '=', existing.id)
          .where('org_id', '=', orgId)
          .execute();

        await this.db.kysely
          .deleteFrom('data.chunks')
          .where('data_source_id', '=', existing.id)
          .where('org_id', '=', orgId)
          .execute();

        const jobData: DataSourceJobData = {
          dataSourceId: existing.id,
          orgId,
          storagePath: '',
          mimeType: 'text/plain',
          collectionId: null,
          content,
          messages: syncedMessages,
        };
        await this.dataSourceQueue.add('process', jobData);
      } else {
        // Create new data source
        const dataSourceId = packId('DataSource', extractOrgNumericId(orgId));

        await this.db.kysely
          .insertInto('data.data_sources')
          .values({
            id: dataSourceId,
            title,
            mime_type: 'text/plain',
            file_size: Buffer.byteLength(content, 'utf-8'),
            storage_path: '',
            type: 'SLACK',
            status: 'UPLOADED',
            connection_id: connectionId,
            external_id: externalId,
            source_url: sourceUrl,
            org_id: orgId,
            uploaded_by_id: null,
            updated_at: new Date(),
          })
          .execute();

        const jobData: DataSourceJobData = {
          dataSourceId,
          orgId,
          storagePath: '',
          mimeType: 'text/plain',
          collectionId: null,
          content,
          messages: syncedMessages,
        };
        await this.dataSourceQueue.add('process', jobData);
      }

      this.logger.log(`Ingested ${messages.length} messages from channel ${slackChannelId}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process channel_joined: ${msg}`);
      throw error;
    }
  }

  private async postSlackMessage(
    accessToken: string,
    channel: string,
    text: string,
    threadTs: string
  ): Promise<void> {
    const response = await fetch(`${SLACK_API_URL}/chat.postMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text,
        thread_ts: threadTs,
      }),
    });

    const data: SlackApiResponse = await response.json();

    if (!data.ok) {
      throw new Error(`Slack chat.postMessage error: ${data.error ?? 'Unknown error'}`);
    }
  }

  private async fetchChannelName(accessToken: string, slackChannelId: string): Promise<string> {
    const response = await fetch(
      `${SLACK_API_URL}/conversations.info?channel=${encodeURIComponent(slackChannelId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const data: SlackChannelInfoResponse = await response.json();

    if (!data.ok || !data.channel) {
      return slackChannelId; // Fallback to channel ID if we can't get the name
    }

    return data.channel.name;
  }
}
