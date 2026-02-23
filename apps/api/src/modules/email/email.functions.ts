import { Logger } from '@nestjs/common';

import { inngest } from '../../inngest/inngest.client';
import { InngestFunctions } from '../../inngest/inngest.decorator';

import { EmailService } from './email.service';

@InngestFunctions()
export class EmailFunctions {
  private readonly logger = new Logger(EmailFunctions.name);

  constructor(private emailService: EmailService) {}

  definitions() {
    return [this.sendEmail()];
  }

  private sendEmail() {
    return inngest.createFunction(
      {
        id: 'email-send',
        retries: 5,
        throttle: { limit: 10, period: '1s' },
      },
      { event: 'app/email.send' },
      async ({ event, step }) => {
        const { type, to, payload } = event.data;

        await step.run('send', async () => {
          switch (type) {
            case 'verification-otp':
              await this.emailService.sendEmailVerificationOTP(to, payload.name, payload.otp);
              break;
            case 'welcome':
              await this.emailService.sendWelcomeEmail(to, payload.name);
              break;
            case 'password-reset':
              await this.emailService.sendPasswordResetOTP(to, payload.name, payload.otp);
              break;
            case 'org-invite':
              await this.emailService.sendOrgInviteEmail(to, payload.orgName, payload.token);
              break;
          }
        });

        this.logger.log(`Email sent: ${type} to ${to}`);
      }
    );
  }
}
