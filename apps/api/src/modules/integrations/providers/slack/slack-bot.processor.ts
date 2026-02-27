import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { Job, Queue } from 'bullmq';
import { z } from 'zod';

import { InjectTypedQueue } from '../../../../queue/queue.decorators';
import { SlackAgent } from '../../../agent/agents/slack-agent';
import { parseProviderData } from '../../connector.interface';
import { IntegrationsService } from '../../integrations.service';

import type { SlackBotJobData } from './slack-bot.service';
import type { SlackProcessChannelJobData } from './slack-process-channel.processor';

const SLACK_API_URL = 'https://slack.com/api';

const slackApiResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});

@Processor('slack-bot', { concurrency: 5 })
export class SlackBotProcessor extends WorkerHost {
  private readonly logger = new Logger(SlackBotProcessor.name);

  constructor(
    private readonly slackAgent: SlackAgent,
    private readonly integrationsService: IntegrationsService,
    @InjectTypedQueue('notification') private notificationQueue: Queue,
    @InjectTypedQueue('slack-process-channel') private processChannelQueue: Queue
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const data: SlackBotJobData = job.data;
    const { type } = data;

    this.logger.log(`Processing slack-bot job: ${type}`);

    if (type === 'app_mention' || type === 'dm') {
      await this.handleMentionOrDm(data);
    } else if (type === 'channel_joined') {
      await this.handleChannelJoined(data);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
    this.notificationQueue
      .add('slack', {
        orgId: null,
        type: 'slack-bot-failure',
        text: `Slack bot processing failed: ${job.name}(${job.id}) - ${err.message}`,
      })
      .catch((e) => this.logger.error('Failed to enqueue failure notification', e));
  }

  private async handleMentionOrDm(data: SlackBotJobData) {
    const { connectionId, orgId, slackChannelId, threadTs, text, type } = data;

    if (!text || !threadTs) return;

    this.logger.log(`Processing ${type} for org ${orgId} in channel ${slackChannelId}`);

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
  }

  private async handleChannelJoined(data: SlackBotJobData) {
    const { connectionId, orgId, slackChannelId } = data;

    this.logger.log(
      `Bot joined channel ${slackChannelId}, queuing channel sync for connection ${connectionId}`
    );

    // Fetch channel name and workspace domain for the job
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

    const jobData: SlackProcessChannelJobData = {
      connectionId,
      orgId,
      slackChannel: slackChannelId,
      channelName: slackChannelId, // Will be resolved by the processor via fetchChannels
      teamDomain: providerData.teamDomain,
    };

    await this.processChannelQueue.add('process', jobData, {
      jobId: `channel-${connectionId}-${slackChannelId}`,
    });
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
}
