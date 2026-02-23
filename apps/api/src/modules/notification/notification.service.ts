import { Injectable, Logger } from '@nestjs/common';

import { InngestService } from '../../inngest/inngest.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private inngestService: InngestService) {}

  notifyNewSignup(email: string, name: string, method: 'email' | 'google'): void {
    this.inngestService
      .send('app/notification.slack', {
        orgId: null,
        type: 'new-signup',
        text: `New signup: *${name}* (${email}) via ${method}`,
      })
      .catch((err) => {
        this.logger.error(`Failed to queue signup notification: ${err}`);
      });
  }

  notifyDemoRequest(name: string, company: string, email: string): void {
    this.inngestService
      .send('app/notification.slack', {
        orgId: null,
        type: 'demo-request',
        text: `Demo request: *${name}* from *${company}* (${email})`,
      })
      .catch((err) => {
        this.logger.error(`Failed to queue demo request notification: ${err}`);
      });
  }
}
