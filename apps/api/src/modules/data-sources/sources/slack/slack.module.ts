import { Module } from '@nestjs/common';

import { SlackChannelFetcher } from './fetcher/channel.fetcher';
import { SlackUserResolver } from './fetcher/user-resolver';
import { SlackBotWebhookHandler } from './webhook/bot.webhook';
import { SlackWebhookService } from './webhook/slack.webhook.service';
import { SlackOAuthService } from './slack.oauth.service';
import { SlackSyncService } from './slack.sync.service';

@Module({
  providers: [
    SlackOAuthService,
    SlackWebhookService,
    SlackSyncService,
    SlackBotWebhookHandler,
    SlackChannelFetcher,
    SlackUserResolver,
  ],
  exports: [
    SlackOAuthService,
    SlackWebhookService,
    SlackSyncService,
    SlackBotWebhookHandler,
    SlackChannelFetcher,
  ],
})
export class SlackModule {}
