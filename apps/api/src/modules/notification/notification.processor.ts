import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { Job } from 'bullmq';

import { InjectEnv } from '../../config/env.config';

@Processor('notification', { concurrency: 3 })
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(@InjectEnv('slackWebhookUrl') private readonly slackWebhookUrl: string) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { text, type } = job.data;

    if (!this.slackWebhookUrl) {
      this.logger.log('Slack webhook URL not configured, skipping notification');
      return;
    }

    const response = await fetch(this.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
    }

    this.logger.log(`Slack notification sent: ${type}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
  }
}
