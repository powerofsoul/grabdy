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
  region: aws.getRegionOutput(),
} as const;
