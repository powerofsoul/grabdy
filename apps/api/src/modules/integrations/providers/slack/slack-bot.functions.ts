import { Logger } from '@nestjs/common';

import { extractOrgNumericId, packId } from '@grabdy/common';
import { z } from 'zod';

import { DbService } from '../../../../db/db.module';
import { inngest, type InngestStepTools } from '../../../../inngest/inngest.client';
import { InngestFunctions } from '../../../../inngest/inngest.decorator';
import { InngestService } from '../../../../inngest/inngest.service';
import { SlackAgent } from '../../../agent/agents/slack-agent';
import { parseProviderData } from '../../connector.interface';
import { IntegrationsService } from '../../integrations.service';

import { SlackChannelWebhook } from './webhooks/channel.webhook';
import { SlackConnector } from './slack.connector';
import type { SlackBotJobData } from './slack-bot.service';

const SLACK_API_URL = 'https://slack.com/api';

const slackApiResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});

const slackChannelInfoResponseSchema = slackApiResponseSchema.extend({
  channel: z.object({ id: z.string(), name: z.string() }).optional(),
});

@InngestFunctions()
export class SlackBotFunctions {
  private readonly logger = new Logger(SlackBotFunctions.name);

  constructor(
    private readonly slackAgent: SlackAgent,
    private readonly integrationsService: IntegrationsService,
    private readonly slackConnector: SlackConnector,
    private readonly channelWebhook: SlackChannelWebhook,
    private readonly db: DbService,
    private readonly inngestService: InngestService
  ) {}

  definitions() {
    return [this.slackBotHandle()];
  }

  private slackBotHandle() {
    return inngest.createFunction(
      {
        id: 'slack-bot-handle',
        concurrency: [{ scope: 'fn', key: 'event.data.slackChannelId', limit: 1 }],
      },
      { event: 'app/slack-bot.handle' },
      async ({ event, step }) => {
        const data = event.data;
        const { type } = data;

        this.logger.log(`Processing slack-bot job: ${type}`);

        if (type === 'app_mention' || type === 'dm') {
          return this.handleMentionOrDm(step, data);
        } else if (type === 'channel_joined') {
          return this.handleChannelJoined(step, data);
        }
      }
    );
  }

  private async handleMentionOrDm(step: InngestStepTools, data: SlackBotJobData) {
    const { connectionId, orgId, slackChannelId, threadTs, text, type } = data;

    if (!text || !threadTs) return;

    this.logger.log(`Processing ${type} for org ${orgId} in channel ${slackChannelId}`);

    // Outside step.run so access_token is never serialized into Inngest step state/logs.
    // Re-executing on replay is safe: fetches a fresh token.
    const conn = await this.integrationsService.getConnectionById(connectionId);
    if (!conn) {
      this.logger.warn(`Connection ${connectionId} not found`);
      return;
    }

    const providerData = parseProviderData(conn.provider_data);
    if (providerData.provider !== 'SLACK') {
      this.logger.warn(`Connection ${connectionId} is not a Slack connection`);
      return;
    }

    await step.run('run-agent', async () => {
      try {
        await this.slackAgent.run({
          orgId,
          accessToken: conn.access_token,
          channel: slackChannelId,
          threadTs,
          text,
          slackBotUserId: providerData.slackBotUserId,
        });

        this.logger.log(`Posted bot reply in channel ${slackChannelId} thread ${threadTs}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to process ${type}: ${msg}`);

        try {
          await this.postSlackMessage(
            conn.access_token,
            slackChannelId,
            'Sorry, I encountered an error while looking up your question. Please try again.',
            threadTs
          );
        } catch {
          // Best-effort error reply
        }
      }
    });
  }

  private async handleChannelJoined(step: InngestStepTools, data: SlackBotJobData) {
    const { connectionId, orgId, slackChannelId } = data;

    this.logger.log(`Processing channel_joined for org ${orgId} in channel ${slackChannelId}`);

    // Outside step.run so access_token is never serialized into Inngest step state/logs.
    // Re-executing on replay is safe: fetches a fresh token.
    const conn = await this.integrationsService.getConnectionById(connectionId);
    if (!conn) {
      this.logger.warn(`Connection ${connectionId} not found`);
      return;
    }

    const providerData = parseProviderData(conn.provider_data);
    if (providerData.provider !== 'SLACK') {
      this.logger.warn(`Connection ${connectionId} is not a Slack connection`);
      return;
    }

    const { slackBotUserId, teamDomain } = providerData;

    const history = await step.run('fetch-history', async () => {
      const channelName = await this.fetchChannelName(conn.access_token, slackChannelId);

      const { messages } = await this.channelWebhook.fetchChannelMessages(
        conn.access_token,
        slackChannelId,
        '0',
        slackBotUserId
      );

      if (messages.length === 0) {
        this.logger.log(`No messages in channel ${slackChannelId}, skipping ingestion`);
        return null;
      }

      const expandedMessages = await this.channelWebhook.expandThreads(
        conn.access_token,
        slackChannelId,
        messages,
        slackBotUserId
      );

      const syncedMessages = expandedMessages.map((msg) => {
        const time = formatSlackTimestamp(msg.ts);
        const user = msg.user ?? 'unknown';
        const msgText = msg.text ?? '';
        const ts = msg.ts ?? '';
        return {
          content: `[${time}] ${user}: ${msgText}`,
          metadata: {
            type: 'SLACK' as const,
            slackChannelId,
            slackMessageTs: ts,
            slackAuthors: [user],
          },
          sourceUrl: buildMessageUrl(teamDomain, slackChannelId, ts),
        };
      });

      return {
        channelName,
        content: syncedMessages.map((m) => m.content).join('\n'),
        syncedMessages,
        messageCount: messages.length,
      };
    });

    if (!history) return;

    const sourceUrl = teamDomain
      ? `https://${teamDomain}.slack.com/archives/${slackChannelId}`
      : `https://slack.com/app_redirect?channel=${slackChannelId}`;

    const dataSourceId = await step.run('upsert-data-source', async () => {
      const title = `#${history.channelName}`;

      const existing = await this.db.kysely
        .selectFrom('data.data_sources')
        .select(['id'])
        .where('connection_id', '=', connectionId)
        .where('external_id', '=', slackChannelId)
        .where('org_id', '=', orgId)
        .executeTakeFirst();

      if (existing) {
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

        return existing.id;
      }

      const newId = packId('DataSource', extractOrgNumericId(orgId));

      await this.db.kysely
        .insertInto('data.data_sources')
        .values({
          id: newId,
          title,
          mime_type: 'text/plain',
          file_size: Buffer.byteLength(history.content, 'utf-8'),
          storage_path: '',
          type: 'SLACK',
          status: 'UPLOADED',
          connection_id: connectionId,
          external_id: slackChannelId,
          source_url: sourceUrl,
          org_id: orgId,
          uploaded_by_id: null,
          updated_at: new Date(),
        })
        .execute();

      return newId;
    });

    await this.inngestService.send('app/data-source.process', {
      dataSourceId,
      orgId,
      storagePath: '',
      mimeType: 'text/plain',
      collectionId: null,
      content: history.content,
      messages: history.syncedMessages,
    });

    this.logger.log(`Ingested ${history.messageCount} messages from channel ${slackChannelId}`);
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

    const responseData = slackApiResponseSchema.parse(await response.json());

    if (!responseData.ok) {
      throw new Error(`Slack chat.postMessage error: ${responseData.error ?? 'Unknown error'}`);
    }
  }

  private async fetchChannelName(accessToken: string, slackChannelId: string): Promise<string> {
    const response = await fetch(
      `${SLACK_API_URL}/conversations.info?channel=${encodeURIComponent(slackChannelId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const responseData = slackChannelInfoResponseSchema.parse(await response.json());

    if (!responseData.ok || !responseData.channel) {
      return slackChannelId;
    }

    return responseData.channel.name;
  }
}

function formatSlackTimestamp(ts: string | undefined): string {
  if (!ts) return '';
  return new Date(parseFloat(ts) * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

function buildMessageUrl(teamDomain: string | undefined, channel: string, ts: string): string {
  if (teamDomain && ts) {
    return `https://${teamDomain}.slack.com/archives/${channel}/p${ts.replace('.', '')}`;
  }
  return `https://slack.com/app_redirect?channel=${channel}`;
}
