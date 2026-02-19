import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { extractOrgNumericId, packId } from '@grabdy/common';
import { AiCallerType } from '@grabdy/contracts';
import { Job, Queue } from 'bullmq';

import { DbService } from '../../../../db/db.module';
import { AgentFactory } from '../../../agent/services/agent.factory';
import { SlackReplyTool } from '../../../agent/tools/slack-reply.tool';
import type { DataSourceJobData } from '../../../data-sources/data-source.processor';
import { DATA_SOURCE_QUEUE, SLACK_BOT_QUEUE } from '../../../queue/queue.constants';
import { parseProviderData } from '../../connector.interface';
import { IntegrationsService } from '../../integrations.service';

import { SlackConnector } from './slack.connector';
import type { SlackBotJobData } from './slack-bot.service';
import { SlackChannelWebhook } from './webhooks/channel.webhook';

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

interface SlackThreadMessage {
  user?: string;
  bot_id?: string;
  text?: string;
  ts?: string;
}

interface SlackConversationsRepliesResponse extends SlackApiResponse {
  messages?: SlackThreadMessage[];
}

@Processor(SLACK_BOT_QUEUE)
export class SlackBotProcessor extends WorkerHost {
  private readonly logger = new Logger(SlackBotProcessor.name);

  constructor(
    private readonly agentFactory: AgentFactory,
    private readonly slackReplyTool: SlackReplyTool,
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
      // Fetch thread history for context
      const threadContext = await this.fetchThreadContext(
        connection.access_token,
        slackChannelId,
        threadTs,
        slackBotUserId
      );

      // Build the prompt with thread context
      let prompt = text;
      if (threadContext) {
        prompt = `Previous conversation:\n${threadContext}\n\nCurrent question: ${text}`;
      }

      // Create a slack_reply tool so the agent can post/update messages progressively
      const slackReplyTool = this.slackReplyTool.create({
        accessToken: connection.access_token,
        channel: slackChannelId,
        threadTs,
      });

      // Create a data agent with all collections, no canvas, and provider-specific instructions
      const agent = this.agentFactory.createDataAgent({
        orgId,
        source: 'SLACK',
        callerType: AiCallerType.SYSTEM,
        instructions: this.slackConnector.botInstructions,
        tools: [{ slack_reply: slackReplyTool }],
        maxSteps: 5,
      });

      // Generate answer — the agent posts/updates the Slack message via slack_reply tool
      await agent.generate(prompt);

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

      const syncedMessages = messages.map((msg) => {
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
            slackAuthor: user,
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
          .execute();

        await this.db.kysely
          .deleteFrom('data.chunks')
          .where('data_source_id', '=', existing.id)
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

  private async fetchThreadContext(
    accessToken: string,
    channel: string,
    threadTs: string,
    slackBotUserId?: string
  ): Promise<string | null> {
    const params = new URLSearchParams({
      channel,
      ts: threadTs,
      limit: '50',
    });

    const response = await fetch(`${SLACK_API_URL}/conversations.replies?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data: SlackConversationsRepliesResponse = await response.json();

    if (!data.ok || !data.messages || data.messages.length <= 1) {
      return null;
    }

    // Exclude the latest message (the current question) — it's already in `text`
    const history = data.messages.slice(0, -1);

    const lines = history.map((msg) => {
      const isBot = (slackBotUserId && msg.user === slackBotUserId) || Boolean(msg.bot_id);
      const role = isBot ? 'Assistant' : 'User';
      const text = (msg.text ?? '').replace(/<@[A-Z0-9]+>/g, '').trim();
      return `${role}: ${text}`;
    });

    return lines.join('\n');
  }
}
