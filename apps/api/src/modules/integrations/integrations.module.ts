import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import {
  DATA_SOURCE_QUEUE,
  INTEGRATIONS_QUEUE,
  SLACK_BOT_QUEUE,
} from '../queue/queue.constants';

import { IntegrationSyncProcessor } from './processors/integration-sync.processor';
import { GitHubConnector } from './providers/github/github.connector';
import { GitHubDiscussionWebhook } from './providers/github/webhooks/discussion.webhook';
import { GitHubIssueWebhook } from './providers/github/webhooks/issue.webhook';
import { GitHubPrWebhook } from './providers/github/webhooks/pr.webhook';
import { LinearConnector } from './providers/linear/linear.connector';
import { LinearIssueWebhook } from './providers/linear/webhooks/issue.webhook';
import { NotionConnector } from './providers/notion/notion.connector';
import { NotionPageWebhook } from './providers/notion/webhooks/page.webhook';
import { ProviderRegistry } from './providers/provider-registry';
import { SlackConnector } from './providers/slack/slack.connector';
import { SlackBotProcessor } from './providers/slack/slack-bot.processor';
import { SlackBotService } from './providers/slack/slack-bot.service';
import { SlackChannelWebhook } from './providers/slack/webhooks/channel.webhook';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: INTEGRATIONS_QUEUE }),
    BullModule.registerQueue({ name: DATA_SOURCE_QUEUE }),
    BullModule.registerQueue({ name: SLACK_BOT_QUEUE }),
  ],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    ProviderRegistry,
    // Webhook services
    GitHubIssueWebhook,
    GitHubPrWebhook,
    GitHubDiscussionWebhook,
    LinearIssueWebhook,
    NotionPageWebhook,
    SlackChannelWebhook,
    // Connectors
    SlackBotService,
    SlackConnector,
    LinearConnector,
    GitHubConnector,
    NotionConnector,
    IntegrationSyncProcessor,
    SlackBotProcessor,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
