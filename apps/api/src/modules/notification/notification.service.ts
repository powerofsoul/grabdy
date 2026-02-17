import { Injectable, Logger } from '@nestjs/common';

import { InjectEnv } from '../../config/env.config';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(@InjectEnv('slackWebhookUrl') private readonly slackWebhookUrl: string) {}

  notifyNewSignup(email: string, name: string, method: 'email' | 'google'): void {
    this.sendSlack(`🎉 New signup: *${name}* (${email}) via ${method}`);
  }

  private sendSlack(text: string): void {
    if (!this.slackWebhookUrl) return;

    fetch(this.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch((err) => {
      this.logger.warn(`Slack notification failed: ${err}`);
    });
  }
}
