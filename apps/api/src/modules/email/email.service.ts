import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

import { render } from '@react-email/components';
import * as nodemailer from 'nodemailer';

import { authLinks } from '../../common/auth-links';
import { InjectEnv } from '../../config/env.config';

import { AccountSetupEmail } from './templates/account-setup';
import { PasswordResetEmail } from './templates/password-reset';
import { WelcomeEmail } from './templates/welcome';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly isDev: boolean;

  constructor(
    @InjectEnv('nodeEnv') nodeEnv: string,
    @InjectEnv('smtpHost') smtpHost: string,
    @InjectEnv('smtpPort') smtpPort: number,
    @InjectEnv('smtpUser') smtpUser: string,
    @InjectEnv('smtpPass') smtpPass: string,
    @InjectEnv('emailFrom') private readonly emailFrom: string
  ) {
    this.isDev = nodeEnv === 'development';

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    templateName: string,
    templateProps: Record<string, unknown>
  ) {
    if (this.isDev) {
      this.logger.log(`[DEV] Email skipped - Template: ${templateName}`);
      this.logger.log(`[DEV] To: ${to}, Subject: ${subject}`);
      this.logger.log(`[DEV] Props: ${JSON.stringify(templateProps, null, 2)}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send email to ${to}: ${message}`);
      throw new InternalServerErrorException(`Failed to send email: ${message}`);
    }
  }

  async sendPasswordResetOTP(to: string, name: string, otp: string) {
    const props = { name, otp };
    const html = await render(PasswordResetEmail(props));
    await this.sendEmail(to, 'Your password reset code', html, 'PasswordResetEmail', props);
  }

  async sendOrgInviteEmail(to: string, name: string, orgName: string, token: string) {
    const setupUrl = authLinks.completeAccount(token);
    const props = { name, setupUrl };
    const html = await render(AccountSetupEmail(props));
    await this.sendEmail(
      to,
      `You've been invited to ${orgName}`,
      html,
      'AccountSetupEmail',
      props
    );
  }

  async sendWelcomeEmail(to: string, name: string) {
    const loginUrl = authLinks.login();
    const props = { name, loginUrl };
    const html = await render(WelcomeEmail(props));
    await this.sendEmail(to, 'Welcome to Grabdy!', html, 'WelcomeEmail', props);
  }
}
