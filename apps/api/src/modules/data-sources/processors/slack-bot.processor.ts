import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { Job } from 'bullmq';

import { IntegrationIngestionService } from '../services/integration-ingestion.service';
import { SlackIngestionService } from '../sources/slack/slack-ingestion.service';

import type { SlackBotJobData } from './job-data.types';

@Processor('slack-bot', { concurrency: 10 })
export class SlackBotProcessor extends WorkerHost {
  private readonly logger = new Logger(SlackBotProcessor.name);

  constructor(
    private integrationIngestion: IntegrationIngestionService,
    private slackIngestion: SlackIngestionService
  ) {
    super();
  }

  async process(job: Job<SlackBotJobData>): Promise<void> {
    const { connectionId, orgId, channel, threadTs, text } = job.data;

    const conn = await this.integrationIngestion.loadConnectionWithTokens({ connectionId });

    if (conn.providerData.provider !== 'SLACK') {
      throw new Error('Expected SLACK provider data');
    }

    try {
      await this.slackIngestion.runSlackAgent({
        org: orgId,
        accessToken: conn.accessToken,
        channel,
        threadTs,
        text,
        slackBotUserId: conn.providerData.slackBotUserId,
      });
    } catch {
      await this.slackIngestion.postSlackErrorReply({
        accessToken: conn.accessToken,
        channel,
        threadTs,
      });
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
  }
}
