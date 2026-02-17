import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

const config = new pulumi.Config('grabdy');

export const Env = {
  domain: config.require('domain'),
  apiDomain: config.require('apiDomain'),
  dbPassword: config.requireSecret('dbPassword'),
  jwtSecret: config.requireSecret('jwtSecret'),
  openaiApiKey: config.requireSecret('openaiApiKey'),
  adminApiKey: config.requireSecret('adminApiKey'),
  bullBoardUsername: config.require('bullBoardUsername'),
  bullBoardPassword: config.requireSecret('bullBoardPassword'),
  integrationEncryptionKey: config.requireSecret('integrationEncryptionKey'),

  slackWebhookUrl: config.requireSecret('slackWebhookUrl'),

  slackClientId: config.require('slackClientId'),
  slackClientSecret: config.requireSecret('slackClientSecret'),
  slackSigningSecret: config.requireSecret('slackSigningSecret'),

  linearClientId: config.require('linearClientId'),
  linearClientSecret: config.requireSecret('linearClientSecret'),
  linearWebhookSecret: config.requireSecret('linearWebhookSecret'),

  smtpHost: config.require('smtpHost'),
  smtpPort: config.require('smtpPort'),
  smtpUser: config.require('smtpUser'),
  smtpPass: config.requireSecret('smtpPass'),
  emailFrom: config.require('emailFrom'),
  region: aws.getRegionOutput(),
} as const;
