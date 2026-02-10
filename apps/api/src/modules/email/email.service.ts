import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

import * as nodemailer from 'nodemailer';

import { InjectEnv } from '../../config/env.config';

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

  private async sendEmail(to: string, subject: string, html: string) {
    if (this.isDev) {
      this.logger.log(`[DEV] Email skipped — To: ${to}, Subject: ${subject}`);
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
    const html = `<p>Hi ${name},</p><p>Your password reset code is: <strong>${otp}</strong></p><p>This code expires in 15 minutes.</p>`;
    await this.sendEmail(to, 'Your password reset code', html);
  }

  async sendWelcomeEmail(to: string, name: string) {
    const html = `<p>Hi ${name},</p><p>Welcome to Fastdex! Your account has been created.</p>`;
    await this.sendEmail(to, 'Welcome to Fastdex!', html);
  }

  async sendOrgInviteEmail(to: string, name: string, orgName: string, token: string) {
    const html = `<p>Hi ${name},</p><p>You've been invited to join <strong>${orgName}</strong> on Fastdex.</p><p>Use token: ${token}</p>`;
    await this.sendEmail(to, `You've been invited to ${orgName}`, html);
  }
}
