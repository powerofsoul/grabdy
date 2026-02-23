import { Logger } from '@nestjs/common';

import { InjectEnv } from '../../config/env.config';
import { inngest } from '../../inngest/inngest.client';
import { InngestFunctions } from '../../inngest/inngest.decorator';

@InngestFunctions()
export class NotificationFunctions {
  private readonly logger = new Logger(NotificationFunctions.name);

  constructor(@InjectEnv('slackWebhookUrl') private readonly slackWebhookUrl: string) {}

  definitions() {
    return [this.notifySlack()];
  }

  private notifySlack() {
    return inngest.createFunction(
      { id: 'notification-slack', retries: 3 },
      { event: 'app/notification.slack' },
      async ({ event, step }) => {
        const { text } = event.data;

        await step.run('post', async () => {
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
        });

        this.logger.log(`Slack notification sent: ${event.data.type}`);
      }
    );
  }
}
