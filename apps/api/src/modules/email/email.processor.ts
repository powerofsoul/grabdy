import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { Job } from 'bullmq';

import { EmailService } from './email.service';

@Processor('email', { concurrency: 10 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { type, to, payload } = job.data;

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

    this.logger.log(`Email sent: ${type} to ${to}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
  }
}
