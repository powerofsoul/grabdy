import { Injectable, Logger } from '@nestjs/common';

import type { Queue } from 'bullmq';

import { InjectTypedQueue } from '../../queue/queue.decorators';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(@InjectTypedQueue('notification') private notificationQueue: Queue) {}

  notifyNewSignup(email: string, name: string, method: 'email' | 'google'): void {
    this.notificationQueue
      .add('slack', {
        orgId: null,
        type: 'new-signup',
        text: `New signup: *${name}* (${email}) via ${method}`,
      })
      .catch((err) => {
        this.logger.error(`Failed to queue signup notification: ${err}`);
      });
  }

  notifyDemoRequest(name: string, company: string, email: string): void {
    this.notificationQueue
      .add('slack', {
        orgId: null,
        type: 'demo-request',
        text: `Demo request: *${name}* from *${company}* (${email})`,
      })
      .catch((err) => {
        this.logger.error(`Failed to queue demo request notification: ${err}`);
      });
  }
}
