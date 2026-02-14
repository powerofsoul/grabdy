import { Injectable, Logger } from '@nestjs/common';

import { InjectEnv } from '../../config/env.config';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(@InjectEnv('slackWebhookUrl') private readonly webhookUrl: string) {}

  async notifySlack(name: string, email: string): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.warn('SLACK_WEBHOOK_URL not configured, skipping notification');
      return;
    }

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `New waitlist signup:\n*Name:* ${name}\n*Email:* ${email}`,
      }),
    });

    if (!response.ok) {
      this.logger.error(`Slack webhook failed with status ${response.status}`);
    }
  }
}
