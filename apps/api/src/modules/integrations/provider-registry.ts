import { Injectable } from '@nestjs/common';

import type { IntegrationProvider } from '@grabdy/contracts';

import { GitHubOAuthService } from '../data-sources/sources/github/github.oauth.service';
import { GitHubSyncService } from '../data-sources/sources/github/github.sync.service';
import { GitHubWebhookService } from '../data-sources/sources/github/webhook/github.webhook.service';
import { LinearOAuthService } from '../data-sources/sources/linear/linear.oauth.service';
import { LinearSyncService } from '../data-sources/sources/linear/linear.sync.service';
import { LinearWebhookService } from '../data-sources/sources/linear/webhook/linear.webhook.service';
import { NotionOAuthService } from '../data-sources/sources/notion/notion.oauth.service';
import { NotionSyncService } from '../data-sources/sources/notion/notion.sync.service';
import { NotionWebhookService } from '../data-sources/sources/notion/webhook/notion.webhook.service';
import { SlackOAuthService } from '../data-sources/sources/slack/slack.oauth.service';
import { SlackSyncService } from '../data-sources/sources/slack/slack.sync.service';
import { SlackWebhookService } from '../data-sources/sources/slack/webhook/slack.webhook.service';

import type { ProviderConfig } from './connector.interface';

@Injectable()
export class ProviderRegistry {
  private readonly providers: Map<IntegrationProvider, ProviderConfig>;

  constructor(
    slackOAuth: SlackOAuthService,
    slackWebhook: SlackWebhookService,
    slackSync: SlackSyncService,
    linearOAuth: LinearOAuthService,
    linearWebhook: LinearWebhookService,
    linearSync: LinearSyncService,
    githubOAuth: GitHubOAuthService,
    githubWebhook: GitHubWebhookService,
    githubSync: GitHubSyncService,
    notionOAuth: NotionOAuthService,
    notionWebhook: NotionWebhookService,
    notionSync: NotionSyncService
  ) {
    this.providers = new Map<IntegrationProvider, ProviderConfig>([
      [
        'SLACK',
        {
          oauth: slackOAuth,
          webhook: slackWebhook,
          sync: slackSync,
          syncSchedule: { every: 3_600_000 },
          rateLimits: { maxRequestsPerMinute: 50, maxRequestsPerHour: 3000 },
        },
      ],
      [
        'LINEAR',
        {
          oauth: linearOAuth,
          webhook: linearWebhook,
          sync: linearSync,
          syncSchedule: null,
          rateLimits: { maxRequestsPerMinute: 25, maxRequestsPerHour: 1500 },
        },
      ],
      [
        'GITHUB',
        {
          oauth: githubOAuth,
          webhook: githubWebhook,
          sync: githubSync,
          syncSchedule: null,
          rateLimits: { maxRequestsPerMinute: 30, maxRequestsPerHour: 5000 },
        },
      ],
      [
        'NOTION',
        {
          oauth: notionOAuth,
          webhook: notionWebhook,
          sync: notionSync,
          syncSchedule: { every: 3_600_000 },
          rateLimits: { maxRequestsPerMinute: 180, maxRequestsPerHour: 10000 },
        },
      ],
    ]);
  }

  get(provider: IntegrationProvider): ProviderConfig {
    const entry = this.providers.get(provider);
    if (!entry) {
      throw new Error(`No provider registered for: ${provider}`);
    }
    return entry;
  }

  has(provider: IntegrationProvider): boolean {
    return this.providers.has(provider);
  }
}
