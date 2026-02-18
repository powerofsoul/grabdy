import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

const config = new pulumi.Config('grabdy');

export const Env = {
  domain: config.require('domain'),
  apiDomain: config.require('apiDomain'),

  // Google OAuth — also used for frontend build (VITE_GOOGLE_CLIENT_ID)
  googleClientId: config.require('googleClientId'),

  // Non-sensitive SMTP settings kept as ECS env vars
  smtpHost: config.require('smtpHost'),
  smtpPort: config.require('smtpPort'),
  emailFrom: config.require('emailFrom'),

  region: aws.getRegionOutput(),
} as const;
