import { Module } from '@nestjs/common';

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
import { SlackBotFunctions } from './providers/slack/slack-bot.functions';
import { SlackBotService } from './providers/slack/slack-bot.service';
import { SlackChannelWebhook } from './providers/slack/webhooks/channel.webhook';
import { IntegrationFunctions } from './integration.functions';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
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
    IntegrationFunctions,
    SlackBotFunctions,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
